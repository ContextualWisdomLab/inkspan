import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

import { describe, expect, it } from 'vitest';

const repositoryFile = (path: string): string =>
  readFileSync(resolve(process.cwd(), path), 'utf8');

describe('canonical release artifact inventory', () => {
  it('keeps protected release documents aligned with the four-file SBOM boundary', () => {
    const contracts = repositoryFile('docs/CONTRACTS.md');
    const operability = repositoryFile('docs/OPERABILITY.md');
    const releaseSecurity = repositoryFile('docs/release-security.md');
    const testStrategy = repositoryFile('docs/TEST_STRATEGY.md');

    expect(releaseSecurity).toContain(
      'Each successful GitHub release contains exactly four files',
    );
    expect(releaseSecurity).toContain('`inkspan.spdx.json`');

    expect(contracts).toContain('exactly four regular top-level files');
    expect(contracts).toContain('`inkspan.spdx.json`');
    expect(contracts).toMatch(/release evidence \| exact four-file draft inventory/u);

    expect(testStrategy).toContain('exact four-file inventory violations');
    expect(testStrategy).toContain(
      'exactly one npm tarball, exactly one Office wheel, `inkspan.spdx.json`, and `SHA256SUMS`',
    );

    expect(operability).toContain('build exactly four regular top-level release files');
    expect(operability).toContain(
      'exactly one npm tarball, exactly one Inkspan Office wheel, `inkspan.spdx.json`, and `SHA256SUMS`',
    );

    for (const document of [contracts, testStrategy, operability]) {
      expect(document).not.toContain('exactly three regular top-level files');
      expect(document).not.toContain('exact three-file draft inventory');
    }
  });
});
