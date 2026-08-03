import type { Editor } from '@tiptap/react';
import { cleanup, render, screen, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import * as Y from 'yjs';
import { CollaborativeCwlEditor } from '../collaboration/CollaborativeCwlEditor.js';
import { CwlEditor } from './CwlEditor.js';

afterEach(cleanup);

function expectLatestDestroyCallback(
  firstReady: ReturnType<typeof vi.fn>,
  replacementReady: ReturnType<typeof vi.fn>,
  firstDestroy: ReturnType<typeof vi.fn>,
  replacementDestroy: ReturnType<typeof vi.fn>,
  editor: Editor,
): void {
  expect(firstReady).toHaveBeenCalledTimes(1);
  expect(firstReady).toHaveBeenCalledWith(editor);
  expect(replacementReady).not.toHaveBeenCalled();
  expect(firstDestroy).not.toHaveBeenCalled();
  expect(replacementDestroy).toHaveBeenCalledTimes(1);
  expect(replacementDestroy).toHaveBeenCalledWith(editor);
}

describe('editor instance lifecycle callbacks', () => {
  it('reports standalone creation once and uses the latest teardown callback', async () => {
    const firstReady = vi.fn();
    const replacementReady = vi.fn();
    const firstDestroy = vi.fn();
    const replacementDestroy = vi.fn();
    const { rerender, unmount } = render(
      <CwlEditor defaultValue="lifecycle" hideToolbar onReady={firstReady} />,
    );
    await screen.findByRole('textbox', { name: 'Rich text editor' });
    await waitFor(() => expect(firstReady).toHaveBeenCalledTimes(1));
    const editor = firstReady.mock.calls[0]![0] as Editor;

    rerender(
      <CwlEditor
        defaultValue="lifecycle"
        hideToolbar
        onReady={replacementReady}
        onDestroy={firstDestroy}
      />,
    );
    rerender(
      <CwlEditor
        defaultValue="lifecycle"
        hideToolbar
        onReady={replacementReady}
        onDestroy={replacementDestroy}
      />,
    );

    expect(firstReady).toHaveBeenCalledTimes(1);
    expect(replacementReady).not.toHaveBeenCalled();
    unmount();
    await waitFor(() => expect(replacementDestroy).toHaveBeenCalledTimes(1));
    expectLatestDestroyCallback(
      firstReady,
      replacementReady,
      firstDestroy,
      replacementDestroy,
      editor,
    );
  });

  it('provides the same per-instance lifecycle for collaborative editing', async () => {
    const collaborationDocument = new Y.Doc();
    const firstReady = vi.fn();
    const replacementReady = vi.fn();
    const firstDestroy = vi.fn();
    const replacementDestroy = vi.fn();
    const { rerender, unmount } = render(
      <CollaborativeCwlEditor
        document={collaborationDocument}
        hideToolbar
        onReady={firstReady}
      />,
    );
    await screen.findByRole('textbox', {
      name: 'Collaborative rich text editor',
    });
    await waitFor(() => expect(firstReady).toHaveBeenCalledTimes(1));
    const editor = firstReady.mock.calls[0]![0] as Editor;

    rerender(
      <CollaborativeCwlEditor
        document={collaborationDocument}
        hideToolbar
        onReady={replacementReady}
        onDestroy={firstDestroy}
      />,
    );
    rerender(
      <CollaborativeCwlEditor
        document={collaborationDocument}
        hideToolbar
        onReady={replacementReady}
        onDestroy={replacementDestroy}
      />,
    );

    expect(firstReady).toHaveBeenCalledTimes(1);
    expect(replacementReady).not.toHaveBeenCalled();
    unmount();
    await waitFor(() => expect(replacementDestroy).toHaveBeenCalledTimes(1));
    expectLatestDestroyCallback(
      firstReady,
      replacementReady,
      firstDestroy,
      replacementDestroy,
      editor,
    );
    collaborationDocument.destroy();
  });
});
