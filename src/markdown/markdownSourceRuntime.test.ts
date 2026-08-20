import { afterEach, describe, expect, it, vi } from 'vitest';
import { Lexer } from 'marked';
import {
  markdownToEditorHtml,
  markdownToEmailHtml,
  markdownToHtml,
  normalizeMarkdown,
} from './resourceBoundMarkdown.js';

afterEach(() => {
  vi.restoreAllMocks();
});

describe('Markdown source runtime contract', () => {
  it.each([
    ['HTML conversion', markdownToHtml],
    ['normalization', normalizeMarkdown],
    ['email conversion', markdownToEmailHtml],
    ['editor ingress', markdownToEditorHtml],
  ])('rejects non-string input before caller code or parser work for %s', (_label, convert) => {
    const encode = vi.spyOn(TextEncoder.prototype, 'encode');
    const lex = vi.spyOn(Lexer, 'lex');
    let propertyRead = false;
    let coerced = false;
    const hostile = {
      get length() {
        propertyRead = true;
        throw new Error('private-length-getter');
      },
      toString() {
        coerced = true;
        throw new Error('private-string-coercion');
      },
    };
    let failure: unknown;

    try {
      (convert as unknown as (markdown: unknown) => string)(hostile);
    } catch (error) {
      failure = error;
    }

    expect(propertyRead).toBe(false);
    expect(coerced).toBe(false);
    expect(encode).not.toHaveBeenCalled();
    expect(lex).not.toHaveBeenCalled();
    expect(failure).toMatchObject({
      name: 'MarkdownToHtmlResourceError',
      code: 'invalid_input',
      message: 'Markdown-to-HTML input must be a string.',
    });
    expect(String(failure)).not.toContain('private-');
  });
});
