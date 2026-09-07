import { describe, expect, it } from 'vitest';

import {
  ClipboardSanitizationError,
  DEFAULT_CLIPBOARD_HTML_BYTES,
  DEFAULT_CLIPBOARD_MAX_DEPTH,
  DEFAULT_CLIPBOARD_MAX_NODES,
  SafeClipboard,
  sanitizeRichClipboardHtml,
} from './SafeClipboard.js';

describe('SafeClipboard fail-closed coverage contract', () => {
  it('redacts an unexpected inert-document operation as invalid HTML', () => {
    const hostileDocument = {
      createElement: document.createElement.bind(document),
      implementation: {
        createHTMLDocument() {
          const inertDocument = document.implementation.createHTMLDocument('');
          Object.defineProperty(inertDocument, 'createElement', {
            configurable: true,
            value() {
              throw new Error('private inert DOM implementation detail');
            },
          });
          return inertDocument;
        },
      },
    } as unknown as Document;

    expect(() =>
      sanitizeRichClipboardHtml('<p>x</p>', {}, hostileDocument),
    ).toThrowError(
      expect.objectContaining({
        code: 'invalid_html',
        message: "This content can't be inserted here. Try pasting as plain text instead.",
      }),
    );
  });

  it('uses an explicitly supplied nested clipboard configuration', () => {
    const configured = SafeClipboard.configure({
      config: {
        maxHtmlBytes: DEFAULT_CLIPBOARD_HTML_BYTES,
        maxNodes: DEFAULT_CLIPBOARD_MAX_NODES,
        maxDepth: DEFAULT_CLIPBOARD_MAX_DEPTH,
      },
      maxHtmlBytes: DEFAULT_CLIPBOARD_HTML_BYTES,
      maxNodes: DEFAULT_CLIPBOARD_MAX_NODES,
      maxDepth: DEFAULT_CLIPBOARD_MAX_DEPTH,
      document,
    });
    const transform = configured.config.transformPastedHTML?.bind({
      options: configured.options,
    } as never);

    expect(transform?.('<b>x</b>')).toBe('<strong>x</strong>');
  });

  it('keeps the redacted sanitizer error class stable', () => {
    expect(new ClipboardSanitizationError('invalid_html')).toMatchObject({
      code: 'invalid_html',
      message: "This content can't be inserted here. Try pasting as plain text instead.",
      name: 'ClipboardSanitizationError',
    });
  });
});
