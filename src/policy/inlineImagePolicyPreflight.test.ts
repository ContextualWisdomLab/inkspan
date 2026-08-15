import { describe, expect, it, vi } from 'vitest';

import { Base64SizeError } from '../converter/base64.js';
import {
  Base64ImageSourceError,
  validateInlineImageSource,
} from './inlineImagePolicy.js';

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

  it('rejects a provably oversized valid raster source before full-payload regex scanning', () => {
    const source = `data:image/png;base64,${'QUJD'.repeat(16_384)}`;
    const regexpTestSpy = vi.spyOn(RegExp.prototype, 'test');

    try {
      expect(() => validateInlineImageSource(source, 3)).toThrowError(
        expect.objectContaining({
          name: 'Base64SizeError',
          maxBytes: 3,
        } satisfies Partial<Base64SizeError>),
      );
      expect(
        regexpTestSpy.mock.calls.some((call) => call[0] === source),
      ).toBe(false);
    } finally {
      regexpTestSpy.mockRestore();
    }
  });

  it('preserves malformed-source precedence even when the candidate is oversized', () => {
    const source = `data:image/png;base64,${'QUJD'.repeat(16_383)}QU*D`;

    expect(() => validateInlineImageSource(source, 3)).toThrow(
      Base64ImageSourceError,
    );
  });

  it.each([
    'data:image/png;base64,AR==',
    'data:image/png;base64,AQJ=',
  ])('rejects non-canonical base64 padding bits in %s', (source) => {
    expect(() => validateInlineImageSource(source, 0)).toThrow(
      Base64ImageSourceError,
    );
  });

  it.each([
    'https://example.invalid/image.png',
    'data:image/png;base64,',
    'data:image/png;base64,AAA',
    'data:image/png;base64,AA*A',
  ])('defers in-bound malformed candidate %s to the strict source grammar', (source) => {
    expect(() => validateInlineImageSource(source, 4)).toThrow(
      Base64ImageSourceError,
    );
  });

  it('accounts for a single canonical padding byte in an in-bound valid source', () => {
    const source = 'data:image/png;base64,QUJDRAA=';

    expect(validateInlineImageSource(source, 5)).toBe(source);
    expect(() => validateInlineImageSource(source, 4)).toThrowError(
      expect.objectContaining({
        name: 'Base64SizeError',
        bytes: 5,
        maxBytes: 4,
      } satisfies Partial<Base64SizeError>),
    );
  });

  it('does not reflect a caller-controlled custom URI scheme in diagnostics', () => {
    const privateMarker = 'privatetenant42';
    const error = new Base64ImageSourceError(`${privateMarker}:opaque`);

    expect(error.sourcePreview).toBe('<scheme-redacted>');
    expect(error.message).not.toContain(privateMarker);
  });

  it('bounds diagnostic scheme inspection before regex work on untrusted source text', () => {
    const source = 'a'.repeat(65_536);
    const regexpExecSpy = vi.spyOn(RegExp.prototype, 'exec');
    let inspectedLengths: number[] = [];

    try {
      const error = new Base64ImageSourceError(source);
      inspectedLengths = regexpExecSpy.mock.calls
        .map((call) => call[0])
        .filter((value): value is string => typeof value === 'string')
        .map((value) => value.length);
      expect(error.sourcePreview).toBe('<unrecognized>');
    } finally {
      regexpExecSpy.mockRestore();
    }

    expect(Math.max(...inspectedLengths)).toBeLessThanOrEqual(64);
  });
});
