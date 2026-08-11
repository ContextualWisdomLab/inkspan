import { afterEach, describe, expect, it, vi } from 'vitest';
import { htmlToMarkdown, type HtmlToMarkdownOptions } from './serializer.js';

afterEach(() => {
  vi.restoreAllMocks();
});

describe('HTML-to-Markdown resource bounds', () => {
  it('rejects configured oversized HTML before browser parser materialization', () => {
    const createElement = vi.spyOn(document, 'createElement');
    let failure: unknown;

    try {
      htmlToMarkdown('<p>12345</p>', {
        maxHtmlBytes: 4,
      } as HtmlToMarkdownOptions & { maxHtmlBytes: number });
    } catch (error) {
      failure = error;
    }

    expect(createElement).not.toHaveBeenCalledWith('template');
    expect(failure).toMatchObject({
      name: 'HtmlToMarkdownResourceError',
      code: 'input_too_large',
      message: 'HTML-to-Markdown input exceeds the configured byte limit.',
    });
  });
});
