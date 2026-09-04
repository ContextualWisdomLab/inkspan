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

  it('does not evaluate a genuine Blob instance arrayBuffer override', async () => {
    let arrayBufferReads = 0;
    const blob = new Blob([new Uint8Array([1, 2, 3])], {
      type: 'application/octet-stream',
    });

    Object.defineProperty(blob, 'arrayBuffer', {
      configurable: true,
      get() {
        arrayBufferReads += 1;
        throw new Error('private Blob byte-reader sentinel');
      },
    });

    await expect(blobToDataUri(blob)).resolves.toBe(
      'data:application/octet-stream;base64,AQID',
    );
    expect(arrayBufferReads).toBe(0);
  });
});