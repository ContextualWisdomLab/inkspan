import { describe, expect, it, vi } from 'vitest';

import { sniffMimeType } from './index.js';

describe('MIME sniffing runtime binary boundary', () => {
  it('rejects non-byte impostors before caller-controlled member access', () => {
    const privateSentinel = new Error('private MIME impostor sentinel');
    const readLength = vi.fn((): never => {
      throw privateSentinel;
    });
    const hostile = Object.defineProperty({}, 'length', {
      get: readLength,
    });

    expect(() => sniffMimeType(hostile as unknown as Uint8Array)).toThrow(
      TypeError,
    );
    expect(readLength).not.toHaveBeenCalled();
  });

  it('does not evaluate caller-overridden Uint8Array members', () => {
    const bytes = new Uint8Array([
      0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a,
    ]);
    const privateSentinel = new Error('private MIME byte-array sentinel');
    const readLength = vi.fn((): never => {
      throw privateSentinel;
    });
    const callSubarray = vi.fn((): never => {
      throw privateSentinel;
    });

    Object.defineProperties(bytes, {
      length: { get: readLength },
      subarray: { value: callSubarray },
    });

    expect(sniffMimeType(bytes)).toBe('image/png');
    expect(readLength).not.toHaveBeenCalled();
    expect(callSubarray).not.toHaveBeenCalled();
  });

  it('does not let a later TextDecoder replacement become MIME classification authority', () => {
    const privateSentinel = new Error('private TextDecoder sentinel');
    class HostileTextDecoder {
      constructor() {
        throw privateSentinel;
      }
    }

    vi.stubGlobal('TextDecoder', HostileTextDecoder);
    try {
      const svg = new Uint8Array([0x3c, 0x73, 0x76, 0x67, 0x3e]);
      expect(sniffMimeType(svg)).toBe('image/svg+xml');
    } finally {
      vi.unstubAllGlobals();
    }
  });
});
