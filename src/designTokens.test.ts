import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

import { describe, expect, it } from 'vitest';

import {
  EditorThemeTokenError,
  getEditorThemeToken,
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
