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

    // The forced-colors boundary must cascade after the theme-colored rule so
    // the system-color override is effective, not dead code.
    expect(forcedColorsIndex).toBeGreaterThan(
      ordinaryFocusRule?.index ?? Number.MAX_SAFE_INTEGER,
    );

    expect(forcedColorsStyles).toMatch(
      /\.cwl-editor__content:focus-visible\s*\{[^}]*outline:\s*2px\s+solid\s+Highlight\s*;[^}]*outline-offset:\s*-2px\s*;/u,
    );
  });

  it('uses one consistent system color for every focus indicator in forced-colors mode', () => {
    expect(forcedColorsStyles).toMatch(
      /\.cwl-tb-btn:focus-visible\s*\{[^}]*outline:\s*2px\s+solid\s+Highlight\s*;[^}]*outline-offset:\s*2px\s*;/u,
    );
    // No competing partial override may resurrect a second focus color after
    // the comprehensive forced-colors contract.
    expect(forcedColorsStyles).not.toMatch(
      /\.cwl-editor__content:focus-visible\s*\{[^}]*outline-color:\s*CanvasText\s*;/u,
    );
  });
});
