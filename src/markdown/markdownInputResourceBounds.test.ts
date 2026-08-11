import { afterEach, describe, expect, it, vi } from 'vitest';
import { Marked } from 'marked';
import { markdownToHtml } from './serializer.js';

afterEach(() => {
  vi.restoreAllMocks();
});

describe('Markdown parser resource bounds', () => {
  it('rejects configured oversized Markdown before encoding or Marked parser materialization', () => {
    const encode = vi.spyOn(TextEncoder.prototype, 'encode');
    const parse = vi.spyOn(Marked.prototype, 'parse');
    let failure: unknown;

    try {
      (
        markdownToHtml as unknown as (
          markdown: string,
          options: { maxMarkdownBytes: number },
        ) => string
      )('12345', { maxMarkdownBytes: 4 });
    } catch (error) {
      failure = error;
    }

    expect(encode).not.toHaveBeenCalled();
    expect(parse).not.toHaveBeenCalled();
    expect(failure).toMatchObject({
      name: 'MarkdownToHtmlResourceError',
      code: 'input_too_large',
      message: 'Markdown-to-HTML input exceeds the configured byte limit.',
    });
  });
});
