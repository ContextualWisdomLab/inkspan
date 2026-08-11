import { describe, expect, it } from 'vitest';
import { buildExtensions } from './kit.js';

describe('runtime image configuration', () => {
  it.each([
    ['maxSizeBytes', Number.NaN],
    ['maxSizeBytes', -1],
    ['maxSizeBytes', 1.5],
    ['maxDimension', Number.POSITIVE_INFINITY],
    ['maxDimension', -1],
    ['maxDimension', 1.5],
  ] as const)('rejects invalid %s values before extension setup', (key, value) => {
    expect(() =>
      buildExtensions({
        image: { [key]: value } as never,
      }),
    ).toThrowError(new RangeError(`Image ${key} configuration is invalid.`));
  });

  it.each([Number.NaN, Number.NEGATIVE_INFINITY, -0.1, 1.1])(
    'rejects invalid quality %s before extension setup',
    (quality) => {
      expect(() =>
        buildExtensions({ image: { quality } }),
      ).toThrowError(new RangeError('Image quality configuration is invalid.'));
    },
  );

  it.each([null, [], 'invalid', 0, false])(
    'rejects malformed image configuration containers without coercion',
    (image) => {
      expect(() => buildExtensions({ image: image as never })).toThrowError(
        new RangeError('Image configuration is invalid.'),
      );
    },
  );

  it('rejects accessor-backed image configuration without evaluating the accessor', () => {
    let reads = 0;
    const image = {};
    Object.defineProperty(image, 'maxSizeBytes', {
      enumerable: true,
      get() {
        reads += 1;
        return 1024;
      },
    });

    expect(() => buildExtensions({ image })).toThrowError(
      new RangeError('Image configuration is invalid.'),
    );
    expect(reads).toBe(0);
  });

  it('rejects non-enumerable image configuration data properties', () => {
    const image = {};
    Object.defineProperty(image, 'quality', {
      enumerable: false,
      value: 0.8,
    });

    expect(() => buildExtensions({ image })).toThrowError(
      new RangeError('Image configuration is invalid.'),
    );
  });

  it('rejects unknown runtime configuration keys instead of silently weakening policy', () => {
    const image = {
      maxSizeBytes: 1024,
      maxSzieBytes: 16,
    } as never;

    expect(() => buildExtensions({ image })).toThrowError(
      new RangeError('Image configuration is invalid.'),
    );
  });

  it('rejects own symbol configuration keys without reflecting their identity', () => {
    const privatePolicyKey = Symbol('private-policy-key');
    const image: Record<PropertyKey, unknown> = { maxSizeBytes: 1024 };
    image[privatePolicyKey] = 16;

    expect(() => buildExtensions({ image: image as never })).toThrowError(
      new RangeError('Image configuration is invalid.'),
    );
  });

  it('redacts own-key reflection failures at the image configuration boundary', () => {
    const image = new Proxy(
      {},
      {
        ownKeys() {
          throw new Error('private own-key reflection detail');
        },
      },
    );

    expect(() => buildExtensions({ image })).toThrowError(
      new RangeError('Image configuration is invalid.'),
    );
  });

  it('redacts reflection failures at the image configuration boundary', () => {
    const image = new Proxy(
      {},
      {
        getOwnPropertyDescriptor() {
          throw new Error('private reflection detail');
        },
      },
    );

    expect(() => buildExtensions({ image })).toThrowError(
      new RangeError('Image configuration is invalid.'),
    );
  });

  it('preserves valid disabled and boundary configuration', () => {
    const image = buildExtensions({
      image: { maxSizeBytes: 0, maxDimension: 0, quality: 1 },
    }).find((extension) => extension.name === 'image');

    expect(image?.options.maxSizeBytes).toBe(0);
    expect(image?.options.maxDimension).toBe(0);
    expect(image?.options.quality).toBe(1);
  });
});
