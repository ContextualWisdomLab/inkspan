import { describe, expect, it, vi } from 'vitest';
import {
  DOCUMENT_ENVELOPE_SCHEMA_ID,
  DOCUMENT_ENVELOPE_SCHEMA_VERSION,
  DOCUMENT_TRANSITION_EVIDENCE_SCHEMA_ID,
  DOCUMENT_TRANSITION_EVIDENCE_SCHEMA_VERSION,
  createDocumentEnvelopeRevisionEvidence,
  createDocumentEnvelopeRevisionEvidenceBytes,
  createDocumentEnvelopeTransitionEvidence,
  createDocumentEnvelopeTransitionEvidenceBytes,
  type CwlEditorDocumentTransitionEvidence,
  type DocumentEnvelopeDigestProvider,
} from './index.js';

const EXPECTED_SCHEMA_ID =
  'https://inkspan.io/schemas/document-envelope/v1';
const EXPECTED_TRANSITION_SCHEMA_ID =
  'https://inkspan.io/schemas/document-transition-evidence/v1';

/** Create a deterministic SHA-256-shaped provider for entrypoint verification. */
function createDigestProvider(): DocumentEnvelopeDigestProvider {
  return {
    digest: vi.fn(async () => new Uint8Array(32).fill(0x2a).buffer),
  };
}

/** Create a provider that returns one deterministic digest fill per call. */
function createSequentialDigestProvider(
  ...fills: readonly number[]
): DocumentEnvelopeDigestProvider {
  let callIndex = 0;
  return {
    digest: vi.fn(async () => {
      const fill = fills[callIndex] ?? fills.at(-1) ?? 0;
      callIndex += 1;
      return new Uint8Array(32).fill(fill).buffer;
    }),
  };
}

describe('framework-independent revision-evidence entrypoint', () => {
  it('exposes stable schema constants and object evidence', async () => {
    const provider = createDigestProvider();
    const source = {
      schemaId: DOCUMENT_ENVELOPE_SCHEMA_ID,
      schemaVersion: DOCUMENT_ENVELOPE_SCHEMA_VERSION,
      documentJson: { type: 'doc', content: [{ type: 'paragraph' }] },
    };

    const evidence = await createDocumentEnvelopeRevisionEvidence(
      source,
      undefined,
      provider,
    );

    expect(DOCUMENT_ENVELOPE_SCHEMA_ID).toBe(EXPECTED_SCHEMA_ID);
    expect(DOCUMENT_ENVELOPE_SCHEMA_VERSION).toBe(1);
    expect(evidence.envelope).toEqual(source);
    expect(evidence.revision).toEqual({
      algorithm: 'SHA-256',
      digestHex: '2a'.repeat(32),
      strongEntityTag: `"sha256-${'2a'.repeat(32)}"`,
    });
    expect(Object.isFrozen(evidence)).toBe(true);
    expect(Object.isFrozen(evidence.envelope)).toBe(true);
    expect(provider.digest).toHaveBeenCalledTimes(1);
  });

  it('normalizes strict UTF-8 bytes through the same public contract', async () => {
    const provider = createDigestProvider();
    const source = {
      schemaId: EXPECTED_SCHEMA_ID,
      schemaVersion: 1,
      documentJson: { type: 'doc' },
    };

    const evidence = await createDocumentEnvelopeRevisionEvidenceBytes(
      new TextEncoder().encode(JSON.stringify(source)),
      undefined,
      provider,
    );

    expect(evidence.envelope).toEqual(source);
    expect(evidence.revision.digestHex).toBe('2a'.repeat(32));
    expect(provider.digest).toHaveBeenCalledTimes(1);
  });

  it('exposes compact changed transition evidence without framework types', async () => {
    const provider = createSequentialDigestProvider(0x2a, 0x2b);
    const previous = {
      schemaId: DOCUMENT_ENVELOPE_SCHEMA_ID,
      schemaVersion: DOCUMENT_ENVELOPE_SCHEMA_VERSION,
      documentJson: { type: 'doc', content: [{ type: 'paragraph' }] },
    };
    const resulting = {
      schemaId: DOCUMENT_ENVELOPE_SCHEMA_ID,
      schemaVersion: DOCUMENT_ENVELOPE_SCHEMA_VERSION,
      documentJson: {
        type: 'doc',
        content: [{ type: 'paragraph', attrs: { reviewed: true } }],
      },
    };

    const evidence: CwlEditorDocumentTransitionEvidence =
      await createDocumentEnvelopeTransitionEvidence(
        previous,
        resulting,
        undefined,
        provider,
      );

    expect(DOCUMENT_TRANSITION_EVIDENCE_SCHEMA_ID).toBe(
      EXPECTED_TRANSITION_SCHEMA_ID,
    );
    expect(DOCUMENT_TRANSITION_EVIDENCE_SCHEMA_VERSION).toBe(1);
    expect(evidence.schemaId).toBe(EXPECTED_TRANSITION_SCHEMA_ID);
    expect(evidence.schemaVersion).toBe(1);
    expect(evidence.previousRevision.digestHex).toBe('2a'.repeat(32));
    expect(evidence.resultingRevision.digestHex).toBe('2b'.repeat(32));
    expect(evidence.changed).toBe(true);
    expect('envelope' in evidence).toBe(false);
    expect(Object.isFrozen(evidence)).toBe(true);
    expect(provider.digest).toHaveBeenCalledTimes(2);
  });

  it('exposes unchanged strict-byte transition evidence through the same contract', async () => {
    const provider = createDigestProvider();
    const source = {
      schemaId: DOCUMENT_ENVELOPE_SCHEMA_ID,
      schemaVersion: DOCUMENT_ENVELOPE_SCHEMA_VERSION,
      documentJson: { type: 'doc' },
    };
    const bytes = new TextEncoder().encode(JSON.stringify(source));

    const evidence = await createDocumentEnvelopeTransitionEvidenceBytes(
      bytes,
      bytes,
      undefined,
      provider,
    );

    expect(evidence.changed).toBe(false);
    expect(evidence.previousRevision).toEqual(evidence.resultingRevision);
    expect(provider.digest).toHaveBeenCalledTimes(2);
  });
});
