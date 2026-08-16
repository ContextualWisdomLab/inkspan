import { afterEach, describe, expect, it, vi } from 'vitest';
import { Base64SizeError, DataUriParseError, dataUriToBytes } from './index.js';

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

  it('rejects oversized forgiving-base64 whitespace before decoder allocation', () => {
    const decoder = vi.spyOn(globalThis.Buffer, 'from');
    let failure: unknown;

    try {
      dataUriToBytes(
        `data:application/octet-stream;base64,${'A A A A '.repeat(4)}`,
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

  it('rejects oversized canonical percent-encoded ASCII before decoding', () => {
    const decoder = vi.spyOn(globalThis, 'decodeURIComponent');
    let failure: unknown;

    try {
      dataUriToBytes(`data:text/plain,${'%41'.repeat(8)}`, { maxBytes: 4 });
    } catch (error) {
      failure = error;
    }

    expect(failure).toBeInstanceOf(Base64SizeError);
    expect((failure as Base64SizeError).bytes).toBe(8);
    expect((failure as Base64SizeError).maxBytes).toBe(4);
    expect(decoder).not.toHaveBeenCalled();
  });

  it('preserves accepted mixed literal and percent-encoded ASCII', () => {
    expect(
      Array.from(
        dataUriToBytes('data:text/plain,ab%20c', { maxBytes: 4 }).bytes,
      ),
    ).toEqual([0x61, 0x62, 0x20, 0x63]);
  });

  it('preserves Unicode percent-encoding fallback decoding', () => {
    expect(
      Array.from(
        dataUriToBytes('data:text/plain,%C3%A9', { maxBytes: 2 }).bytes,
      ),
    ).toEqual([0xc3, 0xa9]);
  });

  it('preserves malformed percent-encoding error precedence', () => {
    expect(() =>
      dataUriToBytes('data:text/plain,%ZZ', { maxBytes: 0 }),
    ).toThrow(DataUriParseError);
  });
});
