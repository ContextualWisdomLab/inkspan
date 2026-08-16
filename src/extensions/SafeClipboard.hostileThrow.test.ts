import { describe, expect, it, vi } from 'vitest';

import {
  sanitizeRichClipboardHtml,
  type ClipboardConfig,
} from './SafeClipboard.js';

/**
 * Exercise the direct sanitizer boundary with a hostile configuration failure.
 * Unknown thrown values must be normalized without prototype inspection.
 */
describe('SafeClipboard sanitizer hostile thrown-value containment', () => {
  it('normalizes hostile configuration failures without prototype inspection', () => {
    const privateSentinel = new Error('private sanitizer prototype sentinel');
    const getPrototypeOf = vi.fn(() => {
      throw privateSentinel;
    });
    const hostileThrownValue = new Proxy(Object.create(null) as object, {
      getPrototypeOf,
    });
    const hostileConfig = new Proxy(Object.create(null) as ClipboardConfig, {
      ownKeys() {
        throw hostileThrownValue;
      },
    });

    let observed: unknown;
    try {
      sanitizeRichClipboardHtml('<p>private source</p>', hostileConfig, document);
    } catch (error) {
      observed = error;
    }

    expect(getPrototypeOf).not.toHaveBeenCalled();
    expect(observed).toEqual(
      expect.objectContaining({
        name: 'ClipboardSanitizationError',
        code: 'invalid_configuration',
        message: 'Rich clipboard configuration is invalid.',
      }),
    );
  });
});
