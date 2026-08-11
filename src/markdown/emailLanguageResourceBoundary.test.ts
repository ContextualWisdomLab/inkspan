import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  markdownToEmailHtml,
  type MarkdownToEmailHtmlOptions,
} from './serializer.js';

afterEach(() => {
  vi.restoreAllMocks();
});

describe('email document language resource boundary', () => {
  it('rejects an obviously oversized language tag before Intl canonicalization', () => {
    const canonicalize = vi.spyOn(Intl, 'getCanonicalLocales');

    expect(() =>
      markdownToEmailHtml('bounded metadata', {
        fullDocument: true,
        languageTag: 'a'.repeat(257),
      }),
    ).toThrow(RangeError);
    expect(canonicalize).not.toHaveBeenCalled();
  });

  it('fails closed with the stable RangeError contract for non-string runtime metadata', () => {
    const languageTag = 42 as unknown as MarkdownToEmailHtmlOptions['languageTag'];

    expect(() =>
      markdownToEmailHtml('runtime metadata', {
        fullDocument: true,
        languageTag,
      }),
    ).toThrow(RangeError);
  });
});
