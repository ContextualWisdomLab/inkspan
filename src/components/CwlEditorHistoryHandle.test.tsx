import { act, render, waitFor } from '@testing-library/react';
import { forwardRef, createRef, useRef } from 'react';
import { describe, expect, it } from 'vitest';
import type { CwlEditorHandle, EditorMode } from '../types.js';
import { CwlEditor } from './CwlEditor.js';
import { useEditorHandle } from './useEditorHandle.js';

const NullEditorHandleHarness = forwardRef<CwlEditorHandle>((_, ref) => {
  const modeRef = useRef<EditorMode>('markdown');
  useEditorHandle(ref, null, modeRef);
  return null;
});

describe('CwlEditor imperative history control', () => {
  it('exposes host-safe undo/redo capability and execution on a real editor', async () => {
    const editorRef = createRef<CwlEditorHandle>();
    render(<CwlEditor ref={editorRef} defaultValue="Original" />);
    await waitFor(() => expect(editorRef.current?.getEditor()).toBeTruthy());

    const handle = editorRef.current!;
    expect(typeof handle.canUndo).toBe('function');
    expect(typeof handle.undo).toBe('function');
    expect(typeof handle.canRedo).toBe('function');
    expect(typeof handle.redo).toBe('function');

    await act(async () => {
      handle.getEditor()!.chain().focus('end').insertContent(' updated').run();
    });
    expect(handle.getMarkdown()).toBe('Original updated');
    expect(handle.canUndo()).toBe(true);

    await act(async () => {
      expect(handle.undo()).toBe(true);
    });
    expect(handle.getMarkdown()).toBe('Original');
    expect(handle.canRedo()).toBe(true);

    await act(async () => {
      expect(handle.redo()).toBe(true);
    });
    expect(handle.getMarkdown()).toBe('Original updated');
  });

  it('fails closed when the shared handle has no active editor instance', () => {
    const editorRef = createRef<CwlEditorHandle>();
    render(<NullEditorHandleHarness ref={editorRef} />);

    const handle = editorRef.current!;
    expect(typeof handle.canUndo).toBe('function');
    expect(typeof handle.undo).toBe('function');
    expect(typeof handle.canRedo).toBe('function');
    expect(typeof handle.redo).toBe('function');
    expect(handle.canUndo()).toBe(false);
    expect(handle.undo()).toBe(false);
    expect(handle.canRedo()).toBe(false);
    expect(handle.redo()).toBe(false);
  });

  it('fails closed on a retained handle after its editor is destroyed', async () => {
    const editorRef = createRef<CwlEditorHandle>();
    render(<CwlEditor ref={editorRef} defaultValue="Original" />);
    await waitFor(() => expect(editorRef.current?.getEditor()).toBeTruthy());

    const handle = editorRef.current!;
    const editor = handle.getEditor()!;
    await act(async () => {
      editor.chain().focus('end').insertContent(' updated').run();
    });
    expect(handle.canUndo()).toBe(true);

    act(() => editor.destroy());
    expect(editor.isDestroyed).toBe(true);
    expect(handle.getEditor()).toBeNull();
    expect(handle.canUndo()).toBe(false);
    expect(handle.undo()).toBe(false);
    expect(handle.canRedo()).toBe(false);
    expect(handle.redo()).toBe(false);

    expect(handle.getValue()).toBe('');
    expect(handle.getHTML()).toBe('');
    expect(handle.getMarkdown()).toBe('');
    expect(handle.getSnapshot()).toEqual({
      mode: 'markdown',
      value: '',
      html: '',
      markdown: '',
      plainText: '',
      documentJson: null,
      isEmpty: true,
    });
    expect(handle.getDocumentEnvelope()).toBeNull();
    expect(handle.getDocumentEnvelopeJson()).toBe('');
    expect(handle.getDocumentEnvelopeBytes()).toEqual(new Uint8Array());
    expect(handle.validateDocumentEnvelope({})).toBe(false);
    expect(handle.validateDocumentEnvelopeBytes(new Uint8Array())).toBe(false);
    expect(handle.validateDocumentJson({ type: 'doc', content: [] })).toBe(false);
    expect(handle.isEmpty()).toBe(true);
    expect(() => handle.focus()).not.toThrow();
    expect(() => handle.blur()).not.toThrow();
    expect(() => handle.setValue('ignored')).not.toThrow();
    expect(() => handle.clear()).not.toThrow();
  });
});
