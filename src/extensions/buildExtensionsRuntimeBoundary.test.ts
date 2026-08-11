import { describe, expect, it } from 'vitest';
import { buildExtensions, type BuildExtensionsOptions } from './kit.js';

const INVALID_BUILD_EXTENSIONS_CONFIGURATION =
  'Build extensions configuration is invalid.';

describe('buildExtensions runtime configuration boundary', () => {
  it('rejects malformed top-level option containers through one stable error', () => {
    expect(() =>
      buildExtensions(null as unknown as BuildExtensionsOptions),
    ).toThrowError(new RangeError(INVALID_BUILD_EXTENSIONS_CONFIGURATION));
  });

  it('rejects accessor-backed options without evaluating the accessor', () => {
    let reads = 0;
    const options = {} as BuildExtensionsOptions;
    Object.defineProperty(options, 'image', {
      enumerable: true,
      get() {
        reads += 1;
        return { maxSizeBytes: 1_024 };
      },
    });

    expect(() => buildExtensions(options)).toThrowError(
      new RangeError(INVALID_BUILD_EXTENSIONS_CONFIGURATION),
    );
    expect(reads).toBe(0);
  });

  it('rejects unknown and symbol option keys instead of silently ignoring them', () => {
    const unknownKey = {
      maxSzieBytes: 1_024,
    } as unknown as BuildExtensionsOptions;
    expect(() => buildExtensions(unknownKey)).toThrowError(
      new RangeError(INVALID_BUILD_EXTENSIONS_CONFIGURATION),
    );

    const symbolKey = Symbol('private-build-options');
    const options: Record<PropertyKey, unknown> = {};
    options[symbolKey] = true;
    expect(() => buildExtensions(options as BuildExtensionsOptions)).toThrowError(
      new RangeError(INVALID_BUILD_EXTENSIONS_CONFIGURATION),
    );
  });
});
