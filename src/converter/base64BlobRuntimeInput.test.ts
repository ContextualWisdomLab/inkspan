import { describe, expect, it } from 'vitest';
import { blobToDataUri } from './base64.js';

describe('blobToDataUri runtime Blob boundary', () => {
  it('rejects non-Blob values before reading caller-controlled Blob-like properties', async () => {
    let sizeReads = 0;
    let typeReads = 0;
    const hostileBlobLike = Object.create(null) as Record<PropertyKey, unknown>;

    Object.defineProperties(hostileBlobLike, {
      size: {
        configurable: true,
        get() {
          sizeReads += 1;
          throw new Error('caller-controlled size getter executed');
        },
      },
      type: {
        configurable: true,
        get() {
          typeReads += 1;
          throw new Error('caller-controlled type getter executed');
        },
      },
      [Symbol.toStringTag]: {
        configurable: true,
        value: 'Blob',
      },
    });

    await expect(
      blobToDataUri(hostileBlobLike as unknown as Blob),
    ).rejects.toThrowError(TypeError);
    expect(sizeReads).toBe(0);
    expect(typeReads).toBe(0);
  });
});
