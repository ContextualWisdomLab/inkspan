import { describe, expect, it, vi } from 'vitest';
import { htmlToMarkdown, type HtmlToMarkdownOptions } from './serializer.js';

const INVALID_CONFIGURATION = {
  name: 'HtmlToMarkdownResourceError',
  code: 'invalid_configuration',
  message: 'HTML-to-Markdown resource configuration is invalid.',
};

describe('HTML-to-Markdown runtime option bag boundary', () => {
  it('rejects a non-object option bag through the stable resource error', () => {
    expect(() => htmlToMarkdown('<p>safe</p>', null as never)).toThrowError(
      expect.objectContaining(INVALID_CONFIGURATION),
    );
  });

  it('rejects accessor-backed options without executing caller code or parsing HTML', () => {
    const privateFailure = new Error('private-html-option-sentinel');
    const maxHtmlBytes = vi.fn(() => {
      throw privateFailure;
    });
    const createElement = vi.spyOn(document, 'createElement');
    const options = Object.defineProperty({}, 'maxHtmlBytes', {
      enumerable: true,
      get: maxHtmlBytes,
    }) as HtmlToMarkdownOptions;
    let failure: unknown;

    try {
      htmlToMarkdown('<p>private body</p>', options);
    } catch (error) {
      failure = error;
    }

    expect(maxHtmlBytes).not.toHaveBeenCalled();
    expect(createElement).not.toHaveBeenCalledWith('template');
    expect(failure).toMatchObject(INVALID_CONFIGURATION);
    expect(String(failure)).not.toContain(privateFailure.message);
  });

  it('rejects unknown option keys instead of silently accepting configuration drift', () => {
    expect(() =>
      htmlToMarkdown('<p>safe</p>', {
        includeImageAlt: true,
        unexpectedPolicy: true,
      } as HtmlToMarkdownOptions),
    ).toThrowError(expect.objectContaining(INVALID_CONFIGURATION));
  });

  it('preserves null-prototype data option bags and accepted conversion behavior', () => {
    const options = Object.assign(Object.create(null), {
      includeImageAlt: false,
      maxHtmlBytes: 1024,
    }) as HtmlToMarkdownOptions;

    expect(htmlToMarkdown('<p><img alt="private alt" src="https://example.test/a.png">text</p>', options)).toBe('text');
  });
});
