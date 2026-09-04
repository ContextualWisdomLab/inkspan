import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  SafeLinkHrefError,
  validateSafeLinkHref,
} from './SafeLink.js';

type RuntimeSafeLinkOptions = {
  readonly maxHrefBytes?: number;
};

const validateWithOptions = validateSafeLinkHref as unknown as (
  href: unknown,
  options?: RuntimeSafeLinkOptions,
) => string;

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('safe-link resource consolidation', () => {
  it('rejects an obviously oversized web target before URL construction', () => {
    const urlConstructor = vi.fn(() => {
      throw new Error('URL parser must not run for an obvious oversize target');
    });
    vi.stubGlobal('URL', urlConstructor);

    let failure: unknown;
    try {
      validateWithOptions('https://example.com/path', { maxHrefBytes: 8 });
    } catch (error) {
      failure = error;
    }

    expect(failure).toBeInstanceOf(SafeLinkHrefError);
    expect(failure).toMatchObject({
      code: 'input_too_large',
      hrefPreview: '<oversized>',
    });
    expect(urlConstructor).not.toHaveBeenCalled();
  });

  it('rejects unknown runtime option keys instead of silently defaulting', () => {
    expect(() =>
      validateWithOptions(
        'https://example.com/',
        { maxHREFBytes: 8 } as unknown as RuntimeSafeLinkOptions,
      ),
    ).toThrowError(
      expect.objectContaining({
        code: 'invalid_configuration',
        hrefPreview: '<configuration>',
      }),
    );
  });

  it('rejects accessor-backed options without evaluating the accessor', () => {
    let getterCalls = 0;
    const options = {};
    Object.defineProperty(options, 'maxHrefBytes', {
      enumerable: true,
      get() {
        getterCalls += 1;
        throw new Error('private option getter detail');
      },
    });

    expect(() =>
      validateWithOptions(
        'https://example.com/',
        options as RuntimeSafeLinkOptions,
      ),
    ).toThrowError(
      expect.objectContaining({
        code: 'invalid_configuration',
        hrefPreview: '<configuration>',
      }),
    );
    expect(getterCalls).toBe(0);
  });
});
