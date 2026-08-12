import { describe, expect, it, vi } from 'vitest';

import { Base64SizeError } from '../converter/base64.js';
import { validateInlineImageSource } from './inlineImagePolicy.js';

const OVERSIZED_IMAGE = 'data:image/png;base64,QUJDRA==';

describe('inline image decoded-size preflight', () => {
  it('rejects an oversized valid image without decoding its base64 payload', () => {
    const decodeSpy = vi.spyOn(globalThis.Buffer, 'from');

    try {
      expect(() => validateInlineImageSource(OVERSIZED_IMAGE, 3)).toThrowError(
        expect.objectContaining({
          name: 'Base64SizeError',
          bytes: 4,
          maxBytes: 3,
        } satisfies Partial<Base64SizeError>),
      );
      expect(
        decodeSpy.mock.calls.some((call) => {
          const args = call as unknown as readonly unknown[];
          return args[0] === 'QUJDRA==' && args[1] === 'base64';
        }),
      ).toBe(false);
    } finally {
      decodeSpy.mockRestore();
    }
  });

  it.each([Number.NaN, -1, 1.5, Number.POSITIVE_INFINITY])(
    'rejects malformed public byte limit %s instead of weakening the resource policy',
    (maxSizeBytes) => {
      expect(() => validateInlineImageSource(OVERSIZED_IMAGE, maxSizeBytes)).toThrowError(
        new RangeError('inline image byte limit must be a non-negative safe integer'),
      );
    },
  );

  it('rejects an unusable byte limit before scanning caller-controlled image source text', () => {
    const source = 'data:image/png;base64,QUJDRA==';
    const regexpTestSpy = vi.spyOn(RegExp.prototype, 'test');

    try {
      expect(() => validateInlineImageSource(source, Number.NaN)).toThrowError(
        new RangeError('inline image byte limit must be a non-negative safe integer'),
      );
      expect(
        regexpTestSpy.mock.calls.some((call) => call[0] === source),
      ).toBe(false);
    } finally {
      regexpTestSpy.mockRestore();
    }
  });
});
