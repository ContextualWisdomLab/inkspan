import { describe, expect, it } from 'vitest';
import { buildExtensions, type BuildExtensionsOptions } from './kit.js';

const INVALID_BUILD_EXTENSIONS_CONFIGURATION =
  'Build extensions configuration is invalid.';

function expectInvalidBuildExtensionsOptions(options: unknown): void {
  expect(() =>
    buildExtensions(options as BuildExtensionsOptions),
  ).toThrowError(new RangeError(INVALID_BUILD_EXTENSIONS_CONFIGURATION));
}

describe('buildExtensions runtime configuration boundary', () => {
  it.each([null, [], 'invalid', 0, false])(
    'rejects malformed top-level option container %p through one stable error',
    (options) => {
      expectInvalidBuildExtensionsOptions(options);
    },
  );

  it('redacts revoked top-level proxy shape failures', () => {
    const { proxy: options, revoke } = Proxy.revocable({}, {});
    revoke();

    expectInvalidBuildExtensionsOptions(options);
  });

  it('redacts revoked image proxy shape failures', () => {
    const { proxy: image, revoke } = Proxy.revocable({}, {});
    revoke();

    expect(() => buildExtensions({ image })).toThrowError(
      new RangeError('Image configuration is invalid.'),
    );
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

    expectInvalidBuildExtensionsOptions(options);
    expect(reads).toBe(0);
  });

  it('rejects non-enumerable top-level option properties', () => {
    const options = {} as BuildExtensionsOptions;
    Object.defineProperty(options, 'disableHistory', {
      enumerable: false,
      value: true,
    });

    expectInvalidBuildExtensionsOptions(options);
  });

  it('rejects unknown and symbol option keys instead of silently ignoring them', () => {
    expectInvalidBuildExtensionsOptions({ maxSzieBytes: 1_024 });

    const symbolKey = Symbol('private-build-options');
    const options: Record<PropertyKey, unknown> = {};
    options[symbolKey] = true;
    expectInvalidBuildExtensionsOptions(options);
  });

  it('redacts hostile own-key reflection failures', () => {
    const options = new Proxy(
      {},
      {
        ownKeys() {
          throw new Error('private build-options own-key detail');
        },
      },
    );

    expectInvalidBuildExtensionsOptions(options);
  });

  it('redacts hostile property-descriptor reflection failures', () => {
    const options = new Proxy(
      {},
      {
        ownKeys() {
          return ['image'];
        },
        getOwnPropertyDescriptor() {
          throw new Error('private build-options descriptor detail');
        },
      },
    );

    expectInvalidBuildExtensionsOptions(options);
  });

  it('rejects a reported option key without an own descriptor', () => {
    const options = new Proxy(
      {},
      {
        ownKeys() {
          return ['image'];
        },
        getOwnPropertyDescriptor() {
          return undefined;
        },
      },
    );

    expectInvalidBuildExtensionsOptions(options);
  });
});
