import { describe, it, expect } from 'vitest';
import {
  markdownToHtml,
  htmlToMarkdown,
  normalizeMarkdown,
  markdownToEmailHtml,
} from './serializer.js';
import { bytesToDataUri, dataUriToBytes } from '../converter/index.js';

const PNG_BYTES = new Uint8Array([
  0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x00, 0x00, 0x00, 0x0d, 0x49,
  0x48, 0x44, 0x52, 0x00, 0x00, 0x00, 0x01, 0x00, 0x00, 0x00, 0x01, 0x08, 0x06,
  0x00, 0x00, 0x00, 0x1f, 0x15, 0xc4, 0x89,
]);
const PNG_DATA_URI = bytesToDataUri(PNG_BYTES);

describe('markdown <-> html basics', () => {
  it('renders headings, bold, italic', () => {
    const html = markdownToHtml('# Title\n\nSome **bold** and *italic*.');
    expect(html).toContain('<h1>Title</h1>');
    expect(html).toContain('<strong>bold</strong>');
    expect(html).toContain('<em>italic</em>');
  });

  it('renders GFM tables', () => {
    const md = '| A | B |\n| - | - |\n| 1 | 2 |';
    const html = markdownToHtml(md);
    expect(html).toContain('<table>');
    expect(html).toContain('<th>A</th>');
    expect(html).toContain('<td>1</td>');
  });

  it('renders fenced code blocks', () => {
    const html = markdownToHtml('```ts\nconst x = 1;\n```');
    expect(html).toContain('<pre>');
    expect(html).toContain('const x = 1;');
  });

  it('escapes raw Markdown HTML instead of interpreting it', () => {
    const html = markdownToHtml('<script>alert("x")</script>');
    expect(html).toContain(
      '&lt;script&gt;alert(&quot;x&quot;)&lt;/script&gt;',
    );
    expect(html).not.toContain('<script>');
  });

  it('converts HTML back to markdown', () => {
    const md = htmlToMarkdown('<h2>Hi</h2><p>a <strong>b</strong></p>');
    expect(md).toContain('## Hi');
    expect(md).toContain('**b**');
  });

  it('round-trips a GFM table through html', () => {
    const md = '| A | B |\n| --- | --- |\n| 1 | 2 |';
    const back = normalizeMarkdown(md);
    expect(back).toContain('| A | B |');
    expect(back).toContain('| 1 | 2 |');
  });
});

describe('safe hyperlink serialization', () => {
  it('renders safe absolute and relative links with defensive rel attributes', () => {
    const html = markdownToHtml(
      '[external](https://example.com/path) and [internal](/docs/start)',
    );
    expect(html).toContain(
      '<a href="https://example.com/path" rel="noopener noreferrer nofollow">external</a>',
    );
    expect(html).toContain(
      '<a href="/docs/start" rel="noopener noreferrer nofollow">internal</a>',
    );
  });

  it('escapes safe link attributes and preserves a title', () => {
    const html = markdownToHtml(
      '[reference](https://example.com/?a=1&b=2 "A <reference>")',
    );
    expect(html).toContain('href="https://example.com/?a=1&amp;b=2"');
    expect(html).toContain('title="A &lt;reference&gt;"');
  });

  it.each([
    '[run](javascript:alert(1))',
    '[payload](data:text/html;base64,PHNjcmlwdD4=)',
    '[local](file:///etc/passwd)',
    '[network](//attacker.example/path)',
    '[credentials](https://user:secret@example.com/path)',
  ])('renders unsafe target as ordinary text: %s', (markdown) => {
    const html = markdownToHtml(markdown);
    expect(html).not.toContain('<a ');
    expect(html).not.toContain('href=');
    expect(html).toMatch(/<p>[^<]+<\/p>/);
  });
});

describe('base64 image round-trip', () => {
  it('markdown image with data URI -> html keeps the data URI intact', () => {
    const md = `![diagram](${PNG_DATA_URI})`;
    const html = markdownToHtml(md);
    expect(html).toContain(`src="${PNG_DATA_URI}"`);
    expect(html).toContain('alt="diagram"');
  });

  it('escapes image alternative text and preserves a title', () => {
    const md = `![A <diagram>](${PNG_DATA_URI} "A & B")`;
    const html = markdownToHtml(md);
    expect(html).toContain('alt="A &lt;diagram&gt;"');
    expect(html).toContain('title="A &amp; B"');
  });

  it.each([
    '![external](https://example.com/tracker.png)',
    '![active](data:image/svg+xml;base64,PHN2Zz48L3N2Zz4=)',
    '![local](file:///tmp/image.png)',
  ])('renders rejected image source as an inert marker: %s', (markdown) => {
    const html = markdownToHtml(markdown);
    expect(html).toContain('data-cwl-rejected-image="true"');
    expect(html).not.toContain('<img');
    expect(html).not.toContain('src=');
  });

  it('html <img> with data URI -> markdown keeps the data URI intact', () => {
    const html = `<p><img src="${PNG_DATA_URI}" alt="diagram"></p>`;
    const md = htmlToMarkdown(html);
    expect(md).toBe(`![diagram](${PNG_DATA_URI})`);
  });

  it('survives a FULL md -> html -> md round-trip with the bytes recoverable', () => {
    const md = `# Figure\n\n![chart](${PNG_DATA_URI})`;
    const roundTripped = normalizeMarkdown(md);

    // The data URI must still be present verbatim.
    expect(roundTripped).toContain(PNG_DATA_URI);

    // And the embedded bytes must decode back to the original image.
    const match = roundTripped.match(/\((data:[^)]+)\)/);
    expect(match).not.toBeNull();
    const recovered = dataUriToBytes(match![1]);
    expect(recovered.mimeType).toBe('image/png');
    expect(Array.from(recovered.bytes)).toEqual(Array.from(PNG_BYTES));
  });
});

describe('markdownToEmailHtml (compose → send)', () => {
  it('returns a body fragment that preserves base64 images and safe links', () => {
    const md = `# Hello\n\n![fig](${PNG_DATA_URI})\n\n[Read more](https://example.com)`;
    const html = markdownToEmailHtml(md);
    expect(html).toContain('<h1>Hello</h1>');
    expect(html).toContain(`src="${PNG_DATA_URI}"`);
    expect(html).toContain('href="https://example.com"');
    expect(html).not.toContain('<!DOCTYPE');
  });

  it('does not emit active links or external image fetches', () => {
    const html = markdownToEmailHtml(
      '[run](javascript:alert(1)) ![tracker](https://example.com/t.png)',
    );
    expect(html).not.toContain('<a ');
    expect(html).not.toContain('<img');
    expect(html).not.toContain('href=');
    expect(html).not.toContain('src=');
    expect(html).toContain('data-cwl-rejected-image="true"');
  });

  it('wraps a full document with charset and escaped title when requested', () => {
    const html = markdownToEmailHtml('**hi**', {
      fullDocument: true,
      title: 'A <B> & "C"',
    });
    expect(html).toContain('<!DOCTYPE html>');
    expect(html).toContain('<meta charset="utf-8" />');
    expect(html).toContain('<title>A &lt;B&gt; &amp; &quot;C&quot;</title>');
    expect(html).toContain('<strong>hi</strong>');
    expect(html).toMatch(/<body>.*<\/body>/);
  });

  it('defaults the document title to Message when fullDocument is set alone', () => {
    const html = markdownToEmailHtml('x', { fullDocument: true });
    expect(html).toContain('<title>Message</title>');
  });
});

describe('inline image turndown rule branches', () => {
  it('drops an <img> that has no src', () => {
    const md = htmlToMarkdown('<p>before<img alt="ignored">after</p>');
    expect(md).not.toContain('![');
    expect(md).toContain('before');
    expect(md).toContain('after');
  });

  it('preserves a title attribute when present', () => {
    const md = htmlToMarkdown(`<img src="${PNG_DATA_URI}" alt="a" title="A caption">`);
    expect(md).toBe(`![a](${PNG_DATA_URI} "A caption")`);
  });

  it('defaults alt to empty when the attribute is missing', () => {
    const md = htmlToMarkdown(`<img src="${PNG_DATA_URI}">`);
    expect(md).toBe(`![](${PNG_DATA_URI})`);
  });
});
