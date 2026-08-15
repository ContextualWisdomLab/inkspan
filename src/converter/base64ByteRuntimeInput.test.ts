import { describe, expect, it } from 'vitest';

import { bytesToBase64, bytesToDataUri } from './index.js';

const INVALID_BINARY_INPUT_MESSAGE = 'converter binary input is invalid.';

describe('bytesToBase64 runtime byte input', () => {
  it('rejects a byte-array impostor before reading caller-controlled members', () => {
    let bufferReads = 0;
    const hostile = Object.create(null) as Record<PropertyKey, unknown>;
    Object.defineProperty(hostile, 'buffer', {
      configurable: true,
      enumerable: true,
      get() {
        bufferReads += 1;
        throw new Error('private-byte-buffer-sentinel');
      },
    });

    expect(() => bytesToBase64(hostile as unknown as Uint8Array)).toThrowError(
      new TypeError(INVALID_BINARY_INPUT_MESSAGE),
    );
    expect(bufferReads).toBe(0);
  });

  it('uses platform byte-array slots instead of shadowed range accessors', () => {
    const bytes = new Uint8Array([0x66, 0x6f, 0x6f]);
    let bufferReads = 0;
    let byteOffsetReads = 0;
    let byteLengthReads = 0;

    Object.defineProperties(bytes, {
      buffer: {
        configurable: true,
        get() {
          bufferReads += 1;
          throw new Error('private-byte-buffer-sentinel');
        },
      },
      byteOffset: {
        configurable: true,
        get() {
          byteOffsetReads += 1;
          throw new Error('private-byte-offset-sentinel');
        },
      },
      byteLength: {
        configurable: true,
        get() {
          byteLengthReads += 1;
          throw new Error('private-byte-length-sentinel');
        },
      },
    });

    expect(bytesToBase64(bytes)).toBe('Zm9v');
    expect(bufferReads).toBe(0);
    expect(byteOffsetReads).toBe(0);
    expect(byteLengthReads).toBe(0);
  });

  it('does not re-enter shadowed byte-length metadata in data-URI encoding', () => {
    const bytes = new Uint8Array([0x66, 0x6f, 0x6f]);
    let byteLengthReads = 0;

    Object.defineProperty(bytes, 'byteLength', {
      configurable: true,
      get() {
        byteLengthReads += 1;
        throw new Error('private-byte-length-sentinel');
      },
    });

    expect(
      bytesToDataUri(bytes, {
        mimeType: 'application/octet-stream',
        maxBytes: 3,
      }),
    ).toBe('data:application/octet-stream;base64,Zm9v');
    expect(byteLengthReads).toBe(0);
  });
});
