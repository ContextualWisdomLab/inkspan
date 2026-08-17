import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

import { describe, expect, it } from 'vitest';

const repositoryFile = (path: string): string =>
  readFileSync(resolve(process.cwd(), path), 'utf8');

describe('canonical release artifact inventory consistency', () => {
  it('keeps the public contract aligned with the protected four-file release boundary', () => {
    const contracts = repositoryFile('docs/CONTRACTS.md');
    const releaseSecurity = repositoryFile('docs/release-security.md');

    expect(releaseSecurity).toContain(
      'Each successful GitHub release contains exactly four files',
    );
    expect(releaseSecurity).toContain('`inkspan.spdx.json`');

    expect(contracts).toContain('exactly four regular top-level files');
    expect(contracts).toContain('`inkspan.spdx.json`');
    expect(contracts).toMatch(/release evidence \| exact four-file draft inventory/u);
    expect(contracts).not.toContain('exactly three regular top-level files');
    expect(contracts).not.toContain('release evidence | exact three-file draft inventory');
  });
});
