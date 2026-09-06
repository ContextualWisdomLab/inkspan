import { afterEach, describe, expect, it, vi } from 'vitest';
import { Lexer } from 'marked';
import {
  htmlToPlainText,
  markdownToPlainText,
} from './plainText.js';
import { MAXIMUM_MARKDOWN_TO_HTML_MAX_BYTES } from './markdownToHtmlResourcePolicy.js';

afterEach(() => {
  vi.restoreAllMocks();
});

describe('plain-text Markdown resource bounds', () => {
  it('rejects oversized Markdown before Marked lexer materialization', () => {
    const lex = vi.spyOn(Lexer, 'lex');
    let failure: unknown;

    try {
      markdownToPlainText('12345', { maxMarkdownBytes: 4 });
    } catch (error) {
      failure = error;
    }

    expect(lex).not.toHaveBeenCalled();
    expect(failure).toMatchObject({
      name: 'MarkdownToHtmlResourceError',
      code: 'input_too_large',
      message: 'Markdown-to-HTML input exceeds the configured byte limit.',
    });
  });

  it('uses exact UTF-8 bytes when code-unit length alone does not prove oversize', () => {
    const lex = vi.spyOn(Lexer, 'lex');

    expect(() =>
      markdownToPlainText('é', { maxMarkdownBytes: 1 }),
    ).toThrowError(
      expect.objectContaining({
        name: 'MarkdownToHtmlResourceError',
        code: 'input_too_large',
      }),
    );
    expect(lex).not.toHaveBeenCalled();
  });

  it('accepts Markdown exactly at the configured UTF-8 ceiling', () => {
    expect(markdownToPlainText('é', { maxMarkdownBytes: 2 })).toBe('é');
  });

  it.each([
    ['wrong type', '4'],
    ['fractional', 1.5],
    ['zero', 0],
    ['above hard maximum', MAXIMUM_MARKDOWN_TO_HTML_MAX_BYTES + 1],
  ])('fails closed for %s Markdown resource configuration', (_label, maxMarkdownBytes) => {
    const secret = 'private-markdown';
    let failure: unknown;

    try {
      // Invalid runtime configuration is intentionally forced past TypeScript
      // so the public fail-closed validation remains regression-tested.
      markdownToPlainText(secret, { maxMarkdownBytes } as never);
    } catch (error) {
      failure = error;
    }

    expect(failure).toMatchObject({
      name: 'MarkdownToHtmlResourceError',
      code: 'invalid_configuration',
      message: 'Markdown-to-HTML resource configuration is invalid.',
    });
    expect(String(failure)).not.toContain(secret);
  });

  it('forwards the HTML parser ceiling before HTML normalization', () => {
    expect(() =>
      htmlToPlainText('<p>hello</p>', { maxHtmlBytes: 4 }),
    ).toThrowError(
      expect.objectContaining({
        name: 'HtmlToMarkdownResourceError',
        code: 'input_too_large',
      }),
    );
  });

  it('bounds generated Markdown before the plain-text lexer', () => {
    const lex = vi.spyOn(Lexer, 'lex');

    expect(() =>
      htmlToPlainText('<p>hello</p>', {
        maxHtmlBytes: 32,
        maxMarkdownBytes: 4,
      }),
    ).toThrowError(
      expect.objectContaining({
        name: 'MarkdownToHtmlResourceError',
        code: 'input_too_large',
      }),
    );
    expect(lex).not.toHaveBeenCalled();
  });
});
