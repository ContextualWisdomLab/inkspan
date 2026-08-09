import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

import { describe, expect, it } from 'vitest';

const repositoryFile = (path: string): string =>
  readFileSync(resolve(process.cwd(), path), 'utf8');

const protectedBaselineDocuments = [
  'docs/README.md',
  'docs/DOCUMENTATION_FITNESS.md',
  'docs/PRD.md',
  'docs/TRD.md',
  'docs/CONTRACTS.md',
  'docs/UML.md',
  'docs/DATA_MODEL.md',
  'docs/THREAT_MODEL.md',
  'docs/TEST_STRATEGY.md',
  'docs/OPERABILITY.md',
  'docs/TRACEABILITY.md',
] as const;

describe('protected-main canonical documentation baseline', () => {
  it('marks the integrated canonical graph as protected-main authority', () => {
    for (const path of protectedBaselineDocuments) {
      expect(repositoryFile(path), path).toContain(
        'Status: Protected-main canonical baseline',
      );
    }
  });

  it('does not retain pre-integration branch disclaimers after protected merge', () => {
    const fitness = repositoryFile('docs/DOCUMENTATION_FITNESS.md');

    expect(fitness).not.toContain('not yet a protected-main canonical baseline');
    expect(fitness).not.toContain(
      'canonical documentation branch must still reconcile its ancestry',
    );
    expect(fitness).toContain(
      'documentation graph is a protected-main canonical baseline',
    );
  });
});
