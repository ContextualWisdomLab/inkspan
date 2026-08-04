import { afterEach, describe, expect, it, vi } from 'vitest';
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

afterEach(() => {
  vi.unstubAllGlobals();
});

function toBytes(source: BufferSource): Uint8Array {
  return ArrayBuffer.isView(source)
    ? new Uint8Array(source.buffer, source.byteOffset, source.byteLength)
    : new Uint8Array(source);
}

function createDigestBuffer(fill: number): ArrayBuffer {
  const buffer = new ArrayBuffer(32);
  new Uint8Array(buffer).fill(fill);
  return buffer;
}

function createIndexedDigestBuffer(): ArrayBuffer {
  const buffer = new ArrayBuffer(32);
  const bytes = new Uint8Array(buffer);
  for (let index = 0; index < bytes.length; index += 1) {
    bytes[index] = index;
  }
  return buffer;
}

describe('document envelope revision tags', () => {
  it('hashes canonical envelope bytes and returns a frozen strong validator', async () => {
    const envelope = createDocumentEnvelope(DOCUMENT_JSON);
    const expectedBytes = encodeDocumentEnvelope(envelope);
    let receivedBytes: Uint8Array | undefined;
    const digestProvider: DocumentEnvelopeDigestProvider = {
      digest: vi.fn(async (algorithm, source) => {
        expect(algorithm).toBe('SHA-256');
        receivedBytes = new Uint8Array(toBytes(source));
        return createIndexedDigestBuffer();
      }),
    };

    const revision = await createDocumentEnvelopeRevision(
      envelope,
      undefined,
      digestProvider,
    );

    expect(Array.from(receivedBytes ?? [])).toEqual(
      Array.from(expectedBytes),
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
    let receivedBytes: Uint8Array | undefined;
    const digestProvider: DocumentEnvelopeDigestProvider = {
      digest: vi.fn(async (_algorithm, source) => {
        receivedBytes = new Uint8Array(toBytes(source));
        return createDigestBuffer(0xab);
      }),
    };

    const revision = await createDocumentEnvelopeRevisionBytes(
      noncanonicalBytes,
      undefined,
      digestProvider,
    );

    expect(Array.from(receivedBytes ?? [])).toEqual(
      Array.from(canonicalBytes),
    );
    expect(revision.digestHex).toBe('ab'.repeat(32));
  });

  it('uses the platform provider deterministically when none is injected', async () => {
    const platformProvider: DocumentEnvelopeDigestProvider = {
      digest: vi.fn(async (_algorithm, source) =>
        createDigestBuffer(toBytes(source).byteLength % 256),
      ),
    };
    vi.stubGlobal('crypto', { subtle: platformProvider });

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
    expect(platformProvider.digest).toHaveBeenCalledTimes(3);
  });

  it('fails closed when SHA-256 is unavailable or the provider fails', async () => {
    await expect(
      createDocumentEnvelopeRevision(
        createDocumentEnvelope(DOCUMENT_JSON),
        undefined,
        null,
      ),
    ).rejects.toThrow(DocumentEnvelopeRevisionError);

    vi.stubGlobal('crypto', undefined);
    await expect(
      createDocumentEnvelopeRevision(createDocumentEnvelope(DOCUMENT_JSON)),
    ).rejects.toThrow('digest provider is unavailable');

    vi.stubGlobal('crypto', {
      get subtle() {
        throw new Error('platform-secret-value');
      },
    });
    await expect(
      createDocumentEnvelopeRevision(createDocumentEnvelope(DOCUMENT_JSON)),
    ).rejects.toThrow('digest provider is unavailable');
    try {
      await createDocumentEnvelopeRevision(createDocumentEnvelope(DOCUMENT_JSON));
    } catch (error) {
      expect(String(error)).not.toContain('platform-secret-value');
    }

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

  it('rejects invalid and hostile provider results without leaking details', async () => {
    const invalidTypeProvider: DocumentEnvelopeDigestProvider = {
      digest: async () => 'not-an-array-buffer' as unknown as ArrayBuffer,
    };
    const invalidLengthProvider: DocumentEnvelopeDigestProvider = {
      digest: async () => new ArrayBuffer(31),
    };
    const spoofedArrayBufferProvider: DocumentEnvelopeDigestProvider = {
      digest: async () =>
        ({
          byteLength: 32,
          [Symbol.toStringTag]: 'ArrayBuffer',
        }) as unknown as ArrayBuffer,
    };
    const hostileResult = {
      get [Symbol.toStringTag]() {
        throw new Error('provider-secret-value');
      },
    } as unknown as ArrayBuffer;
    const hostileProvider: DocumentEnvelopeDigestProvider = {
      digest: async () => hostileResult,
    };

    for (const provider of [
      invalidTypeProvider,
      invalidLengthProvider,
      spoofedArrayBufferProvider,
      hostileProvider,
    ]) {
      await expect(
        createDocumentEnvelopeRevision(
          createDocumentEnvelope(DOCUMENT_JSON),
          undefined,
          provider,
        ),
      ).rejects.toThrow('32-byte SHA-256 digest');
    }
    try {
      await createDocumentEnvelopeRevision(
        createDocumentEnvelope(DOCUMENT_JSON),
        undefined,
        hostileProvider,
      );
    } catch (error) {
      expect(String(error)).not.toContain('provider-secret-value');
    }
  });
});
