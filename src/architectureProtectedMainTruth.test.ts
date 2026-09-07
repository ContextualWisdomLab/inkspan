import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

import { describe, expect, it } from 'vitest';

const architecture = readFileSync(
  resolve(process.cwd(), 'ARCHITECTURE.md'),
  'utf8',
);

describe('protected-main architecture truth', () => {
  it('does not describe merged Markdown or print capabilities as active proposals', () => {
    expect(architecture).toContain(
      'Protected `main` includes the framework-independent `@contextualwisdomlab/cwl-editor/markdown` subpath',
    );
    expect(architecture).toContain(
      'Protected `main` includes the CSS-only `@media print` presentation boundary',
    );
    expect(architecture).not.toContain(
      'Proposed markdown subpath\\nactive PR #114',
    );
    expect(architecture).not.toContain(
      'The active `@contextualwisdomlab/cwl-editor/markdown` work in PR #114',
    );
    expect(architecture).not.toContain(
      'Proposed ADR 0021 and active PR #116 define a CSS-only `@media print` boundary',
    );
    expect(architecture).not.toContain('Until #116 integrates');
  });
});
