import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

import { describe, expect, it } from 'vitest';

const repositoryFile = (path: string): string =>
  readFileSync(resolve(process.cwd(), path), 'utf8');

describe('protected email documentation maturity', () => {
  it('does not leave the merged email language/direction capability labeled as active-PR work', () => {
    for (const path of [
      'docs/email-output.md',
      'docs/doctoring/email-document-language-direction.md',
    ]) {
      const document = repositoryFile(path);
      expect(document).toContain('Status: Implemented on protected main');
      expect(document).not.toContain('Status: Implemented on active PR');
    }
  });
});
