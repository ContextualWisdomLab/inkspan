import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const repositoryRoot = process.cwd();
const readme = readFileSync(resolve(repositoryRoot, 'README.md'), 'utf8');

describe('selection revision buyer discovery', () => {
  it('documents revision-scoped selection evidence without copying selected text', () => {
    expect(readme).toContain('getSelectionRevisionEvidence');
    expect(readme).toMatch(/same exact document revision/i);
    expect(readme).toMatch(/selected text/i);
    expect(readme).toMatch(/cross-revision/i);
  });
});
