import { afterEach, describe, expect, it, vi } from 'vitest';
import { Lexer } from 'marked';
import { markdownToPlainText } from './plainText.js';

afterEach(() => {
  vi.restoreAllMocks();
});

describe('plain-text Markdown resource bounds', () => {
  it('rejects oversized Markdown before Marked lexer materialization', () => {
    const lex = vi.spyOn(Lexer, 'lex');
    let failure: unknown;

    try {
      markdownToPlainText('12345', { maxMarkdownBytes: 4 } as never);
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
});
