import { afterEach, describe, expect, it, vi } from 'vitest';
import { htmlToMarkdown } from './serializer.js';
import {
  MAXIMUM_HTML_TO_MARKDOWN_MAX_BYTES,
} from './htmlToMarkdownResourcePolicy.js';

afterEach(() => {
  vi.restoreAllMocks();
});

describe('HTML-to-Markdown resource bounds', () => {
  it('rejects obvious oversize before UTF-8 encoding or browser parser materialization', () => {
    const encode = vi.spyOn(TextEncoder.prototype, 'encode');
    const createElement = vi.spyOn(document, 'createElement');
    let failure: unknown;

    try {
      htmlToMarkdown('<p>12345</p>', { maxHtmlBytes: 4 });
    } catch (error) {
      failure = error;
    }

    expect(encode).not.toHaveBeenCalled();
    expect(createElement).not.toHaveBeenCalledWith('template');
    expect(failure).toMatchObject({
      name: 'HtmlToMarkdownResourceError',
      code: 'input_too_large',
      message: 'HTML-to-Markdown input exceeds the configured byte limit.',
    });
  });

  it('uses exact UTF-8 bytes when code-unit length alone does not prove oversize', () => {
    const createElement = vi.spyOn(document, 'createElement');

    expect(() => htmlToMarkdown('é', { maxHtmlBytes: 1 })).toThrowError(
      expect.objectContaining({
        name: 'HtmlToMarkdownResourceError',
        code: 'input_too_large',
      }),
    );
    expect(createElement).not.toHaveBeenCalledWith('template');
  });

  it('accepts input exactly at the configured UTF-8 ceiling', () => {
    expect(htmlToMarkdown('<p>x</p>', { maxHtmlBytes: 8 })).toBe('x');
  });

  it.each([
    ['wrong type', '4'],
    ['fractional', 1.5],
    ['zero', 0],
    ['above hard maximum', MAXIMUM_HTML_TO_MARKDOWN_MAX_BYTES + 1],
  ])('fails closed for %s resource configuration', (_label, maxHtmlBytes) => {
    const secret = '<p>private-content</p>';
    let failure: unknown;

    try {
      htmlToMarkdown(secret, { maxHtmlBytes } as never);
    } catch (error) {
      failure = error;
    }

    expect(failure).toMatchObject({
      name: 'HtmlToMarkdownResourceError',
      code: 'invalid_configuration',
      message: 'HTML-to-Markdown resource configuration is invalid.',
    });
    expect(String(failure)).not.toContain(secret);
  });

  it('accepts the hard maximum without changing ordinary conversion semantics', () => {
    expect(
      htmlToMarkdown('<strong>safe</strong>', {
        maxHtmlBytes: MAXIMUM_HTML_TO_MARKDOWN_MAX_BYTES,
      }),
    ).toBe('**safe**');
  });
});
