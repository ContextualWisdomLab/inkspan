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
