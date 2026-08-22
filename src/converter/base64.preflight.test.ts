import { describe, expect, it, vi } from 'vitest';
import { Base64SizeError, blobToDataUri } from './index.js';

describe('Blob size preflight', () => {
  it('rejects an oversized Blob before reading payload bytes', async () => {
    const blob = new Blob([new Uint8Array(8)], {
      type: 'application/octet-stream',
    });
    const readSpy = vi.spyOn(FileReader.prototype, 'readAsArrayBuffer');

    await expect(blobToDataUri(blob, { maxBytes: 4 })).rejects.toBeInstanceOf(
      Base64SizeError,
    );
    expect(readSpy).not.toHaveBeenCalled();
  });
});
