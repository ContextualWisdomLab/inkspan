import { Editor, Extension } from '@tiptap/core';
import { describe, expect, it } from 'vitest';
import { sanitizeRichClipboardHtml } from './SafeClipboard.js';
import { buildExtensions } from './kit.js';

/** Apply registered TipTap HTML transforms in their actual priority order. */
function transformThroughRegisteredExtensions(
  editor: Editor,
  sourceHtml: string,
): string {
  return editor.extensionManager.extensions.reduce((currentHtml, extension) => {
    const transform = extension.config.transformPastedHTML;
    return transform === undefined
      ? currentHtml
      : transform.call(
          {
            editor,
            options: extension.options,
            storage: extension.storage,
          } as never,
          currentHtml,
        );
  }, sourceHtml);
}

describe('SafeClipboard security regressions', () => {
  it('detects Office hidden declarations from raw style text without false positives', () => {
    const sanitized = sanitizeRichClipboardHtml(
      `<p style="mso-hide: all">ordinary hidden secret</p>
       <p style="MSO-HIDE : ALL !important">case hidden secret</p>
       <p style="mso-/*office*/hide: a/*word*/ll !important">comment hidden secret</p>
       <p style="mso-hide: all/*">unterminated comment hidden secret</p>
       <p style="mso-\\68 ide: \\61ll">hex escaped hidden secret</p>
       <p style="mso-h\\ide: a\\ll">simple escaped hidden secret</p>
       <p style="mso-\\000068ide: all">six-digit escaped hidden secret</p>
       <p style="mso-hide: none">none remains visible</p>
       <p style="mso-hide: alligator">alligator remains visible</p>
       <p style="mso-\\68 ide: \\61lligator">escaped alligator remains visible</p>
       <p style="not-mso-hide: all">prefixed property remains visible</p>
       <p style="mso-\\0 hide: all">null escape remains visible</p>
       <p style="mso-\\d800 hide: all">surrogate escape remains visible</p>
       <p style="mso-\\110000 hide: all">out of range escape remains visible</p>
       <p style="mso-hide\\: all">trailing escape remains visible</p>
       <p style="mso-\\
       hide: all">newline escape remains visible</p>`,
      {},
      document,
    );
    const container = document.createElement('div');
    container.innerHTML = sanitized;

    expect(container).not.toHaveTextContent('ordinary hidden secret');
    expect(container).not.toHaveTextContent('case hidden secret');
    expect(container).not.toHaveTextContent('comment hidden secret');
    expect(container).not.toHaveTextContent('unterminated comment hidden secret');
    expect(container).not.toHaveTextContent('hex escaped hidden secret');
    expect(container).not.toHaveTextContent('simple escaped hidden secret');
    expect(container).not.toHaveTextContent('six-digit escaped hidden secret');
    expect(container).toHaveTextContent('none remains visible');
    expect(container).toHaveTextContent('alligator remains visible');
    expect(container).toHaveTextContent('escaped alligator remains visible');
    expect(container).toHaveTextContent('prefixed property remains visible');
    expect(container).toHaveTextContent('null escape remains visible');
    expect(container).toHaveTextContent('surrogate escape remains visible');
    expect(container).toHaveTextContent('out of range escape remains visible');
    expect(container).toHaveTextContent('trailing escape remains visible');
    expect(container).toHaveTextContent('newline escape remains visible');
  });

  it('drops visibility-collapse subtrees that browsers do not render', () => {
    const sanitized = sanitizeRichClipboardHtml(
      `<table>
         <tbody>
           <tr style="visibility: collapse"><td>collapsed row secret</td></tr>
           <tr><td style="visibility: collapse">collapsed cell secret</td></tr>
           <tr><td>visible table content</td></tr>
         </tbody>
       </table>
       <p style="visibility: collapse">collapsed ordinary secret</p>`,
      {},
      document,
    );
    const container = document.createElement('div');
    container.innerHTML = sanitized;

    expect(container).not.toHaveTextContent('collapsed row secret');
    expect(container).not.toHaveTextContent('collapsed cell secret');
    expect(container).not.toHaveTextContent('collapsed ordinary secret');
    expect(container).toHaveTextContent('visible table content');
  });

  it('drops metadata titles instead of surfacing document metadata as editor text', () => {
    const sanitized = sanitizeRichClipboardHtml(
      '<p>visible</p><title>metadata title secret</title>',
      {},
      document,
    );
    const container = document.createElement('div');
    container.innerHTML = sanitized;

    expect(container).toHaveTextContent('visible');
    expect(container).not.toHaveTextContent('metadata title secret');
    expect(container.querySelectorAll('title')).toHaveLength(0);
  });

  it('drops native-widget and obsolete fallback text instead of surfacing it', () => {
    const sanitized = sanitizeRichClipboardHtml(
      `<p>visible ordinary content</p>
       <progress value="1" max="2">progress fallback secret</progress>
       <meter value="0.5">meter fallback secret</meter>
       <noframes>frames fallback secret</noframes>
       <noembed>embed fallback secret</noembed>`,
      {},
      document,
    );
    const container = document.createElement('div');
    container.innerHTML = sanitized;

    expect(container).toHaveTextContent('visible ordinary content');
    expect(container).not.toHaveTextContent('progress fallback secret');
    expect(container).not.toHaveTextContent('meter fallback secret');
    expect(container).not.toHaveTextContent('frames fallback secret');
    expect(container).not.toHaveTextContent('embed fallback secret');
    expect(
      container.querySelectorAll('progress, meter, noframes, noembed'),
    ).toHaveLength(0);
  });

  it('preserves only rendered disclosure content from closed interactive elements', () => {
    const sanitized = sanitizeRichClipboardHtml(
      `<details>
         <summary>closed details summary</summary>
         <p>closed details secret</p>
       </details>
       <details><p>summaryless details secret</p></details>
       <details open>
         <summary>open details summary</summary>
         <p>open details content</p>
       </details>
       <dialog><p>closed dialog secret</p></dialog>
       <dialog open><p>open dialog content</p></dialog>`,
      {},
      document,
    );
    const container = document.createElement('div');
    container.innerHTML = sanitized;

    expect(container).toHaveTextContent('closed details summary');
    expect(container).not.toHaveTextContent('closed details secret');
    expect(container).not.toHaveTextContent('summaryless details secret');
    expect(container).toHaveTextContent('open details summary');
    expect(container).toHaveTextContent('open details content');
    expect(container).not.toHaveTextContent('closed dialog secret');
    expect(container).toHaveTextContent('open dialog content');
    expect(container.querySelectorAll('details, summary, dialog')).toHaveLength(0);
  });

  it('remains the final ordinary paste transform after host extensions', () => {
    const resourceReintroducer = Extension.create({
      name: 'resourceReintroducer',
      priority: 100,
      transformPastedHTML(html: string) {
        return `${html}<img src="https://tracker.example/pixel" alt="tracking secret"><script>script secret</script>`;
      },
    });
    const editor = new Editor({
      content: '<p></p>',
      extensions: buildExtensions({
        additionalExtensions: [resourceReintroducer],
      }),
    });

    try {
      const transforms = editor.extensionManager.extensions.filter(
        (extension) => extension.config.transformPastedHTML !== undefined,
      );
      expect(transforms.at(-1)?.name).toBe('safeClipboard');

      const sanitized = transformThroughRegisteredExtensions(
        editor,
        '<p>safe content</p>',
      );
      const container = document.createElement('div');
      container.innerHTML = sanitized;

      expect(container).toHaveTextContent('safe content');
      expect(container).not.toHaveTextContent('tracking secret');
      expect(container).not.toHaveTextContent('script secret');
      expect(container.querySelectorAll('img, script')).toHaveLength(0);
    } finally {
      editor.destroy();
    }
  });
});
