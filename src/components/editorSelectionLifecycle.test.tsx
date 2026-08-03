import type { Editor } from '@tiptap/react';
import { act, cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import * as Y from 'yjs';
import { CollaborativeCwlEditor } from '../collaboration/CollaborativeCwlEditor.js';
import { CwlEditor } from './CwlEditor.js';

afterEach(cleanup);

function expectRangeSnapshot(
  callback: ReturnType<typeof vi.fn>,
  editor: Editor,
): void {
  expect(callback).toHaveBeenCalledTimes(1);
  const selectionEvent = callback.mock.calls[0]![0];
  expect(selectionEvent.editor).toBe(editor);
  expect(selectionEvent.selection).toEqual({
    anchor: 2,
    head: 4,
    from: 2,
    to: 4,
    empty: false,
  });
}

function expectCaretSnapshot(
  callback: ReturnType<typeof vi.fn>,
  editor: Editor,
): void {
  expect(callback).toHaveBeenCalledTimes(1);
  const selectionEvent = callback.mock.calls[0]![0];
  expect(selectionEvent.editor).toBe(editor);
  expect(selectionEvent.selection).toEqual({
    anchor: 3,
    head: 3,
    from: 3,
    to: 3,
    empty: true,
  });
}

describe('editor selection lifecycle callbacks', () => {
  it('uses live standalone callbacks and emits detached position snapshots', async () => {
    let editor: Editor | undefined;
    const firstCallback = vi.fn();
    const replacementCallback = vi.fn();
    const { rerender } = render(
      <CwlEditor
        defaultValue="abcd"
        hideToolbar
        onReady={(instance) => {
          editor = instance;
        }}
      />,
    );
    await screen.findByRole('textbox', { name: 'Rich text editor' });
    expect(editor).toBeDefined();

    act(() => {
      editor!.commands.setTextSelection(1);
    });
    expect(firstCallback).not.toHaveBeenCalled();

    rerender(
      <CwlEditor
        defaultValue="abcd"
        hideToolbar
        onReady={(instance) => {
          editor = instance;
        }}
        onSelectionChange={firstCallback}
      />,
    );
    act(() => {
      editor!.commands.setTextSelection({ from: 2, to: 4 });
    });
    expectRangeSnapshot(firstCallback, editor!);

    rerender(
      <CwlEditor
        defaultValue="abcd"
        hideToolbar
        onReady={(instance) => {
          editor = instance;
        }}
        onSelectionChange={replacementCallback}
      />,
    );
    act(() => {
      editor!.commands.setTextSelection(3);
    });
    expect(firstCallback).toHaveBeenCalledTimes(1);
    expectCaretSnapshot(replacementCallback, editor!);
  });

  it('provides the same local selection contract for collaborative editing', async () => {
    const collaborationDocument = new Y.Doc();
    let editor: Editor | undefined;
    const firstCallback = vi.fn();
    const replacementCallback = vi.fn();
    const { rerender, unmount } = render(
      <CollaborativeCwlEditor
        document={collaborationDocument}
        hideToolbar
        onReady={(instance) => {
          editor = instance;
        }}
      />,
    );
    await screen.findByRole('textbox', {
      name: 'Collaborative rich text editor',
    });
    expect(editor).toBeDefined();

    act(() => {
      editor!.commands.insertContent('abcd');
      editor!.commands.setTextSelection(1);
    });
    expect(firstCallback).not.toHaveBeenCalled();

    rerender(
      <CollaborativeCwlEditor
        document={collaborationDocument}
        hideToolbar
        onReady={(instance) => {
          editor = instance;
        }}
        onSelectionChange={firstCallback}
      />,
    );
    act(() => {
      editor!.commands.setTextSelection({ from: 2, to: 4 });
    });
    expectRangeSnapshot(firstCallback, editor!);

    rerender(
      <CollaborativeCwlEditor
        document={collaborationDocument}
        hideToolbar
        onReady={(instance) => {
          editor = instance;
        }}
        onSelectionChange={replacementCallback}
      />,
    );
    act(() => {
      editor!.commands.setTextSelection(3);
    });
    expect(firstCallback).toHaveBeenCalledTimes(1);
    expectCaretSnapshot(replacementCallback, editor!);

    unmount();
    collaborationDocument.destroy();
  });
});
