import { describe, expect, it } from 'vitest';
import {
  DEFAULT_CLIPBOARD_HTML_BYTES,
  DEFAULT_CLIPBOARD_MAX_DEPTH,
  DEFAULT_CLIPBOARD_MAX_NODES,
  SafeClipboard,
  sanitizeRichClipboardHtml,
} from './SafeClipboard.js';

/**
 * Build the smallest DOM-capable test double whose source text node reports a
 * null node value. Real browser text nodes normally report strings, but the
 * sanitizer intentionally retains a fail-safe empty-string fallback for hostile
 * or non-conforming host DOM implementations.
 */
function documentWithNullableSourceText(): Document {
  const sourceTextNode = {
    nodeType: 3,
    nodeValue: null,
    childNodes: {
      length: 0,
      item() {
        return null;
      },
    },
  } as unknown as Node;
  const sourceFragment = {
    childNodes: {
      length: 1,
      item(index: number) {
        return index === 0 ? sourceTextNode : null;
      },
    },
  } as unknown as DocumentFragment;
  const sourceTemplate = {
    content: sourceFragment,
    set innerHTML(_sourceHtml: string) {
      // The fixed hostile source node above is the parsed test fixture.
    },
  } as unknown as HTMLTemplateElement;
  const inertDocument = {
    createElement(tagName: string) {
      return tagName === 'template'
        ? sourceTemplate
        : document.createElement(tagName);
    },
    createTextNode: document.createTextNode.bind(document),
  } as unknown as Document;

  return {
    createElement: document.createElement.bind(document),
    implementation: {
      createHTMLDocument() {
        return inertDocument;
      },
    },
  } as unknown as Document;
}

describe('SafeClipboard residual fail-closed branches', () => {
  it('keeps malformed Office-style declarations without a separator visible', () => {
    expect(
      sanitizeRichClipboardHtml(
        '<p style="mso-hide all">visible malformed declaration</p>',
        {},
        document,
      ),
    ).toBe('<p>visible malformed declaration</p>');
  });

  it('converts a hostile null text-node value to bounded empty text', () => {
    expect(
      sanitizeRichClipboardHtml(
        'ignored by the fixed test DOM',
        {},
        documentWithNullableSourceText(),
      ),
    ).toBe('');
  });

  it('validates a preserved nested configuration at transform time', () => {
    const configured = SafeClipboard.configure({
      config: { maxHtmlBytes: 10 },
      maxHtmlBytes: DEFAULT_CLIPBOARD_HTML_BYTES,
      maxNodes: DEFAULT_CLIPBOARD_MAX_NODES,
      maxDepth: DEFAULT_CLIPBOARD_MAX_DEPTH,
      document,
    });
    const transform = configured.config.transformPastedHTML?.bind({
      options: configured.options,
    } as never);

    expect(transform?.('<b>x</b>')).toBe('<strong>x</strong>');
    expect(transform?.('<p>this is too large</p>')).toBe('');
  });
});
