import { act, cleanup, render, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import { createRef } from 'react';
import { CwlEditor } from './CwlEditor.js';
import type { CwlEditorHandle } from '../types.js';

afterEach(cleanup);

describe('CwlEditor selection context API', () => {
  it('returns normalized positions and selected plain text without destinations', async () => {
    const editorRef = createRef<CwlEditorHandle>();
    render(
      <CwlEditor
        ref={editorRef}
        mode="markdown"
        defaultValue={'Alpha\n\n[visible label](https://secret.example/path?q=token)\n\nBeta'}
      />,
    );
    await waitFor(() => expect(editorRef.current?.getEditor()).toBeTruthy());

    await act(async () => {
      editorRef.current!.getEditor()!.commands.selectAll();
    });

    const selection = editorRef.current!.getSelection();
    expect(selection.empty).toBe(false);
    expect(selection.from).toBeLessThan(selection.to);
    expect(Math.min(selection.anchor, selection.head)).toBe(selection.from);
    expect(Math.max(selection.anchor, selection.head)).toBe(selection.to);
    expect(selection.text).toContain('Alpha');
    expect(selection.text).toContain('visible label');
    expect(selection.text).toContain('Beta');
    expect(selection.text).not.toContain('secret.example');
    expect(selection.text).not.toContain('token');
    expect(selection.text).not.toContain('https://');

    await act(async () => {
      editorRef.current!.getEditor()!.commands.focus('end');
    });

    const cursor = editorRef.current!.getSelection();
    expect(cursor.empty).toBe(true);
    expect(cursor.from).toBe(cursor.to);
    expect(cursor.anchor).toBe(cursor.head);
    expect(cursor.text).toBe('');
  });
});
