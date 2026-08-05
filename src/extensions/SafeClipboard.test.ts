import { describe, expect, it, vi } from 'vitest';
import {
  ClipboardSanitizationError,
  DEFAULT_CLIPBOARD_HTML_BYTES,
  DEFAULT_CLIPBOARD_MAX_DEPTH,
  DEFAULT_CLIPBOARD_MAX_NODES,
  SafeClipboard,
  sanitizeRichClipboardHtml,
} from './SafeClipboard.js';

/** Create nested markup with an exact element depth. */
function nestedHtml(depth: number): string {
  return `${'<div>'.repeat(depth)}x${'</div>'.repeat(depth)}`;
}

describe('sanitizeRichClipboardHtml', () => {
  it('preserves Word and Google Docs semantics while stripping proprietary styling', () => {
    const source = `
      <!--[if gte mso 9]><xml>private</xml><![endif]-->
      <p class="MsoNormal" style="font-weight:700;color:red" onclick="steal()">
        Word <span style="font-style:italic">italic</span>
      </p>
      <div data-docs-id="secret" style="white-space:pre-wrap">
        <span style="text-decoration: underline line-through">Docs</span>
      </div>
      <o:p>Office namespace text</o:p>
    `;

    const sanitized = sanitizeRichClipboardHtml(source, undefined, document);
    const container = document.createElement('div');
    container.innerHTML = sanitized;

    expect(container.querySelector('strong')).toHaveTextContent('Word italic');
    expect(container.querySelector('em')).toHaveTextContent('italic');
    expect(container.querySelector('u s, s u')).toHaveTextContent('Docs');
    expect(container).toHaveTextContent('Office namespace text');
    expect(sanitized).not.toMatch(/MsoNormal|data-docs-id|style=|onclick|<xml|<!--/i);
  });

  it('drops active, embedded, resource-bearing, form, metadata, and hidden subtrees', () => {
    const source = `
      <p>visible</p>
      <script>script secret</script>
      <style>.x{display:block}</style>
      <iframe src="https://attacker.example">frame secret</iframe>
      <object data="https://attacker.example">object secret</object>
      <form><input value="private"><button>submit secret</button></form>
      <template>template secret</template>
      <svg><text>svg secret</text></svg>
      <math><mi>math secret</mi></math>
      <video src="https://attacker.example/video">video secret</video>
      <img src="https://tracker.example/pixel" alt="tracking secret">
      <p hidden>hidden attribute secret</p>
      <p aria-hidden=" TRUE ">aria secret</p>
      <p style="display: none !important">display secret</p>
      <p style="visibility:hidden">visibility secret</p>
      <p style="mso-hide: all">office hidden secret</p>
    `;

    const sanitized = sanitizeRichClipboardHtml(source, {}, document);
    const container = document.createElement('div');
    container.innerHTML = sanitized;

    expect(sanitized).toContain('visible');
    expect(sanitized).not.toMatch(
      /script secret|frame secret|object secret|private|submit secret|template secret|svg secret|math secret|video secret|tracking secret|hidden attribute secret|aria secret|display secret|visibility secret|office hidden secret/i,
    );
    expect(
      container.querySelectorAll(
        'script, iframe, object, form, input, button, template, svg, math, video, img',
      ),
    ).toHaveLength(0);
  });

  it('keeps only safe links and exact fixed link attributes', () => {
    const sanitized = sanitizeRichClipboardHtml(
      `<p>
        <a href="https://example.com/path" target="_self" rel="opener" data-id="x">safe</a>
        <a href="/relative">relative</a>
        <a href="javascript:alert(1)" onclick="steal()">unsafe</a>
        <a href="https://user:pass@example.com/private">credential</a>
      </p>`,
      {},
      document,
    );
    const container = document.createElement('div');
    container.innerHTML = sanitized;
    const links = [...container.querySelectorAll('a')];

    expect(links).toHaveLength(2);
    expect(links.map((link) => link.getAttribute('href'))).toEqual([
      'https://example.com/path',
      '/relative',
    ]);
    for (const link of links) {
      expect(link.getAttribute('rel')).toBe('noopener noreferrer nofollow');
      expect(link.hasAttribute('target')).toBe(false);
      expect(link.hasAttribute('data-id')).toBe(false);
    }
    expect(container).toHaveTextContent('unsafe');
    expect(container).toHaveTextContent('credential');
  });

  it('preserves bounded list and table semantics and rejects malformed spans', () => {
    const sanitized = sanitizeRichClipboardHtml(
      `<ol start="-4"><li>one</li></ol>
       <table><thead><tr><th colspan="2" rowspan="1">head</th></tr></thead>
       <tbody><tr><td colspan="0" rowspan="999">cell</td></tr></tbody></table>`,
      {},
      document,
    );
    const container = document.createElement('div');
    container.innerHTML = sanitized;

    expect(container.querySelector('ol')?.getAttribute('start')).toBe('-4');
    expect(container.querySelector('th')?.getAttribute('colspan')).toBe('2');
    expect(container.querySelector('th')?.getAttribute('rowspan')).toBe('1');
    expect(container.querySelector('td')?.hasAttribute('colspan')).toBe(false);
    expect(container.querySelector('td')?.hasAttribute('rowspan')).toBe(false);
  });

  it('normalizes equivalent semantic tags and unwraps unsupported ordinary containers', () => {
    const sanitized = sanitizeRichClipboardHtml(
      `<section><b>bold</b><i>italic</i><strike>strike</strike><font>font text</font></section>`,
      {},
      document,
    );
    const container = document.createElement('div');
    container.innerHTML = sanitized;

    expect(sanitized).toContain('<strong>bold</strong>');
    expect(sanitized).toContain('<em>italic</em>');
    expect(sanitized).toContain('<s>strike</s>');
    expect(sanitized).toContain('font text');
    expect(container.querySelectorAll('section, font')).toHaveLength(0);
  });

  it('handles malformed nesting deterministically', () => {
    const sanitized = sanitizeRichClipboardHtml(
      '<p>before<strong>bold<p>after',
      {},
      document,
    );

    expect(sanitized).toContain('before');
    expect(sanitized).toContain('bold');
    expect(sanitized).toContain('after');
    expect(sanitized).not.toContain('<script');
  });

  it('enforces the UTF-8 byte ceiling before parsing', () => {
    expect(() =>
      sanitizeRichClipboardHtml('가'.repeat(10), { maxHtmlBytes: 20 }, document),
    ).toThrowError(
      expect.objectContaining({
        code: 'input_too_large',
        message: 'Rich clipboard HTML exceeds the configured byte limit.',
      }),
    );
  });

  it('enforces node and depth ceilings with stable redacted errors', () => {
    expect(() =>
      sanitizeRichClipboardHtml(
        '<p><span>a</span><span>b</span></p>',
        { maxNodes: 3 },
        document,
      ),
    ).toThrowError(expect.objectContaining({ code: 'node_limit_exceeded' }));
    expect(() =>
      sanitizeRichClipboardHtml(
        nestedHtml(4),
        { maxDepth: 3 },
        document,
      ),
    ).toThrowError(expect.objectContaining({ code: 'depth_limit_exceeded' }));
  });

  it('rejects invalid, accessor, symbol-keyed, and reflection-hostile configuration', () => {
    const symbolKey = Symbol('hidden');
    const getterConfig = Object.defineProperty({}, 'maxHtmlBytes', {
      enumerable: true,
      get() {
        throw new Error('private getter detail');
      },
    });
    const proxy = new Proxy(
      {},
      {
        ownKeys() {
          throw new Error('private proxy detail');
        },
      },
    );

    for (const config of [
      { maxHtmlBytes: 0 },
      { maxNodes: Number.NaN },
      { maxDepth: 1.5 },
      { unexpected: 1 },
      Object.assign({ maxHtmlBytes: 10 }, { [symbolKey]: true }),
      getterConfig,
      proxy,
    ]) {
      expect(() =>
        sanitizeRichClipboardHtml('<p>x</p>', config as never, document),
      ).toThrowError(
        expect.objectContaining({
          code: 'invalid_configuration',
          message: 'Rich clipboard configuration is invalid.',
        }),
      );
    }
  });

  it('accepts documented defaults and explicit undefined values', () => {
    const sanitized = sanitizeRichClipboardHtml(
      '<p>defaults</p>',
      {
        maxHtmlBytes: undefined,
        maxNodes: undefined,
        maxDepth: undefined,
      },
      document,
    );

    expect(sanitized).toBe('<p>defaults</p>');
    expect(DEFAULT_CLIPBOARD_HTML_BYTES).toBe(1_048_576);
    expect(DEFAULT_CLIPBOARD_MAX_NODES).toBe(10_000);
    expect(DEFAULT_CLIPBOARD_MAX_DEPTH).toBe(64);
  });

  it('fails closed when no DOM-capable document exists', () => {
    expect(() =>
      sanitizeRichClipboardHtml('<p>x</p>', {}, null as never),
    ).toThrowError(
      expect.objectContaining({
        code: 'dom_unavailable',
        message: 'Rich clipboard sanitization requires a DOM-capable document.',
      }),
    );
  });
});

describe('SafeClipboard extension', () => {
  it('transforms rich HTML and reports one redacted error on failure', () => {
    const onError = vi.fn();
    const configured = SafeClipboard.configure({
      maxHtmlBytes: 10,
      maxNodes: DEFAULT_CLIPBOARD_MAX_NODES,
      maxDepth: DEFAULT_CLIPBOARD_MAX_DEPTH,
      onError,
      document,
    });
    const transform = configured.config.transformPastedHTML?.bind({
      options: configured.options,
    } as never);

    expect(transform?.('<b>x</b>')).toBe('<strong>x</strong>');
    expect(transform?.('<p>this is too large</p>')).toBe('');
    expect(onError).toHaveBeenCalledTimes(1);
    expect(onError.mock.calls[0]?.[0]).toBeInstanceOf(
      ClipboardSanitizationError,
    );
    expect(String(onError.mock.calls[0]?.[0])).not.toContain('this is too large');
  });

  it('contains host callback failures and unexpected sanitizer errors', () => {
    const onError = vi.fn(() => {
      throw new Error('host callback failure');
    });
    const configured = SafeClipboard.configure({
      maxHtmlBytes: 1,
      maxNodes: DEFAULT_CLIPBOARD_MAX_NODES,
      maxDepth: DEFAULT_CLIPBOARD_MAX_DEPTH,
      onError,
      document,
    });
    const transform = configured.config.transformPastedHTML?.bind({
      options: configured.options,
    } as never);

    expect(() => transform?.('<p>x</p>')).not.toThrow();
    expect(transform?.('<p>x</p>')).toBe('');
    expect(onError).toHaveBeenCalled();
  });
});
