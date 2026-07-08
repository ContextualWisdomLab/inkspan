import { describe, it, expect, afterEach, vi } from 'vitest';
import {
  imageFileToInlineDataUri,
  downscaleDataUri,
} from './Base64Image.js';
import { Base64SizeError, bytesToDataUri } from '../converter/base64.js';

// A tiny but valid PNG so blobToDataUri produces a real data URI.
const PNG_BYTES = new Uint8Array([
  0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x00, 0x00, 0x00, 0x0d, 0x49,
  0x48, 0x44, 0x52, 0x00, 0x00, 0x00, 0x01, 0x00, 0x00, 0x00, 0x01, 0x08, 0x06,
  0x00, 0x00, 0x00, 0x1f, 0x15, 0xc4, 0x89,
]);

function pngFile(): File {
  return new File([PNG_BYTES], 'x.png', { type: 'image/png' });
}

/**
 * Install a fake `globalThis.Image` + canvas so downscaleDataUri runs its
 * re-encode branch deterministically in jsdom (which has no 2D raster backend).
 * `reencodedDataUri` is what the fake canvas returns from toDataURL.
 */
function stubCanvas(reencodedDataUri: string, dims = { width: 100, height: 100 }) {
  const OrigImage = globalThis.Image;
  const origCreate = document.createElement.bind(document);

  class FakeImage {
    width = dims.width;
    height = dims.height;
    onload: (() => void) | null = null;
    onerror: (() => void) | null = null;
    set src(_v: string) {
      queueMicrotask(() => this.onload?.());
    }
  }
  // @ts-expect-error test stub
  globalThis.Image = FakeImage;

  vi.spyOn(document, 'createElement').mockImplementation((tag: string) => {
    if (tag === 'canvas') {
      return {
        width: 0,
        height: 0,
        getContext: () => ({ drawImage: () => undefined }),
        toDataURL: () => reencodedDataUri,
      } as unknown as HTMLCanvasElement;
    }
    return origCreate(tag);
  });

  return () => {
    globalThis.Image = OrigImage;
    vi.restoreAllMocks();
  };
}

describe('downscaleDataUri', () => {
  it('is a no-op when maxDimension is 0', async () => {
    const uri = bytesToDataUri(PNG_BYTES);
    expect(await downscaleDataUri(uri, 0, 0.85)).toBe(uri);
  });
});

describe('imageFileToInlineDataUri', () => {
  afterEach(() => vi.restoreAllMocks());

  it('enforces the size guard on the source file', async () => {
    await expect(
      imageFileToInlineDataUri(pngFile(), {
        maxSizeBytes: 4,
        maxDimension: 0,
        quality: 0.85,
      }),
    ).rejects.toBeInstanceOf(Base64SizeError);
  });

  it('re-applies the size guard to the re-encoded (downscaled) output', async () => {
    // Re-encode balloons to ~1.5 KB — larger than the 512-byte limit even
    // though the source PNG is well under it.
    const big = bytesToDataUri(new Uint8Array(1536).fill(0x41), {
      mimeType: 'image/jpeg',
    });
    const restore = stubCanvas(big);
    try {
      await expect(
        imageFileToInlineDataUri(pngFile(), {
          maxSizeBytes: 512,
          maxDimension: 10,
          quality: 0.85,
        }),
      ).rejects.toBeInstanceOf(Base64SizeError);
    } finally {
      restore();
    }
  });

  it('accepts a downscaled output that fits under the size guard', async () => {
    const small = bytesToDataUri(new Uint8Array(64).fill(0x41), {
      mimeType: 'image/jpeg',
    });
    const restore = stubCanvas(small);
    try {
      const out = await imageFileToInlineDataUri(pngFile(), {
        maxSizeBytes: 4096,
        maxDimension: 10,
        quality: 0.85,
      });
      expect(out).toBe(small);
    } finally {
      restore();
    }
  });
});
