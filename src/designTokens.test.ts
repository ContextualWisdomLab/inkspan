import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

import { describe, expect, it } from 'vitest';

import {
  EditorThemeTokenContrastError,
  EditorThemeTokenError,
  contrastRatioFromHex,
  getEditorThemeToken,
  getEditorThemeTokenContrast,
  listEditorThemeTokens,
  toDesignTokenFormatGroup,
} from './designTokens.js';

const stylesheet = readFileSync(resolve(process.cwd(), 'src/styles.css'), 'utf8');

function mediaBlock(css: string, query: string): string {
  const marker = `@media ${query}`;
  const start = css.indexOf(marker);
  expect(start).toBeGreaterThan(-1);
  const open = css.indexOf('{', start);
  let depth = 0;
  for (let index = open; index < css.length; index += 1) {
    const character = css[index];
    if (character === '{') {
      depth += 1;
    }
    if (character === '}') {
      depth -= 1;
      if (depth === 0) {
        return css.slice(open + 1, index);
      }
    }
  }
  throw new Error(`Unclosed media query: ${query}`);
}

describe('editor theme token catalog', () => {
  it('lists every shipped .cwl-editor custom property hosts can override', () => {
    const tokens = listEditorThemeTokens();
    const names = tokens.map((token) => token.name);

    expect(names).toEqual([
      'cwl-fg',
      'cwl-muted',
      'cwl-border',
      'cwl-bg',
      'cwl-surface',
      'cwl-accent',
      'cwl-accent-soft',
      'cwl-radius',
      'cwl-font',
    ]);

    for (const token of tokens) {
      expect(stylesheet).toContain(`${token.cssCustomProperty}:`);
      expect(token.hostAction).toContain('Override');
      expect(token.hostAction).toContain('.cwl-editor');
      expect(token.hostAction).toContain(token.cssCustomProperty);
    }
  });

  it('keeps light, dark, and print color values inside the matching stylesheet media blocks', () => {
    const printBlock = mediaBlock(stylesheet, 'print');
    const darkBlock = mediaBlock(stylesheet, '(prefers-color-scheme: dark)');
    const forcedColorsBlock = mediaBlock(stylesheet, '(forced-colors: active)');
    const colorTokens = listEditorThemeTokens().filter((token) => token.role === 'color');

    expect(forcedColorsBlock).toContain('outline-color: CanvasText');

    for (const token of colorTokens) {
      expect(stylesheet).toContain(`${token.cssCustomProperty}: ${token.lightValue};`);
      expect(darkBlock).toContain(`${token.cssCustomProperty}: ${token.darkValue};`);
      expect(printBlock).toContain(`${token.cssCustomProperty}: ${token.printValue};`);
      expect(forcedColorsBlock).not.toContain(`${token.cssCustomProperty}:`);
    }
  });

  it('rejects unknown token names without reflecting caller input', () => {
    expect(() => getEditorThemeToken('not-a-theme-token')).toThrow(EditorThemeTokenError);
    expect(() => getEditorThemeToken('not-a-theme-token')).toThrow(
      /unknown editor theme token/iu,
    );
    expect(() => getEditorThemeToken('not-a-theme-token')).not.toThrow(/not-a-theme-token/u);
  });

  it('reports WCAG 2.2 contrast for shipped color pairs so hosts can check overrides', () => {
    const light = getEditorThemeTokenContrast('cwl-fg', 'cwl-bg', 'light');
    const dark = getEditorThemeTokenContrast('cwl-fg', 'cwl-bg', 'dark');
    const print = getEditorThemeTokenContrast('cwl-fg', 'cwl-bg', 'print');
    const muted = getEditorThemeTokenContrast('cwl-muted', 'cwl-bg', 'light');

    expect(light.ratio).toBeCloseTo(15.797619425332647, 8);
    expect(dark.ratio).toBeCloseTo(16.016082890827004, 8);
    expect(print.ratio).toBeCloseTo(21, 8);
    expect(muted.ratio).toBeCloseTo(6.114136455475549, 8);
    expect(light.ratio).toBeGreaterThanOrEqual(4.5);
    expect(light.meetsTextContrast).toBe(true);
    expect(light.meetsNonTextContrast).toBe(true);
    expect(light.hostAction).toContain('Override --cwl-fg and --cwl-bg on .cwl-editor');
    expect(light.hostAction).toContain('WCAG 2.2');
  });

  it('requires inventoried active-chrome text contrast to meet WCAG 2.2 AA', () => {
    const lightActive = getEditorThemeTokenContrast('cwl-accent', 'cwl-accent-soft', 'light');
    const darkActive = getEditorThemeTokenContrast('cwl-accent', 'cwl-accent-soft', 'dark');
    const printActive = getEditorThemeTokenContrast('cwl-accent', 'cwl-accent-soft', 'print');
    const accentOnBackground = getEditorThemeTokenContrast('cwl-accent', 'cwl-bg', 'light');

    expect(lightActive.ratio).toBeCloseTo(4.563748387142551, 8);
    expect(lightActive.meetsTextContrast).toBe(true);
    expect(darkActive.ratio).toBeCloseTo(5.062920561609967, 8);
    expect(darkActive.meetsTextContrast).toBe(true);
    expect(darkActive.meetsNonTextContrast).toBe(true);
    expect(darkActive.hostAction).toContain('--cwl-accent');
    expect(darkActive.hostAction).toContain('--cwl-accent-soft');
    expect(darkActive.hostAction).not.toContain('below 4.5:1');
    expect(printActive.meetsTextContrast).toBe(true);
    expect(accentOnBackground.meetsTextContrast).toBe(true);
  });

  it('points accent token host actions at the inventoried active pair', () => {
    const accent = getEditorThemeToken('cwl-accent');
    const accentSoft = getEditorThemeToken('cwl-accent-soft');
    const foreground = getEditorThemeToken('cwl-fg');

    expect(accent.hostAction).toContain('--cwl-accent-soft');
    expect(accentSoft.hostAction).toContain('--cwl-accent');
    expect(foreground.hostAction).toContain('--cwl-bg');
  });

  it('rejects contrast lookups that are not shipped color tokens without reflecting caller input', () => {
    expect(() => getEditorThemeTokenContrast('not-a-theme-token', 'cwl-bg')).toThrow(
      EditorThemeTokenError,
    );
    expect(() => getEditorThemeTokenContrast('not-a-theme-token', 'cwl-bg')).not.toThrow(
      /not-a-theme-token/u,
    );
    expect(() => getEditorThemeTokenContrast('cwl-font', 'cwl-bg')).toThrow(
      EditorThemeTokenContrastError,
    );
    expect(() => getEditorThemeTokenContrast('cwl-font', 'cwl-bg')).toThrow(
      /theme token contrast requires color tokens/iu,
    );
    expect(() => getEditorThemeTokenContrast('cwl-font', 'cwl-bg')).not.toThrow(/cwl-font/u);
    expect(() =>
      getEditorThemeTokenContrast('cwl-fg', 'cwl-bg', 'solar' as 'light'),
    ).toThrow(EditorThemeTokenContrastError);
    expect(contrastRatioFromHex('#1f2328', '#ffffff')).toBeCloseTo(15.797619425332647, 8);
    expect(contrastRatioFromHex('#000000', '#ffffff')).toBeCloseTo(21, 8);
    expect(() => contrastRatioFromHex('not-a-hex', '#ffffff')).toThrow(
      EditorThemeTokenContrastError,
    );
    expect(() => contrastRatioFromHex('not-a-hex', '#ffffff')).not.toThrow(/not-a-hex/u);
  });

  it('emits a DTCG 2025.10 group that hosts can copy into a theme file', () => {
    const group = toDesignTokenFormatGroup();
    const foreground = group.cwl.fg;

    expect(foreground.$type).toBe('color');
    expect(foreground.$value).toBe('#1f2328');
    expect(foreground.$description).toContain('Override --cwl-fg on .cwl-editor');
    expect(group.cwl.radius.$type).toBe('dimension');
    expect(group.cwl.font.$type).toBe('fontFamily');
    expect(Array.isArray(group.cwl.font.$value)).toBe(true);
  });
});
