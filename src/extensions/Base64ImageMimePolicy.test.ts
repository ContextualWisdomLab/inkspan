import { describe, expect, it } from 'vitest';
import {
  Base64ImageSourceError,
  imageFileToInlineDataUri,
} from './Base64Image.js';

describe('image file MIME policy', () => {
  it('rejects active-vector image files before decoder use', async () => {
    const svg = new Blob(
      ['<svg xmlns="http://www.w3.org/2000/svg"><image href="https://tracker.example/pixel.png" /></svg>'],
      { type: 'image/svg+xml' },
    );

    await expect(
      imageFileToInlineDataUri(svg, {
        maxSizeBytes: 1024,
        maxDimension: 1600,
        quality: 0.85,
      }),
    ).rejects.toBeInstanceOf(Base64ImageSourceError);
  });

  it('accepts a supported raster file when downscaling is disabled', async () => {
    const png = new Blob([new Uint8Array([1, 2, 3])], {
      type: 'image/png',
    });

    await expect(
      imageFileToInlineDataUri(png, {
        maxSizeBytes: 1024,
        maxDimension: 0,
        quality: 0.85,
      }),
    ).resolves.toBe('data:image/png;base64,AQID');
  });
});
