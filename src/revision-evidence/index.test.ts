import { describe, expect, it, vi } from 'vitest';
import {
  DOCUMENT_ENVELOPE_SCHEMA_ID,
  DOCUMENT_ENVELOPE_SCHEMA_VERSION,
  createDocumentEnvelopeRevisionEvidence,
  createDocumentEnvelopeRevisionEvidenceBytes,
  type DocumentEnvelopeDigestProvider,
} from './index.js';

const EXPECTED_SCHEMA_ID =
  'https://inkspan.io/schemas/document-envelope/v1';

/** Create a deterministic SHA-256-shaped provider for entrypoint verification. */
function createDigestProvider(): DocumentEnvelopeDigestProvider {
  return {
    digest: vi.fn(async () => new Uint8Array(32).fill(0x2a).buffer),
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
});
