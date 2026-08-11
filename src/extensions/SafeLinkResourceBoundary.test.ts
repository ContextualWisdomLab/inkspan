import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  SafeLinkHrefError,
  validateSafeLinkHref,
} from './SafeLink.js';

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('safe-link resource boundary', () => {
  it('rejects an obviously oversized web target before URL construction', () => {
    const urlConstructor = vi.fn(() => {
      throw new Error('URL parser must not run for an obvious oversize target');
    });
    vi.stubGlobal('URL', urlConstructor);

    let error: unknown;
    try {
      validateSafeLinkHref('https://example.com/path', { maxHrefBytes: 8 });
    } catch (caught) {
      error = caught;
    }

    expect(error).toBeInstanceOf(SafeLinkHrefError);
    expect(error).toMatchObject({
      code: 'input_too_large',
      hrefPreview: '<oversized>',
    });
    expect(urlConstructor).not.toHaveBeenCalled();
  });
});
