import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

import { describe, expect, it } from 'vitest';

const repositoryFile = (file: string): string =>
  readFileSync(resolve(process.cwd(), file), 'utf8');

describe('review non-print export authority', () => {
  it('keeps review presentation outside deterministic document exports', () => {
    for (const file of [
      'docs/PRD.md',
      'docs/TRD.md',
      'docs/CONTRACTS.md',
      'docs/print-output.md',
    ]) {
      const document = repositoryFile(file).toLowerCase();
      expect(document).toContain('review metadata is excluded from non-print exports');
      expect(document).toContain('canonical document content');
      expect(document).toContain('separately governed export');
    }
  });
});
