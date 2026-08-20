import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

import { describe, expect, it } from 'vitest';

const architecture = readFileSync(
  resolve(process.cwd(), 'ARCHITECTURE.md'),
  'utf8',
);

describe('protected architecture capability maturity', () => {
  it('does not regress integrated Markdown packaging to an active proposal', () => {
    expect(architecture).toContain('Protected markdown subpath');
    expect(architecture).toContain('ADR 0020 is Accepted on protected `main`');
    expect(architecture).not.toContain('active PR #114');
    expect(architecture).not.toContain('Proposed markdown subpath');
  });

  it('does not regress integrated paged-media print behavior to an active proposal', () => {
    expect(architecture).toContain(
      'CSS paged-media print boundary is implemented on protected `main`',
    );
    expect(architecture).toContain('Accepted ADR 0021');
    expect(architecture).not.toContain('active PR #116');
    expect(architecture).not.toContain('Until #116 integrates');
  });
});
