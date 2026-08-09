import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const repositoryRoot = process.cwd();
const readme = readFileSync(resolve(repositoryRoot, 'README.md'), 'utf8');

describe('envelope identity buyer discovery', () => {
  it('documents the shipped framework-independent identity-routing surface', () => {
    expect(readme).toContain('@contextualwisdomlab/cwl-editor/envelope-identity');
    expect(readme).toContain('inspectDocumentEnvelopeIdentity()');
    expect(readme).toContain('inspectDocumentEnvelopeIdentityBytes()');
    expect(readme).toMatch(/routing metadata only/i);
    expect(readme).toMatch(/host[- ]owned migration/i);
  });
});
