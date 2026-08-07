import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

/** Read one UTF-8 repository document from the current exact checkout. */
function repositoryFile(path: string): string {
  return readFileSync(resolve(process.cwd(), path), 'utf8');
}

describe('document transition evidence documentation', () => {
  it('makes the compact framework-independent API discoverable to adopters', () => {
    const readme = repositoryFile('README.md');
    const operatorGuide = repositoryFile(
      'docs/revision-evidence-subpath.md',
    );

    expect(readme).toContain('createDocumentEnvelopeTransitionEvidence');
    expect(readme).toContain('accepts envelope objects or JSON text');
    expect(readme).not.toContain(
      'createDocumentEnvelopeTransitionEvidenceJson',
    );
    expect(readme).toContain('content-lineage evidence');
    expect(operatorGuide).toContain(
      'createDocumentEnvelopeTransitionEvidenceBytes',
    );
    expect(operatorGuide).toContain(
      'does not prove that a durable write occurred',
    );
    expect(operatorGuide).toContain('previous first and resulting second');
  });

  it('keeps occurrence provenance, privacy, and durable audit ownership explicit', () => {
    const architecture = repositoryFile('ARCHITECTURE.md');
    const doctoring = repositoryFile(
      'docs/doctoring/document-transition-evidence.md',
    );
    const changelog = repositoryFile('CHANGELOG.md');

    expect(architecture).toContain('compact content-lineage evidence');
    expect(architecture).toContain('host-owned occurrence provenance');
    expect(doctoring).toContain('W3C PROV-DM');
    expect(doctoring).toContain('RFC 8785');
    expect(doctoring).toContain('RFC 9110');
    expect(doctoring).toContain('FIPS PUB 180-4');
    expect(doctoring).toContain('NIST Policy on Hash Functions');
    expect(doctoring).toContain('Retrieved August 7, 2026');
    expect(doctoring).toContain(
      'does not prove who caused a transition, when it occurred, or whether it was durably accepted',
    );
    expect(changelog).toContain(
      'privacy-minimized document transition evidence',
    );
  });
});
