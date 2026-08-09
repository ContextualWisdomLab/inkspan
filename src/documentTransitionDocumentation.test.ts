import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

/** Read one UTF-8 repository document from the current exact checkout. */
function repositoryFile(path: string): string {
  return readFileSync(resolve(process.cwd(), path), 'utf8');
}

describe('document transition evidence documentation', () => {
  it('makes the compact framework-independent API discoverable to adopters', () => {
    const operatorGuide = repositoryFile(
      'docs/revision-evidence-subpath.md',
    );
    const rootEntrypoint = repositoryFile('src/index.ts');
    const readme = repositoryFile('README.md');

    expect(rootEntrypoint).toContain(
      'createDocumentEnvelopeTransitionEvidence',
    );
    expect(rootEntrypoint).not.toContain(
      'createDocumentEnvelopeTransitionEvidenceJson',
    );
    expect(operatorGuide).toContain(
      'createDocumentEnvelopeTransitionEvidenceBytes',
    );
    expect(operatorGuide).toContain('compact content-lineage evidence');
    expect(operatorGuide).toContain(
      'does not prove that a durable write occurred',
    );
    expect(operatorGuide).toContain('previous first and resulting second');
    expect(readme).toContain(
      'Framework-independent document transition evidence',
    );
    expect(readme).toContain(
      'createDocumentEnvelopeTransitionEvidenceBytes()',
    );
    expect(readme).toContain(
      'does not identify an actor, establish authorization, authenticate server time',
    );
  });

  it('keeps occurrence provenance, privacy, and durable audit ownership explicit', () => {
    const architecture = repositoryFile('ARCHITECTURE.md');
    const doctoring = repositoryFile(
      'docs/doctoring/document-transition-evidence.md',
    );

    expect(architecture).toContain('compact content-lineage evidence');
    expect(architecture).toContain('host-owned occurrence provenance');
    expect(doctoring).toContain('W3C PROV-DM');
    expect(doctoring).toContain('RFC 8785');
    expect(doctoring).toContain('RFC 9110');
    expect(doctoring).toContain('FIPS PUB 180-4');
    expect(doctoring).toMatch(/NIST\s+Policy\s+on\s+Hash\s+Functions/);
    expect(doctoring).toContain('Retrieved August 7, 2026');
    expect(doctoring).toContain(
      'does not prove who caused a transition, when it occurred, or whether it was durably accepted',
    );
  });
});
