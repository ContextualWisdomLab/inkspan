import { describe, expect, it, vi } from 'vitest';
import { htmlToMarkdown, type HtmlToMarkdownOptions } from './serializer.js';

const INVALID_CONFIGURATION = {
  name: 'HtmlToMarkdownResourceError',
  code: 'invalid_configuration',
  message: 'HTML-to-Markdown resource configuration is invalid.',
};

describe('HTML-to-Markdown runtime option bag boundary', () => {
  it.each([
    ['primitive', 42],
    ['null', null],
    ['array', []],
    ['custom prototype', Object.create({ inherited: true })],
    ['unknown key', { unexpectedPolicy: true }],
    ['non-boolean image-alt mode', { includeImageAlt: 'false' }],
    ['symbol key', { [Symbol('policy')]: true }],
    [
      'non-enumerable option',
      Object.defineProperty({}, 'maxHtmlBytes', {
        enumerable: false,
        value: 1024,
      }),
    ],
  ])('rejects %s option bags through the stable resource error', (_label, options) => {
    expect(() =>
      htmlToMarkdown('<p>safe</p>', options as HtmlToMarkdownOptions),
    ).toThrowError(expect.objectContaining(INVALID_CONFIGURATION));
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

  it('normalizes hostile reflection traps without leaking caller failures', () => {
    const privateFailure = new Error('private-reflection-sentinel');
    const options = new Proxy({}, {
      getPrototypeOf() {
        throw privateFailure;
      },
    }) as HtmlToMarkdownOptions;
    let failure: unknown;

    try {
      htmlToMarkdown('<p>private body</p>', options);
    } catch (error) {
      failure = error;
    }

    expect(failure).toMatchObject(INVALID_CONFIGURATION);
    expect(String(failure)).not.toContain(privateFailure.message);
  });

  it('preserves null-prototype data option bags and accepted conversion behavior', () => {
    const options = Object.assign(Object.create(null), {
      includeImageAlt: false,
      maxHtmlBytes: 1024,
    }) as HtmlToMarkdownOptions;

    expect(
      htmlToMarkdown(
        '<p><img alt="private alt" src="https://example.test/a.png">text</p>',
        options,
      ),
    ).toBe('text');
  });
});
