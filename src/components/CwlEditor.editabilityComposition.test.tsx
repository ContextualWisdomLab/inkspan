import { cleanup, fireEvent, render, waitFor } from '@testing-library/react';
import type { Editor } from '@tiptap/react';
import { afterEach, describe, expect, it } from 'vitest';
import { CwlEditor } from './CwlEditor.js';

afterEach(cleanup);

describe('CwlEditor editability transition during composition', () => {
  it('clears local composition state before revoking edit authority', async () => {
    let editor: Editor | undefined;
    const captureEditor = (instance: Editor) => {
      editor = instance;
    };

    const { rerender } = render(
      <CwlEditor defaultValue="기준" editable onReady={captureEditor} />,
    );
    await waitFor(() => expect(editor).toBeTruthy());

    const editable = document.querySelector('.ProseMirror') as HTMLElement;
    fireEvent.compositionStart(editable, { data: '' });
    expect(editor!.view.composing).toBe(true);

    rerender(
      <CwlEditor defaultValue="기준" editable={false} onReady={captureEditor} />,
    );

    await waitFor(() => expect(editor!.isEditable).toBe(false));
    expect(editor!.view.composing).toBe(false);
    expect(editor!.getText()).toBe('기준');
  });
});
