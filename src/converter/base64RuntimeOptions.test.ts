import { describe, expect, it, vi } from 'vitest';
import { blobToDataUri, bytesToDataUri, dataUriToBytes } from './index.js';

const INVALID_MAX_BYTES = [
  -1,
  Number.NaN,
  Number.POSITIVE_INFINITY,
  0.5,
  Number.MAX_SAFE_INTEGER + 1,
  '4',
] as const;

function runtimeOptions(maxBytes: unknown): { maxBytes?: number } {
  return { maxBytes } as { maxBytes?: number };
}

describe('base64 converter runtime maxBytes contract', () => {
  it.each(INVALID_MAX_BYTES)(
    'rejects invalid maxBytes %j before encoding raw bytes',
    (maxBytes) => {
      expect(() =>
        bytesToDataUri(new Uint8Array([0x61]), runtimeOptions(maxBytes)),
      ).toThrowError(new RangeError('maxBytes must be a non-negative safe integer.'));
    },
  );

  it('rejects an invalid Blob maxBytes before reading payload bytes', async () => {
    const reader = vi.spyOn(FileReader.prototype, 'readAsArrayBuffer');

    await expect(
      blobToDataUri(new Blob([new Uint8Array([0x61])]), runtimeOptions(Number.NaN)),
    ).rejects.toThrowError(
      new RangeError('maxBytes must be a non-negative safe integer.'),
    );
    expect(reader).not.toHaveBeenCalled();
  });

  it('rejects an invalid decode maxBytes before parsing or decoding payload text', () => {
    const decoder = vi.spyOn(globalThis.Buffer, 'from');

    expect(() =>
      dataUriToBytes(
        'data:application/octet-stream;base64,YQ==',
        runtimeOptions(Number.POSITIVE_INFINITY),
      ),
    ).toThrowError(new RangeError('maxBytes must be a non-negative safe integer.'));
    expect(decoder).not.toHaveBeenCalled();
  });

  it('preserves zero and finite safe-integer ceilings', () => {
    expect(bytesToDataUri(new Uint8Array(), { maxBytes: 0 })).toContain(';base64,');
    expect(() =>
      dataUriToBytes('data:text/plain,a', { maxBytes: 1 }),
    ).not.toThrow();
  });
});

describe('base64 converter runtime option containers', () => {
  const invalidOptions = () =>
    new RangeError('converter options are invalid.');

  it.each([
    null,
    [],
    { maxByte: 0 },
    { [Symbol('unknown')]: 0 },
    Object.create({ maxBytes: 0 }) as object,
  ])('rejects malformed encode option containers without coercion', (options) => {
    expect(() =>
      bytesToDataUri(
        new Uint8Array([0x61]),
        options as unknown as { maxBytes?: number },
      ),
    ).toThrowError(invalidOptions());
  });

  it('rejects accessor-backed maxBytes without invoking the getter', () => {
    let reads = 0;
    const options = {} as { maxBytes?: number };
    Object.defineProperty(options, 'maxBytes', {
      enumerable: true,
      get() {
        reads += 1;
        throw new Error('private maxBytes getter failure');
      },
    });

    expect(() =>
      bytesToDataUri(new Uint8Array([0x61]), options),
    ).toThrowError(invalidOptions());
    expect(reads).toBe(0);
  });

  it('rejects non-enumerable option properties', () => {
    const options = {} as { maxBytes?: number };
    Object.defineProperty(options, 'maxBytes', {
      enumerable: false,
      value: 1,
    });

    expect(() =>
      bytesToDataUri(new Uint8Array([0x61]), options),
    ).toThrowError(invalidOptions());
  });

  it('rejects malformed decode option containers before URI parsing', () => {
    expect(() =>
      dataUriToBytes('not-a-data-uri', {
        maxByte: 0,
      } as unknown as { maxBytes?: number }),
    ).toThrowError(invalidOptions());
  });

  it('rejects non-string runtime MIME overrides', () => {
    expect(() =>
      bytesToDataUri(new Uint8Array([0x61]), {
        mimeType: 7,
      } as unknown as { mimeType?: string }),
    ).toThrowError(new RangeError('mimeType must be a string.'));
  });

  it('preserves exact data-property values on null-prototype option objects', () => {
    const options = Object.create(null) as {
      mimeType?: string;
      maxBytes?: number;
    };
    Object.defineProperties(options, {
      mimeType: { enumerable: true, value: 'application/x-thing' },
      maxBytes: { enumerable: true, value: 1 },
    });

    expect(bytesToDataUri(new Uint8Array([0x61]), options)).toBe(
      'data:application/x-thing;base64,YQ==',
    );
  });
});
