import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

import { describe, expect, it } from 'vitest';

const styles = readFileSync(resolve(process.cwd(), 'src/styles.css'), 'utf8');
const forcedColorsIndex = styles.indexOf('@media (forced-colors: active)');
const forcedColorsStyles =
  forcedColorsIndex >= 0 ? styles.slice(forcedColorsIndex) : '';

describe('editable surface focus stylesheet contract', () => {
  it('replaces the removed browser outline with a visible keyboard focus cue', () => {
    expect(styles).toMatch(
      /\.cwl-editor__content:focus-visible\s*\{[^}]*outline:\s*2px\s+solid\s+var\(--cwl-accent\)\s*;[^}]*outline-offset:\s*-2px\s*;/u,
    );
  });

  it('keeps the editable focus cue visible in forced-colors mode', () => {
    expect(forcedColorsStyles).toMatch(
      /\.cwl-editor__content:focus-visible\s*\{[^}]*outline:\s*2px\s+solid\s+Highlight\s*;[^}]*outline-offset:\s*-2px\s*;/u,
    );
  });
});
