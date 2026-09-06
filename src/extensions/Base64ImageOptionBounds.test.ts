import { afterEach, describe, expect, it, vi } from 'vitest';

import {
  downscaleDataUri,
  imageFileToInlineDataUri,
} from './Base64Image.js';

const PNG_BYTES = new Uint8Array([
  0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x00, 0x00, 0x00, 0x0d, 0x49,
  0x48, 0x44, 0x52, 0x00, 0x00, 0x00, 0x01, 0x00, 0x00, 0x00, 0x01, 0x08, 0x06,
  0x00, 0x00, 0x00, 0x1f, 0x15, 0xc4, 0x89,
]);

const INVALID_CONFIGURATION_MESSAGE =
  'Image processing options must use bounded numeric values.';

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe('Base64Image public processing-option boundary', () => {
  it.each([Number.NaN, -1, 1.5, Number.POSITIVE_INFINITY])(
    'rejects invalid maxSizeBytes %s before reading the source file',
    async (maxSizeBytes) => {
      const file = new File([PNG_BYTES], 'bounded.png', { type: 'image/png' });
      const arrayBuffer = vi.fn().mockRejectedValue(new Error('private file read'));
      Object.defineProperty(file, 'arrayBuffer', {
        configurable: true,
        value: arrayBuffer,
      });

      await expect(
        imageFileToInlineDataUri(file, {
          maxSizeBytes,
          maxDimension: 0,
          quality: 0.85,
        }),
      ).rejects.toMatchObject({
        name: 'RangeError',
        message: INVALID_CONFIGURATION_MESSAGE,
      });
      expect(arrayBuffer).not.toHaveBeenCalled();
    },
  );

  it.each([Number.NaN, -1, Number.POSITIVE_INFINITY])(
    'rejects invalid maxDimension %s before consulting browser image capabilities',
    async (maxDimension) => {
      vi.stubGlobal('Image', undefined);

      await expect(
        downscaleDataUri('data:image/png;base64,AAAA', maxDimension, 0.85),
      ).rejects.toMatchObject({
        name: 'RangeError',
        message: INVALID_CONFIGURATION_MESSAGE,
      });
    },
  );

  it.each([Number.NaN, -0.1, 1.1, Number.POSITIVE_INFINITY])(
    'rejects invalid quality %s before consulting browser image capabilities',
    async (quality) => {
      vi.stubGlobal('Image', undefined);

      await expect(
        downscaleDataUri('data:image/png;base64,AAAA', 100, quality),
      ).rejects.toMatchObject({
        name: 'RangeError',
        message: INVALID_CONFIGURATION_MESSAGE,
      });
    },
  );

  it('preserves zero maxDimension and boundary quality values', async () => {
    vi.stubGlobal('Image', undefined);
    const uri = 'data:image/png;base64,AAAA';

    await expect(downscaleDataUri(uri, 0, 0)).resolves.toBe(uri);
    await expect(downscaleDataUri(uri, 0, 1)).resolves.toBe(uri);
  });
});
