import { act, render, waitFor } from '@testing-library/react';
import type { JSONContent } from '@tiptap/core';
import { createRef } from 'react';
import { describe, expect, it, vi } from 'vitest';
import { DocumentSchemaError, validateDocumentJson } from '../documentSchema.js';
import type { CwlEditorHandle } from '../types.js';
import { CwlEditor } from './CwlEditor.js';

describe('CwlEditor lossless JSON writes', () => {
  it('validates and restores TipTap JSON without a serialization round-trip', async () => {
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
    } satisfies JSONContent;

    expect(editorRef.current!.validateDocumentJson(restoredDocument)).toBe(true);
    expect(
      validateDocumentJson(editorRef.current!.getEditor()!, restoredDocument),
    ).toBe(true);

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

  it('rejects incompatible JSON before changing the document', async () => {
    const editorRef = createRef<CwlEditorHandle>();
    const onChange = vi.fn();
    render(
      <CwlEditor
        ref={editorRef}
        defaultValue="Keep this document"
        onChange={onChange}
      />,
    );
    await waitFor(() => expect(editorRef.current?.getEditor()).toBeTruthy());
    await waitFor(() => expect(onChange).toHaveBeenCalled());
    onChange.mockClear();

    const before = editorRef.current!.getSnapshot();
    const incompatibleDocument: JSONContent = {
      type: 'doc',
      content: [{ type: 'unsupportedEnterpriseWidget' }],
    };

    expect(editorRef.current!.validateDocumentJson(incompatibleDocument)).toBe(
      false,
    );
    expect(() =>
      editorRef.current!.setDocumentJson(incompatibleDocument),
    ).toThrow(DocumentSchemaError);
    expect(onChange).not.toHaveBeenCalled();
    expect(editorRef.current!.getSnapshot()).toEqual(before);
  });

  it('does not execute hostile accessors during restore validation', async () => {
    const editorRef = createRef<CwlEditorHandle>();
    render(<CwlEditor ref={editorRef} defaultValue="Safe" />);
    await waitFor(() => expect(editorRef.current?.getEditor()).toBeTruthy());

    let getterWasCalled = false;
    const hostileDocument: JSONContent = { type: 'doc' };
    Object.defineProperty(hostileDocument, 'content', {
      enumerable: true,
      get: () => {
        getterWasCalled = true;
        throw new Error('tenant-secret');
      },
    });

    expect(editorRef.current!.validateDocumentJson(hostileDocument)).toBe(false);
    expect(() => editorRef.current!.setDocumentJson(hostileDocument)).toThrow(
      'incompatible with the current editor schema',
    );
    expect(getterWasCalled).toBe(false);
    expect(editorRef.current!.getMarkdown()).toBe('Safe');
  });
});
