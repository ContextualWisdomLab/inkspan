import { describe, expect, it } from 'vitest';
import {
  markdownToEmailHtml,
  type MarkdownToEmailHtmlOptions,
} from './resourceBoundMarkdown.js';

const EMAIL_TITLE_MAX_CODE_UNITS = 65_536;
const INVALID_EMAIL_TITLE_MESSAGE =
  'Email document title must be a string within the supported length.';

describe('email document title resource boundary', () => {
  it('rejects an oversized full-document title with a stable redacted error', () => {
    const privateMarker = 'customer-case-private-marker';
    const title = `${privateMarker}${'x'.repeat(EMAIL_TITLE_MAX_CODE_UNITS)}`;
    let failure: unknown;

    try {
      markdownToEmailHtml('bounded body', {
        fullDocument: true,
        title,
      });
    } catch (error) {
      failure = error;
    }

    expect(failure).toBeInstanceOf(RangeError);
    expect(failure).toMatchObject({ message: INVALID_EMAIL_TITLE_MESSAGE });
    expect(String(failure)).not.toContain(privateMarker);
  });

  it('rejects non-string full-document title metadata through the same contract', () => {
    const title = 42 as unknown as MarkdownToEmailHtmlOptions['title'];

    expect(() =>
      markdownToEmailHtml('runtime metadata', {
        fullDocument: true,
        title,
      }),
    ).toThrowError(new RangeError(INVALID_EMAIL_TITLE_MESSAGE));
  });

  it('accepts a title exactly at the local metadata ceiling', () => {
    const title = 'x'.repeat(EMAIL_TITLE_MAX_CODE_UNITS);

    const html = markdownToEmailHtml('', {
      fullDocument: true,
      title,
    });

    expect(html).toContain(`<title>${title}</title>`);
  });

  it('preserves fragment mode where title metadata is not consumed', () => {
    const html = markdownToEmailHtml('fragment body', {
      title: 'x'.repeat(EMAIL_TITLE_MAX_CODE_UNITS + 1),
    });

    expect(html).toContain('<p>fragment body</p>');
    expect(html).not.toContain('<title>');
  });
});
