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
    await waitFor(() => expect(onChange).toHaveBeenCalledTimes(1));
    expect(onChange).toHaveBeenLastCalledWith('Original');
    expect(onDocumentChange).not.toHaveBeenCalled();
    onChange.mockClear();

    const editable = document.querySelector('.ProseMirror') as HTMLElement;
    expect(editable).toBe(editor!.view.dom);
    fireEvent.compositionStart(editable, { data: '' });
    expect(editor!.view.composing).toBe(true);
    expect(onDocumentChange).not.toHaveBeenCalled();

    act(() => {
      editor!.chain().focus('end').insertContent(' composing').run();
    });

    expect(editor!.view.composing).toBe(true);
    expect(editor!.getText()).toBe('Original composing');
    expect(onChange).toHaveBeenLastCalledWith('Original composing');
    expect(onDocumentChange).not.toHaveBeenCalled();

    fireEvent.compositionEnd(editable, { data: '' });
    await waitFor(() => {
      expect(editor!.view.composing).toBe(false);
      expect(onDocumentChange).toHaveBeenCalledTimes(1);
    });
    expect(onDocumentChange.mock.calls[0]![0].snapshot.value).toBe(
      'Original composing',
    );

    act(() => {
      editor!.chain().focus('end').insertContent(' committed').run();
    });

    expect(onDocumentChange).toHaveBeenCalledTimes(2);
    expect(onDocumentChange.mock.calls[1]![0].snapshot.value).toBe(
      'Original composing committed',
    );
  });

  it('publishes the finalized composition snapshot when composition ends', async () => {
    let editor: Editor | undefined;
    const onDocumentChange = vi.fn();

    render(
      <CwlEditor
        mode="markdown"
        defaultValue="Original"
        onDocumentChange={onDocumentChange}
        onReady={(instance) => {
          editor = instance;
        }}
      />,
    );
    await waitFor(() => expect(editor).toBeTruthy());
    expect(onDocumentChange).not.toHaveBeenCalled();

    const editable = editor!.view.dom;
    fireEvent.compositionStart(editable, { data: '' });
    act(() => {
      editor!.chain().focus('end').insertContent(' composing').run();
    });
    expect(onDocumentChange).not.toHaveBeenCalled();

    fireEvent.compositionEnd(editable, { data: '' });

    await waitFor(() => {
      expect(editor!.view.composing).toBe(false);
      expect(onDocumentChange).toHaveBeenCalledTimes(1);
    });
    expect(onDocumentChange.mock.calls[0]![0].snapshot.value).toBe(
      'Original composing',
    );
  });

  it('publishes the finalized local composition before applying a deferred controlled value', async () => {
    let editor: Editor | undefined;
    const onDocumentChange = vi.fn();
    const captureEditor = (instance: Editor) => {
      editor = instance;
    };

    const { rerender } = render(
      <CwlEditor
        mode="markdown"
        value="Original"
        onDocumentChange={onDocumentChange}
        onReady={captureEditor}
      />,
    );
    await waitFor(() => expect(editor).toBeTruthy());

    const editable = editor!.view.dom;
    fireEvent.compositionStart(editable, { data: '' });
    act(() => {
      editor!.chain().focus('end').insertContent(' composing').run();
    });
    expect(editor!.getText()).toBe('Original composing');
    expect(onDocumentChange).not.toHaveBeenCalled();

    await act(async () => {
      rerender(
        <CwlEditor
          mode="markdown"
          value="Host replacement"
          onDocumentChange={onDocumentChange}
          onReady={captureEditor}
        />,
      );
    });
    expect(editor!.view.composing).toBe(true);
    expect(editor!.getText()).toBe('Original composing');

    fireEvent.compositionEnd(editable, { data: '' });

    await waitFor(() => expect(editor!.getText()).toBe('Host replacement'));
    await waitFor(() => expect(onDocumentChange).toHaveBeenCalledTimes(1));
    expect(onDocumentChange.mock.calls[0]![0].snapshot.value).toBe(
      'Original composing',
    );
  });
});
