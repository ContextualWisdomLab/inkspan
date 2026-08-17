import { describe, expect, it, vi } from 'vitest';

import { sanitizeRichClipboardHtml } from './SafeClipboard.js';

describe('rich clipboard size preflight', () => {
  it('rejects an obviously oversized string before allocating a UTF-8 copy', () => {
    const encodeSpy = vi.spyOn(TextEncoder.prototype, 'encode');

    try {
      expect(() =>
        sanitizeRichClipboardHtml('x'.repeat(9), { maxHtmlBytes: 8 }, document),
      ).toThrowError(
        expect.objectContaining({
          code: 'input_too_large',
          message: 'Rich clipboard HTML exceeds the configured byte limit.',
        }),
      );
      expect(encodeSpy).not.toHaveBeenCalled();
    } finally {
      encodeSpy.mockRestore();
    }
  });
});
