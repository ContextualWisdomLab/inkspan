import { Editor } from '@tiptap/core';
import { describe, expect, it } from 'vitest';
import { sanitizeRichClipboardHtml } from './SafeClipboard.js';
import { safeClipboardPluginKey } from './SafeClipboardExtension.js';
import { buildExtensions } from './kit.js';

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

  it('validates preserved nested configuration through the real ProseMirror path', () => {
    const editor = new Editor({
      element: document.createElement('div'),
      extensions: buildExtensions({
        clipboard: { maxHtmlBytes: 10 },
      }),
      content: '',
    });

    try {
      let transformed = '<b>x</b>';
      editor.view.someProp('transformPastedHTML', (transform) => {
        transformed = transform(transformed, editor.view);
      });
      expect(transformed).toBe('<strong>x</strong>');

      transformed = '<p>this is too large</p>';
      editor.view.someProp('transformPastedHTML', (transform) => {
        transformed = transform(transformed, editor.view);
      });
      expect(transformed).toBe('');
      expect(safeClipboardPluginKey.get(editor.state)).toBeTruthy();
    } finally {
      editor.destroy();
    }
  });
});
