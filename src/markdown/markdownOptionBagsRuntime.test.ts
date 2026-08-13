import { describe, expect, it } from 'vitest';
import {
  markdownToEmailHtml,
  markdownToHtml,
  normalizeMarkdown,
} from './resourceBoundMarkdown.js';

const INVALID_CONFIGURATION = {
  name: 'MarkdownToHtmlResourceError',
  code: 'invalid_configuration',
  message: 'Markdown-to-HTML resource configuration is invalid.',
};

type RuntimeAdapter = (markdown: string, options?: unknown) => string;

const adapters: ReadonlyArray<readonly [string, RuntimeAdapter]> = [
  ['HTML conversion', markdownToHtml as unknown as RuntimeAdapter],
  ['normalization', normalizeMarkdown as unknown as RuntimeAdapter],
  ['email conversion', markdownToEmailHtml as unknown as RuntimeAdapter],
];

function expectInvalidConfiguration(run: () => unknown): void {
  let failure: unknown;
  try {
    run();
  } catch (error) {
    failure = error;
  }

  expect(failure).toMatchObject(INVALID_CONFIGURATION);
  expect(String(failure)).not.toContain('private-');
}

describe('Markdown public option-bag runtime contracts', () => {
  it.each(adapters)('rejects malformed containers for %s', (_label, convert) => {
    for (const options of [null, 1, 'options', [], new Date(0)]) {
      expectInvalidConfiguration(() => convert('hello', options));
    }
  });

  it.each(adapters)('rejects unknown string and symbol keys for %s', (_label, convert) => {
    expectInvalidConfiguration(() => convert('hello', { maxMarkdownByte: 1 }));
    expectInvalidConfiguration(() =>
      convert('hello', { [Symbol('private-option')]: true }),
    );
  });

  it.each(adapters)('rejects accessors without executing caller code for %s', (_label, convert) => {
    let getterCalled = false;
    const options = Object.create(null) as Record<string, unknown>;
    Object.defineProperty(options, 'maxMarkdownBytes', {
      enumerable: true,
      configurable: true,
      get() {
        getterCalled = true;
        throw new Error('private-option-getter');
      },
    });

    expectInvalidConfiguration(() => convert('hello', options));
    expect(getterCalled).toBe(false);
  });

  it.each(adapters)('rejects non-enumerable own properties for %s', (_label, convert) => {
    const options = Object.create(null) as Record<string, unknown>;
    Object.defineProperty(options, 'maxMarkdownBytes', {
      enumerable: false,
      configurable: true,
      writable: true,
      value: 1024,
    });

    expectInvalidConfiguration(() => convert('hello', options));
  });

  it.each(adapters)('accepts null-prototype bags for %s', (_label, convert) => {
    const options = Object.create(null) as Record<string, unknown>;
    options.maxMarkdownBytes = 1024;

    expect(convert('hello', options)).toEqual(expect.any(String));
  });

  it('keeps the email option vocabulary exact', () => {
    const options = Object.create(null) as Record<string, unknown>;
    options.maxMarkdownBytes = 1024;
    options.fullDocument = true;
    options.title = 'Title';
    options.languageTag = 'en';
    options.textDirection = 'ltr';

    expect(markdownToEmailHtml('hello', options)).toContain('<!doctype html>');
    expectInvalidConfiguration(() =>
      markdownToEmailHtml('hello', {
        maxMarkdownBytes: 1024,
        fullDocument: false,
        title: undefined,
        languageTag: undefined,
        textDirection: undefined,
        unexpected: true,
      } as never),
    );
  });
});
