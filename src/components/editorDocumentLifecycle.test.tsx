import type { Editor } from '@tiptap/react';
import { act, cleanup, render, screen } from '@testing-library/react';
import { createRef } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import * as Y from 'yjs';
import { CollaborativeCwlEditor } from '../collaboration/CollaborativeCwlEditor.js';
import type {
  CwlEditorDocumentChangeEvent,
  CwlEditorHandle,
} from '../types.js';
import { CwlEditor } from './CwlEditor.js';

afterEach(cleanup);

function expectPortableSnapshot(
  changeEvent: CwlEditorDocumentChangeEvent,
  editor: Editor,
): void {
  expect(changeEvent.editor).toBe(editor);
  expect(Object.isFrozen(changeEvent.snapshot)).toBe(true);
  expect(changeEvent.snapshot.html).toContain('Draft');
  expect(changeEvent.snapshot.markdown).toContain('Draft');
  expect(changeEvent.snapshot.plainText).toContain('Draft');
  expect(changeEvent.snapshot.isEmpty).toBe(false);
}

describe('editor document snapshot lifecycle', () => {
  it('uses live standalone callbacks and keeps one stable editor revision per snapshot', async () => {
    const editorRef = createRef<CwlEditorHandle>();
    let editor: Editor | undefined;
    const onChange = vi.fn();
    const firstSnapshotCallback = vi.fn();
    const replacementSnapshotCallback = vi.fn();
    const { rerender } = render(
      <CwlEditor
        ref={editorRef}
        defaultValue="Draft"
        hideToolbar
        onReady={(instance) => {
          editor = instance;
        }}
      />,
    );
    await screen.findByRole('textbox', { name: 'Rich text editor' });
    expect(editor).toBeDefined();

    act(() => {
      editor!.chain().focus('end').insertContent(' initial').run();
    });
    expect(firstSnapshotCallback).not.toHaveBeenCalled();

    rerender(
      <CwlEditor
        ref={editorRef}
        defaultValue="Draft"
        hideToolbar
        onChange={onChange}
        onDocumentChange={firstSnapshotCallback}
        onReady={(instance) => {
          editor = instance;
        }}
      />,
    );
    const stableEditor = editor;
    act(() => {
      editor!.chain().focus('end').insertContent(' markdown').run();
    });

    expect(firstSnapshotCallback).toHaveBeenCalledTimes(1);
    const markdownEvent = firstSnapshotCallback.mock
      .calls[0]![0] as CwlEditorDocumentChangeEvent;
    expectPortableSnapshot(markdownEvent, editor!);
    expect(markdownEvent.snapshot.mode).toBe('markdown');
    expect(markdownEvent.snapshot.value).toBe(markdownEvent.snapshot.markdown);
    expect(onChange).toHaveBeenLastCalledWith(markdownEvent.snapshot.value);
    expect(editorRef.current!.getSnapshot()).toEqual(markdownEvent.snapshot);

    rerender(
      <CwlEditor
        ref={editorRef}
        mode="html"
        defaultValue="Draft"
        hideToolbar
        onChange={onChange}
        onDocumentChange={replacementSnapshotCallback}
        onReady={(instance) => {
          editor = instance;
        }}
      />,
    );
    expect(editor).toBe(stableEditor);
    act(() => {
      editor!.chain().focus('end').insertContent(' html').run();
    });

    expect(firstSnapshotCallback).toHaveBeenCalledTimes(1);
    expect(replacementSnapshotCallback).toHaveBeenCalledTimes(1);
    const htmlEvent = replacementSnapshotCallback.mock
      .calls[0]![0] as CwlEditorDocumentChangeEvent;
    expectPortableSnapshot(htmlEvent, editor!);
    expect(htmlEvent.snapshot.mode).toBe('html');
    expect(htmlEvent.snapshot.value).toBe(htmlEvent.snapshot.html);
    expect(onChange).toHaveBeenLastCalledWith(htmlEvent.snapshot.html);
    expect(editorRef.current!.getSnapshot()).toEqual(htmlEvent.snapshot);
  });

  it('provides the same live snapshot contract for collaborative documents', async () => {
    const collaborationDocument = new Y.Doc();
    const editorRef = createRef<CwlEditorHandle>();
    let editor: Editor | undefined;
    const onChange = vi.fn();
    const firstSnapshotCallback = vi.fn();
    const replacementSnapshotCallback = vi.fn();
    const { rerender, unmount } = render(
      <CollaborativeCwlEditor
        ref={editorRef}
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
      editor!.commands.insertContent('Draft initial');
    });
    expect(firstSnapshotCallback).not.toHaveBeenCalled();

    rerender(
      <CollaborativeCwlEditor
        ref={editorRef}
        document={collaborationDocument}
        hideToolbar
        onDocumentChange={firstSnapshotCallback}
        onReady={(instance) => {
          editor = instance;
        }}
      />,
    );
    const stableEditor = editor;
    act(() => {
      editor!.chain().focus('end').insertContent(' markdown').run();
    });

    expect(firstSnapshotCallback).toHaveBeenCalledTimes(1);
    const markdownEvent = firstSnapshotCallback.mock
      .calls[0]![0] as CwlEditorDocumentChangeEvent;
    expectPortableSnapshot(markdownEvent, editor!);
    expect(markdownEvent.snapshot.mode).toBe('markdown');
    expect(markdownEvent.snapshot.value).toBe(markdownEvent.snapshot.markdown);
    expect(editorRef.current!.getSnapshot()).toEqual(markdownEvent.snapshot);

    rerender(
      <CollaborativeCwlEditor
        ref={editorRef}
        document={collaborationDocument}
        mode="html"
        hideToolbar
        onChange={onChange}
        onDocumentChange={replacementSnapshotCallback}
        onReady={(instance) => {
          editor = instance;
        }}
      />,
    );
    expect(editor).toBe(stableEditor);
    act(() => {
      editor!.chain().focus('end').insertContent(' html').run();
    });

    expect(firstSnapshotCallback).toHaveBeenCalledTimes(1);
    expect(replacementSnapshotCallback).toHaveBeenCalledTimes(1);
    const htmlEvent = replacementSnapshotCallback.mock
      .calls[0]![0] as CwlEditorDocumentChangeEvent;
    expectPortableSnapshot(htmlEvent, editor!);
    expect(htmlEvent.snapshot.mode).toBe('html');
    expect(htmlEvent.snapshot.value).toBe(htmlEvent.snapshot.html);
    expect(onChange).toHaveBeenLastCalledWith(htmlEvent.snapshot.html);
    expect(editorRef.current!.getSnapshot()).toEqual(htmlEvent.snapshot);

    unmount();
    collaborationDocument.destroy();
  });
});
