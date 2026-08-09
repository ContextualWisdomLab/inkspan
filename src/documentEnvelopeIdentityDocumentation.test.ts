import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const repositoryRoot = process.cwd();

function read(path: string): string {
  return readFileSync(resolve(repositoryRoot, path), 'utf8');
}

describe('document envelope identity documentation', () => {
  it('keeps identity routing separate from strict current-schema parsing', () => {
    const guide = read('docs/document-envelope.md');
    const doctoring = read('docs/doctoring/envelope-identity-routing.md');
    const contracts = read('docs/CONTRACTS.md');
    const changelog = read('CHANGELOG.md');
    const adr = read('docs/adr/0015-envelope-schema-migration-routing.md');

    for (const source of [guide, doctoring]) {
      expect(source).toContain('inspectDocumentEnvelopeIdentity');
      expect(source).toContain('parseDocumentEnvelope');
    }
    expect(contracts).toContain('inspectDocumentEnvelopeIdentity()');
    expect(contracts).toContain('inspectDocumentEnvelopeIdentityBytes()');
    expect(contracts).toContain('./envelope-identity');
    expect(changelog).toContain('inspectDocumentEnvelopeIdentity()');
    expect(changelog).toContain('framework-independent `envelope-identity`');
    expect(adr).toMatch(/identity inspector/i);
    expect(adr).toContain('`parseDocumentEnvelope()` remains strict');
    expect(guide).toContain('@contextualwisdomlab/cwl-editor/envelope-identity');
    expect(guide).toMatch(/host[- ]owned|Migration execution remains host-owned/i);
    expect(doctoring).toContain('Status: Implemented on protected main');
    expect(doctoring).not.toContain('Status: Implemented on active PR');
    expect(doctoring).toContain('Issue #74');
    expect(adr).toContain('Issue #74');
    expect(adr).toContain('Status: Accepted');
  });

  it('keeps the identity result document-free and migration authority outside Inkspan', () => {
    const guide = read('docs/document-envelope.md');
    const doctoring = read('docs/doctoring/envelope-identity-routing.md');

    expect(guide).toContain('never returns `documentJson`');
    expect(doctoring).toContain('contains no document body');
    expect(doctoring).toMatch(/schema registry/i);
    expect(doctoring).toMatch(/rollback/i);
    expect(doctoring).toMatch(/RFC 8259/);
    expect(doctoring).toMatch(/RFC 7493/);
    expect(doctoring).toMatch(/RFC 8785/);
  });
});
