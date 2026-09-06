import { describe, expect, it } from 'vitest';
import { bytesToDataUri } from '../converter/index.js';
import { htmlToPlainText, markdownToPlainText } from './plainText.js';

const PNG_DATA_URI = bytesToDataUri(
  new Uint8Array([
    0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x00, 0x00, 0x00, 0x0d,
    0x49, 0x48, 0x44, 0x52,
  ]),
);

const INVALID_PLAIN_TEXT_OPTIONS_MESSAGE = 'plain-text options are invalid.';

describe('markdownToPlainText', () => {
  it('preserves authored reading order without Markdown syntax or destinations', () => {
    const plainText = markdownToPlainText(`
# Quarterly **update**

Intro [safe label](https://example.com/private?token=secret) and \`inline code\`.  
Next line.

- First item
- Second item

| Metric | Value |
| --- | --- |
| Revenue | 120 |

> Quoted **text**

---

\`\`\`ts
const total = 120;
\`\`\`
`);

    expect(plainText).toBe(
      [
        'Quarterly update',
        '',
        'Intro safe label and inline code.\nNext line.',
        '',
        '- First item\n- Second item',
        '',
        'Metric\tValue\nRevenue\t120',
        '',
        'Quoted text',
        '',
        'const total = 120;',
      ].join('\n'),
    );
    expect(plainText).not.toContain('https://');
    expect(plainText).not.toContain('**');
    expect(plainText).not.toContain('| --- |');
  });

  it('preserves unordered, ordered-start, and nested list structure', () => {
    expect(markdownToPlainText('- Alpha\n- Beta')).toBe('- Alpha\n- Beta');
    expect(markdownToPlainText('3. Third\n4. Fourth')).toBe(
      '3. Third\n4. Fourth',
    );
    expect(
      markdownToPlainText(
        ['- Parent', '  - Child', '    2. Grandchild'].join('\n'),
      ),
    ).toBe('- Parent\n  - Child\n    2. Grandchild');
  });

  it('preserves inline and fenced code whitespace verbatim', () => {
    const plainText = markdownToPlainText(
      [
        'Before `alpha  beta` after.',
        '',
        '```text',
        '  first  value',
        '',
        '    second',
        '```',
      ].join('\n'),
    );

    expect(plainText).toBe(
      [
        'Before alpha  beta after.',
        '',
        '  first  value',
        '',
        '    second',
      ].join('\n'),
    );
  });

  it('includes image alternative text by default without leaking payload bytes', () => {
    const plainText = markdownToPlainText(
      `Before ![Quarterly chart](${PNG_DATA_URI}) after.`,
    );

    expect(plainText).toBe('Before Quarterly chart after.');
    expect(plainText).not.toContain('data:image');
    expect(plainText).not.toContain(PNG_DATA_URI);
  });

  it('can omit image alternative text for metadata-free projections', () => {
    const plainText = markdownToPlainText(
      `Before ![Quarterly chart](${PNG_DATA_URI}) after.`,
      { includeImageAlt: false },
    );

    expect(plainText).toBe('Before after.');
  });

  it('accepts null-prototype option bags without weakening validation', () => {
    const options = Object.assign(Object.create(null), {
      includeImageAlt: false,
    });

    expect(
      markdownToPlainText('Before ![Quarterly chart](x.png) after.', options),
    ).toBe('Before after.');
  });

  it('rejects invalid runtime image-alt policy instead of coercing it', () => {
    const privateMarker = 'private-image-alt-policy';
    let failure: unknown;

    try {
      markdownToPlainText('![Quarterly chart](x.png)', {
        includeImageAlt: privateMarker,
      } as never);
    } catch (error) {
      failure = error;
    }

    expect(failure).toEqual(
      new RangeError(INVALID_PLAIN_TEXT_OPTIONS_MESSAGE),
    );
    expect(String(failure)).not.toContain(privateMarker);
  });

  it('rejects accessor-backed options without invoking caller code', () => {
    let getterCalls = 0;
    const options = Object.defineProperty({}, 'includeImageAlt', {
      enumerable: true,
      get() {
        getterCalls += 1;
        throw new Error('private getter failure');
      },
    });

    expect(() => markdownToPlainText('Visible', options as never)).toThrowError(
      new RangeError(INVALID_PLAIN_TEXT_OPTIONS_MESSAGE),
    );
    expect(getterCalls).toBe(0);
  });

  it('rejects invalid containers and exotic option prototypes', () => {
    const exoticOptions = Object.create({ inherited: true });

    for (const options of [42, [], exoticOptions]) {
      expect(() =>
        markdownToPlainText('Visible', options as never),
      ).toThrowError(new RangeError(INVALID_PLAIN_TEXT_OPTIONS_MESSAGE));
    }
  });

  it('rejects non-enumerable and descriptor-hostile option properties', () => {
    const hiddenOptions = Object.defineProperty({}, 'includeImageAlt', {
      configurable: true,
      enumerable: false,
      value: false,
    });
    const missingDescriptorOptions = new Proxy(
      {},
      {
        ownKeys: () => ['includeImageAlt'],
        getOwnPropertyDescriptor: () => undefined,
      },
    );

    expect(() =>
      markdownToPlainText('Visible', hiddenOptions as never),
    ).toThrowError(new RangeError(INVALID_PLAIN_TEXT_OPTIONS_MESSAGE));
    expect(() =>
      markdownToPlainText('Visible', missingDescriptorOptions as never),
    ).toThrowError(new RangeError(INVALID_PLAIN_TEXT_OPTIONS_MESSAGE));
  });

  it('rejects unknown and symbol option keys fail-closed', () => {
    expect(() =>
      markdownToPlainText('Visible', { maxMarkdownByte: 4 } as never),
    ).toThrowError(new RangeError(INVALID_PLAIN_TEXT_OPTIONS_MESSAGE));
    expect(() =>
      markdownToPlainText(
        'Visible',
        { [Symbol('private')]: true } as never,
      ),
    ).toThrowError(new RangeError(INVALID_PLAIN_TEXT_OPTIONS_MESSAGE));
  });

  it('omits raw HTML blocks and link-definition records instead of interpreting them', () => {
    const plainText = markdownToPlainText(`
<script>alert('secret')</script>

[reference]: https://example.com/private

Visible [label][reference].
`);

    expect(plainText).toBe('Visible label.');
    expect(plainText).not.toContain('script');
    expect(plainText).not.toContain('private');
  });
});

describe('htmlToPlainText', () => {
  it('projects semantic labels while omitting element names and source attributes', () => {
    const plainText = htmlToPlainText(`
<h1>Summary</h1>
<p>Tom &amp; Jerry read <a href="https://example.com/secret">the report</a>.</p>
<p><img src="https://example.com/tracker.png" alt="External chart"></p>
`);

    expect(plainText).toBe(
      ['Summary', '', 'Tom & Jerry read the report.', '', 'External chart'].join(
        '\n',
      ),
    );
    expect(plainText).not.toContain('<h1>');
    expect(plainText).not.toContain('https://');
    expect(plainText).not.toContain('tracker.png');
  });

  it('forwards image-alternative policy through HTML normalization', () => {
    expect(
      htmlToPlainText('<p>Before<img src="x.png" alt="chart">after</p>', {
        includeImageAlt: false,
      }),
    ).toBe('Beforeafter');
  });

  it('rejects malformed option containers before HTML normalization', () => {
    expect(() => htmlToPlainText('<p>Visible</p>', null as never)).toThrowError(
      new RangeError(INVALID_PLAIN_TEXT_OPTIONS_MESSAGE),
    );
  });
});