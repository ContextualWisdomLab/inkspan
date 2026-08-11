import { afterEach, describe, expect, it, vi } from 'vitest';
import { Base64SizeError, dataUriToBytes } from './index.js';

describe('data URI decode resource boundary', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('rejects oversized canonical base64 before decoder allocation', () => {
    const decoder = vi.spyOn(globalThis.Buffer, 'from');
    let failure: unknown;

    try {
      dataUriToBytes(
        `data:application/octet-stream;base64,${'AAAA'.repeat(4)}`,
        { maxBytes: 4 },
      );
    } catch (error) {
      failure = error;
    }

    expect(failure).toBeInstanceOf(Base64SizeError);
    expect((failure as Base64SizeError).bytes).toBe(12);
    expect((failure as Base64SizeError).maxBytes).toBe(4);
    expect(decoder).not.toHaveBeenCalled();
  });

  it('accounts for one canonical padding byte without changing accepted decode', () => {
    expect(
      dataUriToBytes('data:application/octet-stream;base64,YWI=', {
        maxBytes: 2,
      }).bytes,
    ).toEqual(new Uint8Array([0x61, 0x62]));
  });

  it('accounts for two canonical padding bytes without changing accepted decode', () => {
    expect(
      dataUriToBytes('data:application/octet-stream;base64,YQ==', {
        maxBytes: 1,
      }).bytes,
    ).toEqual(new Uint8Array([0x61]));
  });

  it('preserves noncanonical whitespace-compatible fallback decoding', () => {
    expect(
      dataUriToBytes('data:application/octet-stream;base64,Y Q ==', {
        maxBytes: 1,
      }).bytes,
    ).toEqual(new Uint8Array([0x61]));
  });
});
