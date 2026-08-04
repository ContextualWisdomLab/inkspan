import { describe, expect, it, vi } from 'vitest';
import {
  DEFAULT_DOCUMENT_ENVELOPE_LIMITS,
  DOCUMENT_ENVELOPE_SCHEMA_ID,
  DOCUMENT_ENVELOPE_SCHEMA_VERSION,
  DocumentEnvelopeError,
  DocumentEnvelopeRevisionError,
  createDocumentEnvelopeRevisionEvidence,
  createDocumentEnvelopeRevisionEvidenceBytes,
  type DocumentEnvelopeDigestProvider,
} from './index.js';

const supportedEnvelope = {
  schemaId: 'https://inkspan.io/schemas/document-envelope/v1',
  schemaVersion: 1,
  documentJson: {
    type: 'doc',
    content: [
      {
        type: 'paragraph',
        content: [{ type: 'text', text: 'standalone evidence' }],
      },
    ],
  },
};

function createDigestProvider(fillByte: number) {
  const digest = vi.fn(
    async (algorithm: 'SHA-256', source: ArrayBuffer | ArrayBufferView) => {
      expect(algorithm).toBe('SHA-256');
      expect(ArrayBuffer.isView(source)).toBe(true);
      return new Uint8Array(32).fill(fillByte).buffer;
    },
  );
  const provider: DocumentEnvelopeDigestProvider = { digest };
  return { provider, digest };
}

describe('standalone revision-evidence entrypoint', () => {
  it('returns frozen object evidence without React or TipTap contracts', async () => {
    const { provider, digest } = createDigestProvider(0x31);

    const evidence = await createDocumentEnvelopeRevisionEvidence(
      supportedEnvelope,
      undefined,
      provider,
    );

    expect(DOCUMENT_ENVELOPE_SCHEMA_ID).toBe(supportedEnvelope.schemaId);
    expect(DOCUMENT_ENVELOPE_SCHEMA_VERSION).toBe(1);
    expect(DEFAULT_DOCUMENT_ENVELOPE_LIMITS).toBeFrozen();
    expect(evidence.envelope.documentJson.type).toBe('doc');
    expect(evidence.revision.digestHex).toBe('31'.repeat(32));
    expect(evidence.revision.strongEntityTag).toBe(
      `"sha256-${'31'.repeat(32)}"`,
    );
    expect(evidence).toBeFrozen();
    expect(evidence.envelope).toBeFrozen();
    expect(evidence.envelope.documentJson).toBeFrozen();
    expect(evidence.revision).toBeFrozen();
    expect(digest).toHaveBeenCalledTimes(1);
  });

  it('normalizes strict UTF-8 evidence and invokes the provider once', async () => {
    const { provider, digest } = createDigestProvider(0x42);
    const noncanonicalJson = JSON.stringify({
      documentJson: supportedEnvelope.documentJson,
      schemaVersion: supportedEnvelope.schemaVersion,
      schemaId: supportedEnvelope.schemaId,
    });

    const evidence = await createDocumentEnvelopeRevisionEvidenceBytes(
      new TextEncoder().encode(noncanonicalJson),
      undefined,
      provider,
    );

    expect(evidence.envelope).toEqual(supportedEnvelope);
    expect(evidence.revision.digestHex).toBe('42'.repeat(32));
    expect(digest).toHaveBeenCalledTimes(1);
  });

  it('preserves exact redacted error-class identity across entrypoints', async () => {
    await expect(
      createDocumentEnvelopeRevisionEvidence({
        schemaId: supportedEnvelope.schemaId,
        schemaVersion: 99,
        documentJson: supportedEnvelope.documentJson,
      }),
    ).rejects.toBeInstanceOf(DocumentEnvelopeError);

    await expect(
      createDocumentEnvelopeRevisionEvidence(
        supportedEnvelope,
        undefined,
        null,
      ),
    ).rejects.toBeInstanceOf(DocumentEnvelopeRevisionError);
  });
});
