import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

import { describe, expect, it } from 'vitest';

const repositoryFile = (path: string): string =>
  readFileSync(resolve(process.cwd(), path), 'utf8');

describe('ADR quality documentation contract', () => {
  it('preserves the canonical ADR quality requirements on every reconciliation branch', () => {
    const adrIndex = repositoryFile('docs/adr/README.md');

    expect(adrIndex).toContain('## ADR quality requirements');
    expect(adrIndex).toContain('context and the problem boundary');
    expect(adrIndex).toContain('materially distinct alternatives considered');
    expect(adrIndex).toContain('failure and recovery semantics');
    expect(adrIndex).toContain('security and privacy impact');
    expect(adrIndex).toContain('compatibility and migration behavior');
    expect(adrIndex).toContain('verification/acceptance evidence');
    expect(adrIndex).toContain('rollback or explicit supersession conditions');
  });
});
