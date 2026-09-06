import { describe, expect, it, vi } from 'vitest';
import {
  DocumentEnvelopeError,
  createDocumentEnvelope,
} from './documentEnvelope.js';
import { encodeDocumentEnvelope } from './documentEnvelopeCanonical.js';

const ENVELOPE = createDocumentEnvelope({
  type: 'doc',
  content: [
    {
      type: 'paragraph',
      content: [{ type: 'text', text: 'Canonical output boundary' }],
    },
  ],
});

type RuntimeEncodingOptions = {
  readonly maxUtf8Bytes?: number;
};

const encodeWithOptions = encodeDocumentEnvelope as unknown as (
  source: unknown,
  options?: RuntimeEncodingOptions,
) => Uint8Array<ArrayBuffer>;

describe('canonical envelope encoding consolidation', () => {
  it('rejects an impossible output ceiling before UTF-8 allocation', () => {
    const encode = vi.spyOn(TextEncoder.prototype, 'encode');

    expect(() =>
      encodeWithOptions(ENVELOPE, { maxUtf8Bytes: 1 }),
    ).toThrowError(
      new DocumentEnvelopeError(
        'Canonical document envelope exceeds the configured UTF-8 byte limit',
      ),
    );
    expect(encode).not.toHaveBeenCalled();
  });

  it('rejects unknown runtime option keys instead of silently defaulting', () => {
    expect(() =>
      encodeWithOptions(
        ENVELOPE,
        { maxUTF8Bytes: 1024 } as unknown as RuntimeEncodingOptions,
      ),
    ).toThrowError(
      new DocumentEnvelopeError(
        'Canonical document envelope encoding options are invalid',
      ),
    );
  });

  it('rejects accessor-backed options without evaluating the accessor', () => {
    let getterCalls = 0;
    const options = {};
    Object.defineProperty(options, 'maxUtf8Bytes', {
      enumerable: true,
      get() {
        getterCalls += 1;
        throw new Error('private option getter detail');
      },
    });

    expect(() =>
      encodeWithOptions(ENVELOPE, options as RuntimeEncodingOptions),
    ).toThrowError(
      new DocumentEnvelopeError(
        'Canonical document envelope encoding options are invalid',
      ),
    );
    expect(getterCalls).toBe(0);
  });
});
