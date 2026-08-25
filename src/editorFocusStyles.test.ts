import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

import { describe, expect, it } from 'vitest';

const styles = readFileSync(resolve(process.cwd(), 'src/styles.css'), 'utf8');

describe('editable surface focus visibility', () => {
  it('preserves a visible keyboard focus indicator on the textbox surface', () => {
    expect(styles).not.toMatch(
      /\.cwl-editor__content:focus\s*\{[^}]*outline:\s*none\s*;/u,
    );
    expect(styles).toMatch(
      /\.cwl-editor__content:focus-visible\s*\{[^}]*outline:\s*2px\s+solid\s+var\(--cwl-accent\)\s*;[^}]*outline-offset:\s*-?2px\s*;/u,
    );
  });

  it('keeps the editable focus indicator visible in forced-colors mode', () => {
    const ordinaryFocusRule =
      /\.cwl-editor__content:focus-visible\s*\{[^}]*outline:\s*2px\s+solid\s+var\(--cwl-accent\)\s*;[^}]*\}/u.exec(
        styles,
      );
    expect(ordinaryFocusRule).not.toBeNull();

    const forcedColorsIndex = styles.indexOf('@media (forced-colors: active)');
    expect(forcedColorsIndex).toBeGreaterThan(ordinaryFocusRule?.index ?? Number.MAX_SAFE_INTEGER);
    const forcedColorsStyles = styles.slice(forcedColorsIndex);

    expect(forcedColorsStyles).toMatch(
      /\.cwl-editor__content:focus-visible\s*\{[^}]*outline-color:\s*CanvasText\s*;/u,
    );
  });
});
