import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

import { describe, expect, it } from 'vitest';

const styles = readFileSync(resolve(process.cwd(), 'src/styles.css'), 'utf8');
const printIndex = styles.indexOf('@media print');
const screenStyles = printIndex >= 0 ? styles.slice(0, printIndex) : styles;
const forcedColorsIndex = screenStyles.indexOf('@media (forced-colors: active)');

const findCssBlockEnd = (source: string, startIndex: number): number => {
  const openingBrace = source.indexOf('{', startIndex);
  if (openingBrace < 0) return -1;

  let depth = 0;
  for (let index = openingBrace; index < source.length; index += 1) {
    if (source[index] === '{') depth += 1;
    if (source[index] !== '}') continue;
    depth -= 1;
    if (depth === 0) return index + 1;
  }
  return -1;
};

const forcedColorsEnd =
  forcedColorsIndex >= 0 ? findCssBlockEnd(screenStyles, forcedColorsIndex) : -1;
const forcedColorsStyles =
  forcedColorsEnd > forcedColorsIndex
    ? screenStyles.slice(forcedColorsIndex, forcedColorsEnd)
    : '';
const beforeForcedColorsStyles =
  forcedColorsIndex >= 0 ? screenStyles.slice(0, forcedColorsIndex) : screenStyles;
const afterForcedColorsStyles =
  forcedColorsEnd >= 0 ? screenStyles.slice(forcedColorsEnd) : screenStyles;
const forcedColorsBlocks =
  screenStyles.match(/@media \(forced-colors: active\)/gu) ?? [];
const baseStateSelectors = [
  '.cwl-editor__content a {',
  '.cwl-editor__content blockquote {',
  '.cwl-collaboration-status {',
  '.collaboration-cursor__label {',
];

describe('forced-colors stylesheet contract', () => {
  it('defines one final screen forced-colors override layer after base state rules', () => {
    expect(printIndex).toBeGreaterThan(-1);
    expect(forcedColorsIndex).toBeGreaterThan(-1);
    expect(forcedColorsEnd).toBeGreaterThan(forcedColorsIndex);
    expect(forcedColorsBlocks).toHaveLength(1);
    for (const selector of baseStateSelectors) {
      expect(beforeForcedColorsStyles).toContain(selector);
      expect(afterForcedColorsStyles).not.toContain(selector);
    }
  });

  it('defines a forced-colors boundary using system colors', () => {
    expect(forcedColorsIndex).toBeGreaterThan(-1);
    expect(forcedColorsStyles).toContain('Canvas');
    expect(forcedColorsStyles).toContain('CanvasText');
    expect(forcedColorsStyles).toContain('ButtonFace');
    expect(forcedColorsStyles).toContain('ButtonText');
    expect(forcedColorsStyles).toContain('Highlight');
    expect(forcedColorsStyles).toContain('HighlightText');
    expect(forcedColorsStyles).toContain('GrayText');
    expect(forcedColorsStyles).toContain('LinkText');
  });

  it('keeps keyboard focus and active toolbar state visible without theme colors', () => {
    expect(forcedColorsStyles).toMatch(
      /\.cwl-tb-btn:focus-visible\s*\{[^}]*outline:\s*2px\s+solid\s+Highlight\s*;[^}]*outline-offset:\s*2px\s*;/u,
    );
    expect(forcedColorsStyles).toMatch(
      /\.cwl-tb-btn\.is-active\s*\{[^}]*background:\s*Highlight\s*;[^}]*border-color:\s*Highlight\s*;[^}]*color:\s*HighlightText\s*;/u,
    );
  });

  it('does not use opacity as the only disabled-state cue', () => {
    expect(forcedColorsStyles).toMatch(
      /\.cwl-tb-btn:disabled\s*\{[^}]*opacity:\s*1\s*;[^}]*color:\s*GrayText\s*;[^}]*border-color:\s*GrayText\s*;/u,
    );
  });

  it('preserves high-contrast chrome, document links, and collaboration cues', () => {
    expect(forcedColorsStyles).toMatch(
      /\.cwl-editor\s*\{[^}]*color:\s*CanvasText\s*;[^}]*background:\s*Canvas\s*;[^}]*border-color:\s*CanvasText\s*;/u,
    );
    expect(forcedColorsStyles).toMatch(
      /\.cwl-toolbar[\s\S]*\.cwl-collaboration-status[\s\S]*\{[^}]*background:\s*ButtonFace\s*;[^}]*color:\s*ButtonText\s*;/u,
    );
    expect(forcedColorsStyles).toMatch(
      /\.cwl-editor__content a\s*\{[^}]*color:\s*LinkText\s*;/u,
    );
    expect(forcedColorsStyles).toMatch(
      /\.collaboration-cursor__caret\s*\{[^}]*border-left-color:\s*Highlight\s*;/u,
    );
    expect(forcedColorsStyles).toMatch(
      /\.collaboration-cursor__label\s*\{[^}]*background:\s*Highlight\s*;[^}]*color:\s*HighlightText\s*;/u,
    );
  });

  it('preserves authored structural boundaries in forced colors', () => {
    expect(forcedColorsStyles).toMatch(
      /\.cwl-tb-group\s*\{[^}]*border-right-color:\s*CanvasText\s*;/u,
    );
    expect(forcedColorsStyles).toMatch(
      /\.cwl-editor__content code,[\s\S]*\.cwl-editor__content pre,[\s\S]*\.cwl-editor__content th,[\s\S]*\.cwl-editor__content td\s*\{[^}]*border-color:\s*CanvasText\s*;/u,
    );
  });
});
