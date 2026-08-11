import { afterEach, describe, expect, it, vi } from 'vitest';
import { Lexer } from 'marked';
import {
  markdownToEditorHtml,
  markdownToHtml,
} from './resourceBoundMarkdown.js';
import {
  DEFAULT_MARKDOWN_TO_HTML_MAX_BYTES,
  MAXIMUM_MARKDOWN_TO_HTML_MAX_BYTES,
} from './markdownToHtmlResourcePolicy.js';

afterEach(() => {
  vi.restoreAllMocks();
});

describe('Markdown parser resource bounds', () => {
  it('uses the owned default ceiling without changing accepted Markdown', () => {
    expect(markdownToHtml('plain')).toBe('<p>plain</p>\n');
  });

  it('rejects configured oversized Markdown before encoding or Marked lexer materialization', () => {
    const encode = vi.spyOn(TextEncoder.prototype, 'encode');
    const lex = vi.spyOn(Lexer, 'lex');
    let failure: unknown;

    try {
      markdownToHtml('12345', { maxMarkdownBytes: 4 });
    } catch (error) {
      failure = error;
    }

    expect(encode).not.toHaveBeenCalled();
    expect(lex).not.toHaveBeenCalled();
    expect(failure).toMatchObject({
      name: 'MarkdownToHtmlResourceError',
      code: 'input_too_large',
      message: 'Markdown-to-HTML input exceeds the configured byte limit.',
    });
  });

  it('uses exact UTF-8 bytes when code-unit length alone does not prove oversize', () => {
    const lex = vi.spyOn(Lexer, 'lex');

    expect(() => markdownToHtml('é', { maxMarkdownBytes: 1 })).toThrowError(
      expect.objectContaining({
        name: 'MarkdownToHtmlResourceError',
        code: 'input_too_large',
      }),
    );
    expect(lex).not.toHaveBeenCalled();
  });

  it('accepts input exactly at the configured UTF-8 ceiling', () => {
    expect(markdownToHtml('é', { maxMarkdownBytes: 2 })).toBe('<p>é</p>\n');
  });

  it.each([
    ['wrong type', '4'],
    ['fractional', 1.5],
    ['zero', 0],
    ['above hard maximum', MAXIMUM_MARKDOWN_TO_HTML_MAX_BYTES + 1],
  ])('fails closed for %s resource configuration', (_label, maxMarkdownBytes) => {
    const secret = 'private-markdown';
    let failure: unknown;

    try {
      markdownToHtml(secret, { maxMarkdownBytes } as never);
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

  it('accepts the hard maximum without changing ordinary conversion semantics', () => {
    expect(
      markdownToHtml('**safe**', {
        maxMarkdownBytes: MAXIMUM_MARKDOWN_TO_HTML_MAX_BYTES,
      }),
    ).toBe('<p><strong>safe</strong></p>\n');
  });

  it('applies the owned default ceiling to editor Markdown ingress', () => {
    const encode = vi.spyOn(TextEncoder.prototype, 'encode');
    const lex = vi.spyOn(Lexer, 'lex');
    const oversized = 'x'.repeat(DEFAULT_MARKDOWN_TO_HTML_MAX_BYTES + 1);

    expect(() => markdownToEditorHtml(oversized)).toThrowError(
      expect.objectContaining({
        name: 'MarkdownToHtmlResourceError',
        code: 'input_too_large',
      }),
    );
    expect(encode).not.toHaveBeenCalled();
    expect(lex).not.toHaveBeenCalled();
  });
});
