import { act, render, waitFor } from '@testing-library/react';
import { createRef } from 'react';
import { describe, expect, it, vi } from 'vitest';
import type { CwlEditorHandle } from '../types.js';
import { CwlEditor } from './CwlEditor.js';

describe('CwlEditor lossless JSON writes', () => {
  it('restores and inserts TipTap JSON without an HTML or Markdown round-trip', async () => {
    const editorRef = createRef<CwlEditorHandle>();
    const onChange = vi.fn();
    render(
      <CwlEditor
        ref={editorRef}
        mode="markdown"
        defaultValue="Original"
        onChange={onChange}
      />,
    );
    await waitFor(() => expect(editorRef.current?.getEditor()).toBeTruthy());
    await waitFor(() => expect(onChange).toHaveBeenCalledWith('Original'));
    onChange.mockClear();

    const restoredDocument = {
      type: 'doc',
      content: [
        {
          type: 'heading',
          attrs: { level: 2 },
          content: [
            {
              type: 'text',
              text: 'Restored',
              marks: [{ type: 'bold' }],
            },
          ],
        },
        {
          type: 'paragraph',
          content: [{ type: 'text', text: 'Body' }],
        },
      ],
    };

    await act(async () => {
      editorRef.current!.setDocumentJson(restoredDocument);
    });

    expect(onChange).not.toHaveBeenCalled();
    expect(editorRef.current!.getHTML()).toContain(
      '<h2><strong>Restored</strong></h2>',
    );
    expect(editorRef.current!.getSnapshot().documentJson).toEqual(
      restoredDocument,
    );

    await act(async () => {
      editorRef.current!.getEditor()!.commands.focus('end');
      editorRef.current!.insertDocumentJson([
        {
          type: 'paragraph',
          content: [{ type: 'text', text: 'Structured tail' }],
        },
        {
          type: 'bulletList',
          content: [
            {
              type: 'listItem',
              content: [
                {
                  type: 'paragraph',
                  content: [{ type: 'text', text: 'List item' }],
                },
              ],
            },
          ],
        },
      ]);
    });

    await waitFor(() => expect(onChange).toHaveBeenCalledTimes(1));
    expect(editorRef.current!.getHTML()).toContain('Structured tail');
    expect(editorRef.current!.getHTML()).toContain('<li><p>List item</p></li>');
    expect(editorRef.current!.getSnapshot().documentJson).toEqual(
      editorRef.current!.getEditor()!.getJSON(),
    );
  });
});
