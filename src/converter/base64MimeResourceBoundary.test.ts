import { describe, expect, it, vi } from 'vitest';
import { blobToDataUri, bytesToDataUri } from './index.js';

const MAX_MIME_TYPE_CODE_UNITS = 1_024;
const MIME_LIMIT_ERROR = new RangeError(
  'mimeType must not exceed 1024 UTF-16 code units.',
);

function oversizedMimeType(): string {
  return 'x'.repeat(MAX_MIME_TYPE_CODE_UNITS + 1);
}

describe('converter MIME override resource boundary', () => {
  it('rejects oversized explicit MIME metadata before output materialization', () => {
    expect(() =>
      bytesToDataUri(new Uint8Array(), { mimeType: oversizedMimeType() }),
    ).toThrowError(MIME_LIMIT_ERROR);
  });

  it('rejects an oversized Blob MIME override before reading payload bytes', async () => {
    const reader = vi.spyOn(FileReader.prototype, 'readAsArrayBuffer');

    try {
      await expect(
        blobToDataUri(new Blob([new Uint8Array([0x61])]), {
          mimeType: oversizedMimeType(),
        }),
      ).rejects.toThrowError(MIME_LIMIT_ERROR);
      expect(reader).not.toHaveBeenCalled();
    } finally {
      reader.mockRestore();
    }
  });

  it('preserves explicit MIME metadata at the exact local ceiling', () => {
    const mimeType = 'x'.repeat(MAX_MIME_TYPE_CODE_UNITS);

    expect(bytesToDataUri(new Uint8Array(), { mimeType })).toBe(
      `data:${mimeType};base64,`,
    );
  });
});
