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
       <p style="mso-hide: none">none remains visible</p>
       <p style="mso-hide: alligator">alligator remains visible</p>
       <p style="not-mso-hide: all">prefixed property remains visible</p>`,
      {},
      document,
    );
    const container = document.createElement('div');
    container.innerHTML = sanitized;

    expect(container).not.toHaveTextContent('ordinary hidden secret');
    expect(container).not.toHaveTextContent('case hidden secret');
    expect(container).not.toHaveTextContent('comment hidden secret');
    expect(container).toHaveTextContent('none remains visible');
    expect(container).toHaveTextContent('alligator remains visible');
    expect(container).toHaveTextContent('prefixed property remains visible');
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
