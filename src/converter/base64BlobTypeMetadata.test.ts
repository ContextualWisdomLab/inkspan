import { describe, expect, it, vi } from 'vitest';
import { blobToDataUri } from './base64.js';

describe('blobToDataUri platform MIME metadata authority', () => {
  it('does not evaluate a caller-overridden Blob type accessor', async () => {
    let typeAccessorRead = false;

    class CallerControlledTypeBlob extends Blob {
      override get type(): string {
        typeAccessorRead = true;
        return 'application/x-caller-controlled';
      }
    }

    const blob = new CallerControlledTypeBlob(
      [new Uint8Array([1, 2, 3])],
      { type: 'application/octet-stream' },
    );

    const uri = await blobToDataUri(blob);

    expect(typeAccessorRead).toBe(false);
    expect(uri).toBe('data:application/octet-stream;base64,AQID');
  });

  it('rejects oversized platform MIME metadata before reading Blob bytes', async () => {
    const oversizedType = 'a'.repeat(1_025);
    const blob = new Blob([], { type: oversizedType });
    const arrayBufferRead = vi.spyOn(Blob.prototype, 'arrayBuffer');

    try {
      await expect(blobToDataUri(blob)).rejects.toThrow(
        new RangeError(
          'Blob MIME type must not exceed 1024 UTF-16 code units.',
        ),
      );
      expect(arrayBufferRead).not.toHaveBeenCalled();
    } finally {
      arrayBufferRead.mockRestore();
    }
  });

  it('preserves a platform MIME type at the local resource ceiling', async () => {
    const exactBoundaryType = 'a'.repeat(1_024);
    const blob = new Blob([], { type: exactBoundaryType });

    await expect(blobToDataUri(blob)).resolves.toBe(
      `data:${exactBoundaryType};base64,`,
    );
  });
});
