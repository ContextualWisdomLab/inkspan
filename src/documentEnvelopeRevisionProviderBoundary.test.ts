import { afterEach, describe, expect, it, vi } from 'vitest';
import { createDocumentEnvelope } from './documentEnvelope.js';
import {
  createDocumentEnvelopeRevision,
  type DocumentEnvelopeDigestProvider,
} from './documentEnvelopeRevision.js';

const ENVELOPE = createDocumentEnvelope({
  type: 'doc',
  content: [
    {
      type: 'paragraph',
      content: [{ type: 'text', text: 'Digest provider boundary' }],
    },
  ],
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe('document revision digest-provider capability boundary', () => {
  it('rejects a non-callable injected digest before canonical byte encoding', async () => {
    const encode = vi.spyOn(TextEncoder.prototype, 'encode');
    const provider = { digest: 7 } as unknown as DocumentEnvelopeDigestProvider;

    await expect(
      createDocumentEnvelopeRevision(ENVELOPE, undefined, provider),
    ).rejects.toThrow('Document envelope SHA-256 digest could not be created');

    expect(encode).not.toHaveBeenCalled();
  });

  it('redacts a hostile digest capability lookup before canonical byte encoding', async () => {
    const encode = vi.spyOn(TextEncoder.prototype, 'encode');
    let digestReads = 0;
    const provider = {} as DocumentEnvelopeDigestProvider;
    Object.defineProperty(provider, 'digest', {
      get() {
        digestReads += 1;
        throw new Error('private digest capability detail');
      },
    });

    await expect(
      createDocumentEnvelopeRevision(ENVELOPE, undefined, provider),
    ).rejects.toThrow('Document envelope SHA-256 digest could not be created');

    expect(digestReads).toBe(1);
    expect(encode).not.toHaveBeenCalled();
  });

  it('resolves an accessor-backed callable once and preserves its receiver', async () => {
    let digestReads = 0;
    const digestResult = new ArrayBuffer(32);
    const provider = {} as DocumentEnvelopeDigestProvider;
    Object.defineProperty(provider, 'digest', {
      get() {
        digestReads += 1;
        return function digest(
          this: DocumentEnvelopeDigestProvider,
          algorithm: 'SHA-256',
          source: BufferSource,
        ): Promise<ArrayBuffer> {
          expect(this).toBe(provider);
          expect(algorithm).toBe('SHA-256');
          expect(ArrayBuffer.isView(source)).toBe(true);
          return Promise.resolve(digestResult);
        };
      },
    });

    const revision = await createDocumentEnvelopeRevision(
      ENVELOPE,
      undefined,
      provider,
    );

    expect(digestReads).toBe(1);
    expect(revision.digestHex).toBe('00'.repeat(32));
  });
});
