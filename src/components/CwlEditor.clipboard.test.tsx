import { cleanup, render, waitFor } from '@testing-library/react';
import type { Editor } from '@tiptap/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { CwlEditor } from './CwlEditor.js';

afterEach(cleanup);

/** Invoke the installed SafeClipboard transform exactly as TipTap does. */
function transformRichClipboard(editor: Editor, html: string): string {
  const extension = editor.extensionManager.extensions.find(
    (candidate) => candidate.name === 'safeClipboard',
  );
  const transform = extension?.config.transformPastedHTML;
  if (!extension || !transform) throw new Error('SafeClipboard is not installed');
  return transform.call({ options: extension.options } as never, html);
}

describe('CwlEditor safe rich clipboard integration', () => {
  it('sanitizes rich HTML before parsing on the standalone surface', async () => {
    let editor: Editor | undefined;
    render(
      <CwlEditor
        defaultValue=""
        onReady={(instance) => {
          editor = instance;
        }}
      />,
    );
    await waitFor(() => expect(editor).toBeTruthy());

    const transformed = transformRichClipboard(
      editor!,
      '<p class="MsoNormal" style="font-weight:700">safe<img src="https://tracker.example/pixel"><script>secret</script></p>',
    );

    expect(transformed).toBe('<p><strong>safe</strong></p>');
  });

  it('uses the latest host clipboard error callback without recreating the editor', async () => {
    const firstCallback = vi.fn();
    const latestCallback = vi.fn();
    const onReady = vi.fn();
    let editor: Editor | undefined;
    const { rerender } = render(
      <CwlEditor
        clipboard={{ maxHtmlBytes: 1 }}
        onClipboardError={firstCallback}
        onReady={(instance) => {
          editor = instance;
          onReady(instance);
        }}
      />,
    );
    await waitFor(() => expect(editor).toBeTruthy());
    const initialEditor = editor;

    rerender(
      <CwlEditor
        clipboard={{ maxHtmlBytes: 1 }}
        onClipboardError={latestCallback}
        onReady={(instance) => {
          editor = instance;
          onReady(instance);
        }}
      />,
    );

    expect(transformRichClipboard(editor!, '<p>private source</p>')).toBe('');
    expect(editor).toBe(initialEditor);
    expect(onReady).toHaveBeenCalledTimes(1);
    expect(firstCallback).not.toHaveBeenCalled();
    expect(latestCallback).toHaveBeenCalledTimes(1);
    expect(latestCallback.mock.calls[0]?.[0]).toMatchObject({
      code: 'input_too_large',
    });
    expect(String(latestCallback.mock.calls[0]?.[0])).not.toContain(
      'private source',
    );
  });
});
