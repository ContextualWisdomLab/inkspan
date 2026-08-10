import { describe, expect, it } from 'vitest';
import {
  markdownToEmailHtml,
  type MarkdownToEmailHtmlOptions,
} from './serializer.js';

interface FutureEmailDocumentOptions extends MarkdownToEmailHtmlOptions {
  readonly languageTag?: string;
  readonly textDirection?: 'ltr' | 'rtl' | 'auto';
}

const renderEmail = (
  markdown: string,
  options: FutureEmailDocumentOptions,
): string => markdownToEmailHtml(markdown, options as MarkdownToEmailHtmlOptions);

describe('full email document language and direction metadata', () => {
  it('preserves Korean document language and explicit base direction on the root html element', () => {
    const html = renderEmail('안녕하세요', {
      fullDocument: true,
      languageTag: 'ko-KR',
      textDirection: 'ltr',
    });

    expect(html).toContain('<html lang="ko-KR" dir="ltr">');
    expect(html).toContain('<p>안녕하세요</p>');
  });

  it('canonicalizes BCP 47 language case and preserves automatic direction', () => {
    const html = renderEmail('مرحبا', {
      fullDocument: true,
      languageTag: 'AR-sa',
      textDirection: 'auto',
    });

    expect(html).toContain('<html lang="ar-SA" dir="auto">');
  });

  it('fails closed instead of emitting an invalid non-blank BCP 47 language tag', () => {
    expect(() =>
      renderEmail('unsafe metadata', {
        fullDocument: true,
        languageTag: 'en_US\" onload=\"alert(1)',
      }),
    ).toThrow(/BCP 47 language tag/u);
  });

  it('treats a blank language as absent and leaves fragment mode unwrapped', () => {
    const fullDocument = renderEmail('blank', {
      fullDocument: true,
      languageTag: '   ',
      textDirection: 'rtl',
    });
    expect(fullDocument).toContain('<html dir="rtl">');
    expect(fullDocument).not.toContain(' lang=');

    const fragment = renderEmail('fragment', {
      languageTag: 'ko-KR',
      textDirection: 'rtl',
    });
    expect(fragment).toBe('<p>fragment</p>');
    expect(fragment).not.toContain('<html');
    expect(fragment).not.toContain(' lang=');
    expect(fragment).not.toContain(' dir=');
  });
});
