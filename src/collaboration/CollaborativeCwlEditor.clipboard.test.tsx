import { cleanup, render, waitFor } from '@testing-library/react';
import type { Editor } from '@tiptap/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import * as Y from 'yjs';
import { CollaborativeCwlEditor } from './CollaborativeCwlEditor.js';

afterEach(cleanup);

/** Invoke the installed SafeClipboard transform on a collaborative editor. */
function transformRichClipboard(editor: Editor, html: string): string {
  const extension = editor.extensionManager.extensions.find(
    (candidate) => candidate.name === 'safeClipboard',
  );
  const transform = extension?.config.transformPastedHTML;
  if (!extension || !transform) throw new Error('SafeClipboard is not installed');
  return transform.call({ options: extension.options } as never, html);
}

describe('CollaborativeCwlEditor safe rich clipboard integration', () => {
  it('uses the same sanitizer and latest callback without recreating the Yjs binding', async () => {
    const collaborationDocument = new Y.Doc();
    const firstCallback = vi.fn();
    const latestCallback = vi.fn();
    const onReady = vi.fn();
    let editor: Editor | undefined;
    const { rerender } = render(
      <CollaborativeCwlEditor
        document={collaborationDocument}
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
      <CollaborativeCwlEditor
        document={collaborationDocument}
        clipboard={{ maxHtmlBytes: 1 }}
        onClipboardError={latestCallback}
        onReady={(instance) => {
          editor = instance;
          onReady(instance);
        }}
      />,
    );

    expect(transformRichClipboard(editor!, '<p>collaboration private</p>')).toBe(
      '',
    );
    expect(editor).toBe(initialEditor);
    expect(onReady).toHaveBeenCalledTimes(1);
    expect(firstCallback).not.toHaveBeenCalled();
    expect(latestCallback).toHaveBeenCalledTimes(1);
    expect(latestCallback.mock.calls[0]?.[0]).toMatchObject({
      code: 'input_too_large',
    });
    expect(String(latestCallback.mock.calls[0]?.[0])).not.toContain(
      'collaboration private',
    );
  });
});
