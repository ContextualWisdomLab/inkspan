import { cleanup, render, waitFor } from '@testing-library/react';
import type { Editor } from '@tiptap/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { ClipboardConfig } from '../extensions/SafeClipboard.js';
import { CwlEditor } from './CwlEditor.js';

afterEach(cleanup);

/** Invoke the complete ProseMirror HTML-paste transform chain before parsing. */
function transformRichClipboard(editor: Editor, html: string): string {
  let transformed = html;
  let applied = false;
  editor.view.someProp('transformPastedHTML', (transform) => {
    applied = true;
    transformed = transform(transformed, editor.view);
  });
  if (!applied) throw new Error('SafeClipboard paste transform is not installed');
  return transformed;
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

  it('defers hostile clipboard configuration validation until paste', async () => {
    const accessor = vi.fn(() => {
      throw new Error('private configuration value');
    });
    const clipboard = Object.defineProperty({}, 'maxHtmlBytes', {
      configurable: true,
      enumerable: true,
      get: accessor,
    }) as ClipboardConfig;
    const onClipboardError = vi.fn();
    let editor: Editor | undefined;

    render(
      <CwlEditor
        clipboard={clipboard}
        onClipboardError={onClipboardError}
        onReady={(instance) => {
          editor = instance;
        }}
      />,
    );
    await waitFor(() => expect(editor).toBeTruthy());

    expect(accessor).not.toHaveBeenCalled();
    expect(transformRichClipboard(editor!, '<p>private source</p>')).toBe('');
    expect(accessor).not.toHaveBeenCalled();
    expect(onClipboardError).toHaveBeenCalledTimes(1);
    expect(onClipboardError.mock.calls[0]?.[0]).toMatchObject({
      code: 'invalid_configuration',
      message: 'Rich clipboard configuration is invalid.',
    });
    expect(String(onClipboardError.mock.calls[0]?.[0])).not.toContain(
      'private configuration value',
    );
  });
});
