import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

import { describe, expect, it } from 'vitest';

const styles = readFileSync(resolve(process.cwd(), 'src/styles.css'), 'utf8');
const forcedColorsIndex = styles.indexOf('@media (forced-colors: active)');
const forcedColorsStyles =
  forcedColorsIndex >= 0 ? styles.slice(forcedColorsIndex) : '';

describe('editable surface focus stylesheet contract', () => {
  it('replaces the removed browser outline with a visible keyboard focus cue', () => {
    const ordinaryRule = /\.cwl-editor__content:focus-visible\s*\{[^}]*outline:\s*2px\s+solid\s+var\(--cwl-accent\)\s*;[^}]*outline-offset:\s*-2px\s*;/u;

    expect(styles).toMatch(ordinaryRule);
    // Exactly one ordinary rule keeps the forced-colors override authoritative.
    expect(styles.match(new RegExp(ordinaryRule.source, 'gu'))?.length).toBe(1);
  });

  it('keeps the editable focus cue visible in forced-colors mode', () => {
    const ordinaryFocusRule =
      /\.cwl-editor__content:focus-visible\s*\{[^}]*outline:\s*2px\s+solid\s+var\(--cwl-accent\)\s*;[^}]*outline-offset:\s*-2px\s*;/u.exec(
        styles,
      );
    expect(ordinaryFocusRule).not.toBeNull();

    // The single screen forced-colors layer must cascade after the
    // theme-colored rule so the system-color override is effective.
    expect(forcedColorsIndex).toBeGreaterThan(
      ordinaryFocusRule?.index ?? Number.MAX_SAFE_INTEGER,
    );

    // Editor content keeps guaranteed canvas contrast under forced colors.
    expect(forcedColorsStyles).toMatch(
      /\.cwl-editor__content:focus-visible\s*\{[^}]*outline-color:\s*CanvasText\s*;/u,
    );
    // No competing shorthand may resurrect a second editor-content focus color.
    expect(forcedColorsStyles).not.toMatch(
      /\.cwl-editor__content:focus-visible\s*\{[^}]*outline:\s*2px\s+solid\s+(?:Highlight|var\(--cwl-accent\))\s*;/u,
    );
  });
});
