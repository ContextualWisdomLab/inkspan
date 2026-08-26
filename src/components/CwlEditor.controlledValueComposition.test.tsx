import type { Editor } from '@tiptap/react';
import { act, cleanup, fireEvent, render, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { CwlEditor } from './CwlEditor.js';

afterEach(cleanup);

describe('CwlEditor controlled value during composition', () => {
  it('defers host replacement until composition ends and applies the latest value', async () => {
    let editor: Editor | undefined;
    const captureEditor = (instance: Editor) => {
      editor = instance;
    };

    const { rerender } = render(
      <CwlEditor mode="markdown" value="Original" onReady={captureEditor} />,
    );
    await waitFor(() => expect(editor).toBeTruthy());

    const editable = document.querySelector('.ProseMirror') as HTMLElement;
    fireEvent.compositionStart(editable, { data: '' });
    expect(editor!.view.composing).toBe(true);

    await act(async () => {
      rerender(
        <CwlEditor mode="markdown" value="First host value" onReady={captureEditor} />,
      );
    });
    expect(editor!.view.composing).toBe(true);
    expect(editor!.getText()).toBe('Original');

    await act(async () => {
      rerender(
        <CwlEditor mode="markdown" value="Latest host value" onReady={captureEditor} />,
      );
    });
    expect(editor!.view.composing).toBe(true);
    expect(editor!.getText()).toBe('Original');

    fireEvent.compositionEnd(editable, { data: '' });

    await waitFor(() => {
      expect(editor!.view.composing).toBe(false);
      expect(editor!.getText()).toBe('Latest host value');
    });
  });

  it('keeps intermediate composition text out of document snapshot callbacks', async () => {
    let editor: Editor | undefined;
    const onChange = vi.fn();
    const onDocumentChange = vi.fn();

    render(
      <CwlEditor
        mode="markdown"
        defaultValue="Original"
        onChange={onChange}
        onDocumentChange={onDocumentChange}
        onReady={(instance) => {
          editor = instance;
        }}
      />,
    );
    await waitFor(() => expect(editor).toBeTruthy());

    const editable = document.querySelector('.ProseMirror') as HTMLElement;
    fireEvent.compositionStart(editable, { data: '' });
    expect(editor!.view.composing).toBe(true);

    act(() => {
      editor!.chain().focus('end').insertContent(' composing').run();
    });

    expect(editor!.getText()).toBe('Original composing');
    expect(onChange).toHaveBeenLastCalledWith('Original composing');
    expect(onDocumentChange).not.toHaveBeenCalled();

    fireEvent.compositionEnd(editable, { data: '' });
    await waitFor(() => expect(editor!.view.composing).toBe(false));

    act(() => {
      editor!.chain().focus('end').insertContent(' committed').run();
    });

    expect(onDocumentChange).toHaveBeenCalledTimes(1);
    expect(onDocumentChange.mock.calls[0]![0].snapshot.value).toBe(
      'Original composing committed',
    );
  });
});
