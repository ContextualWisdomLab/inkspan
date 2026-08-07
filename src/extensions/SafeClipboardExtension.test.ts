import { Editor, Extension } from '@tiptap/core';
import { Plugin } from '@tiptap/pm/state';
import { describe, expect, it, vi } from 'vitest';
import {
  DEFAULT_CLIPBOARD_HTML_BYTES,
  DEFAULT_CLIPBOARD_MAX_DEPTH,
  DEFAULT_CLIPBOARD_MAX_NODES,
} from './SafeClipboard.js';
import {
  SafeClipboard,
  safeClipboardPluginKey,
  type SafeClipboardOptions,
} from './SafeClipboardExtension.js';
import { buildExtensions } from './kit.js';

/** Invoke the first transform installed by one configured adapter instance. */
function transformFromExtension(
  extension: typeof SafeClipboard,
  html: string,
): string {
  const addPlugins = extension.config.addProseMirrorPlugins;
  if (!addPlugins) throw new Error('SafeClipboard plugin factory is unavailable');
  const plugins = addPlugins.call({ options: extension.options } as never);
  const transform = plugins[0]?.props.transformPastedHTML;
  if (!transform) throw new Error('SafeClipboard paste transform is unavailable');
  return transform(html, {} as never);
}

describe('SafeClipboard TipTap v2 adapter', () => {
  it('runs last in the real ProseMirror transform chain', () => {
    const competingTransform = Extension.create({
      name: 'competingPasteTransform',
      priority: 100,
      addProseMirrorPlugins() {
        return [
          new Plugin({
            props: {
              transformPastedHTML: (html) =>
                `${html}<script>private script</script><img src="https://tracker.example/pixel">`,
            },
          }),
        ];
      },
    });
    const editor = new Editor({
      element: document.createElement('div'),
      extensions: buildExtensions({
        additionalExtensions: [competingTransform],
      }),
      content: '',
    });

    try {
      let transformed = '<p>safe</p>';
      editor.view.someProp('transformPastedHTML', (transform) => {
        transformed = transform(transformed, editor.view);
      });

      expect(transformed).toBe('<p>safe</p>');
      expect(safeClipboardPluginKey.get(editor.state)).toBeTruthy();
    } finally {
      editor.destroy();
    }
  });

  it('reports configured sanitizer failures without disclosing source HTML', () => {
    const onError = vi.fn();
    const configured = SafeClipboard.configure({
      config: { maxHtmlBytes: 1 },
      onError,
      document,
    });

    expect(transformFromExtension(configured, '<p>private source</p>')).toBe('');
    expect(onError).toHaveBeenCalledWith(
      expect.objectContaining({ code: 'input_too_large' }),
    );
    expect(String(onError.mock.calls[0]?.[0])).not.toContain('private source');
  });

  it('contains hostile option access and a throwing host observer', () => {
    const onError = vi.fn(() => {
      throw new Error('private observer failure');
    });
    const hostileOptions = {
      get config() {
        throw new Error('private option failure');
      },
      maxHtmlBytes: DEFAULT_CLIPBOARD_HTML_BYTES,
      maxNodes: DEFAULT_CLIPBOARD_MAX_NODES,
      maxDepth: DEFAULT_CLIPBOARD_MAX_DEPTH,
      onError,
      document,
    } as SafeClipboardOptions;
    const addPlugins = SafeClipboard.config.addProseMirrorPlugins;
    if (!addPlugins) throw new Error('SafeClipboard plugin factory is unavailable');
    const plugins = addPlugins.call({ options: hostileOptions } as never);
    const transform = plugins[0]?.props.transformPastedHTML;
    if (!transform) throw new Error('SafeClipboard paste transform is unavailable');

    expect(() => transform('<p>private source</p>', {} as never)).not.toThrow();
    expect(transform('<p>private source</p>', {} as never)).toBe('');
    expect(onError).toHaveBeenCalledWith(
      expect.objectContaining({
        code: 'invalid_html',
        message: 'Rich clipboard HTML could not be sanitized.',
      }),
    );
    expect(String(onError.mock.calls[0]?.[0])).not.toContain('private option');
  });

  it('fails closed when no host observer is configured', () => {
    const configured = SafeClipboard.configure({
      config: { maxHtmlBytes: 1 },
      document,
    });

    expect(transformFromExtension(configured, '<p>x</p>')).toBe('');
  });
});
