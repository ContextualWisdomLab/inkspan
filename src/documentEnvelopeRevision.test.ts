import { describe, expect, it, vi } from 'vitest';
import { createDocumentEnvelope } from './documentEnvelope.js';
import { encodeDocumentEnvelope } from './documentEnvelopeCanonical.js';
import {
  DocumentEnvelopeRevisionError,
  createDocumentEnvelopeRevision,
  createDocumentEnvelopeRevisionBytes,
  type DocumentEnvelopeDigestProvider,
} from './documentEnvelopeRevision.js';

const DOCUMENT_JSON = {
  type: 'doc',
  content: [
    {
      type: 'paragraph',
      content: [{ type: 'text', text: 'Revision text' }],
    },
  ],
};

function toBytes(source: BufferSource): Uint8Array {
  return ArrayBuffer.isView(source)
    ? new Uint8Array(source.buffer, source.byteOffset, source.byteLength)
    : new Uint8Array(source);
}

describe('document envelope revision tags', () => {
  it('hashes canonical envelope bytes and returns a frozen strong validator', async () => {
    const envelope = createDocumentEnvelope(DOCUMENT_JSON);
    const expectedBytes = encodeDocumentEnvelope(envelope);
    const digestBytes = Uint8Array.from({ length: 32 }, (_value, index) => index);
    const digestProvider: DocumentEnvelopeDigestProvider = {
      digest: vi.fn(async (algorithm, source) => {
        expect(algorithm).toBe('SHA-256');
        expect(toBytes(source)).toEqual(expectedBytes);
        return digestBytes.buffer.slice(0);
      }),
    };

    const revision = await createDocumentEnvelopeRevision(
      envelope,
      undefined,
      digestProvider,
    );

    const digestHex =
      '000102030405060708090a0b0c0d0e0f' +
      '101112131415161718191a1b1c1d1e1f';
    expect(revision).toEqual({
      algorithm: 'SHA-256',
      digestHex,
      strongEntityTag: `"sha256-${digestHex}"`,
    });
    expect(Object.isFrozen(revision)).toBe(true);
    expect(digestProvider.digest).toHaveBeenCalledOnce();
  });

  it('normalizes noncanonical strict UTF-8 input before hashing', async () => {
    const envelope = createDocumentEnvelope(DOCUMENT_JSON);
    const canonicalBytes = encodeDocumentEnvelope(envelope);
    const noncanonicalBytes = new TextEncoder().encode(
      JSON.stringify(
        {
          schemaVersion: envelope.schemaVersion,
          documentJson: envelope.documentJson,
          schemaId: envelope.schemaId,
        },
        null,
        2,
      ),
    );
    const digestProvider: DocumentEnvelopeDigestProvider = {
      digest: vi.fn(async (_algorithm, source) => {
        expect(toBytes(source)).toEqual(canonicalBytes);
        return new Uint8Array(32).fill(0xab).buffer;
      }),
    };

    const revision = await createDocumentEnvelopeRevisionBytes(
      noncanonicalBytes,
      undefined,
      digestProvider,
    );

    expect(revision.digestHex).toBe('ab'.repeat(32));
  });

  it('uses the platform SHA-256 provider deterministically', async () => {
    const first = await createDocumentEnvelopeRevision(
      createDocumentEnvelope(DOCUMENT_JSON),
    );
    const equivalent = await createDocumentEnvelopeRevision(
      JSON.stringify(createDocumentEnvelope(DOCUMENT_JSON)),
    );
    const changed = await createDocumentEnvelopeRevision(
      createDocumentEnvelope({
        ...DOCUMENT_JSON,
        content: [
          {
            type: 'paragraph',
            content: [{ type: 'text', text: 'Changed revision' }],
          },
        ],
      }),
    );

    expect(first.digestHex).toMatch(/^[0-9a-f]{64}$/u);
    expect(first).toEqual(equivalent);
    expect(changed.digestHex).not.toBe(first.digestHex);
  });

  it('fails closed when SHA-256 is unavailable or the provider fails', async () => {
    await expect(
      createDocumentEnvelopeRevision(
        createDocumentEnvelope(DOCUMENT_JSON),
        undefined,
        null,
      ),
    ).rejects.toThrow(DocumentEnvelopeRevisionError);

    const rejectedProvider: DocumentEnvelopeDigestProvider = {
      digest: async () => {
        throw new Error('tenant-secret-value');
      },
    };
    await expect(
      createDocumentEnvelopeRevision(
        createDocumentEnvelope(DOCUMENT_JSON),
        undefined,
        rejectedProvider,
      ),
    ).rejects.toThrow('SHA-256 digest could not be created');
    try {
      await createDocumentEnvelopeRevision(
        createDocumentEnvelope(DOCUMENT_JSON),
        undefined,
        rejectedProvider,
      );
    } catch (error) {
      expect(String(error)).not.toContain('tenant-secret-value');
    }
  });

  it('rejects an invalid provider result length', async () => {
    const invalidProvider: DocumentEnvelopeDigestProvider = {
      digest: async () => new Uint8Array(31).buffer,
    };

    await expect(
      createDocumentEnvelopeRevision(
        createDocumentEnvelope(DOCUMENT_JSON),
        undefined,
        invalidProvider,
      ),
    ).rejects.toThrow('32-byte SHA-256 digest');
  });
});
