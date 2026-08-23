import type { Editor } from '@tiptap/react';
import { act, cleanup, fireEvent, render, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
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
});
