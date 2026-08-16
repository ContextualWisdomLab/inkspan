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

  it('keeps light, dark, and forced-colors color values aligned with the stylesheet', () => {
    const foreground = getEditorThemeToken('cwl-fg');

    expect(foreground.role).toBe('color');
    expect(foreground.lightValue).toBe('#1f2328');
    expect(foreground.darkValue).toBe('#e6edf3');
    expect(foreground.forcedColorsValue).toBe('#000000');
    expect(stylesheet).toContain(`${foreground.cssCustomProperty}: ${foreground.lightValue};`);
    expect(stylesheet).toContain(`${foreground.cssCustomProperty}: ${foreground.darkValue};`);
    expect(stylesheet).toContain(
      `${foreground.cssCustomProperty}: ${foreground.forcedColorsValue};`,
    );
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
