import { describe, expect, it, vi } from 'vitest';
import {
  DOCUMENT_ENVELOPE_SCHEMA_ID,
  DocumentEnvelopeError,
  createDocumentEnvelope,
} from './documentEnvelope.js';
import {
  createDocumentEnvelopeRevision,
  createDocumentEnvelopeRevisionBytes,
  type DocumentEnvelopeDigestProvider,
} from './documentEnvelopeRevision.js';

describe('document envelope revision negative-zero boundary', () => {
  it('rejects object and UTF-8 inputs before the digest provider runs', async () => {
    const digestProvider: DocumentEnvelopeDigestProvider = {
      digest: vi.fn(async () => new ArrayBuffer(32)),
    };
    const objectEnvelope = createDocumentEnvelope({
      type: 'doc',
      attrs: { unsafeNumericValue: -0 },
    });
    const byteEnvelope = new TextEncoder().encode(
      `{"schemaId":"${DOCUMENT_ENVELOPE_SCHEMA_ID}","schemaVersion":1,"documentJson":{"type":"doc","attrs":{"unsafeNumericValue":-0}}}`,
    );

    await expect(
      createDocumentEnvelopeRevision(
        objectEnvelope,
        undefined,
        digestProvider,
      ),
    ).rejects.toThrow(DocumentEnvelopeError);
    await expect(
      createDocumentEnvelopeRevisionBytes(
        byteEnvelope,
        undefined,
        digestProvider,
      ),
    ).rejects.toThrow('negative zero');
    expect(digestProvider.digest).not.toHaveBeenCalled();
  });
});
