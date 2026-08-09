import { afterEach, describe, expect, it, vi } from 'vitest';
import { sanitizeRichClipboardHtml } from './SafeClipboard.js';

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('SafeClipboard ambient DOM boundary', () => {
  it('fails closed when no explicit or ambient DOM document exists', () => {
    vi.stubGlobal('document', undefined);

    expect(() => sanitizeRichClipboardHtml('<p>x</p>')).toThrowError(
      expect.objectContaining({
        code: 'dom_unavailable',
        message: 'Rich clipboard sanitization requires a DOM-capable document.',
      }),
    );
  });
});
