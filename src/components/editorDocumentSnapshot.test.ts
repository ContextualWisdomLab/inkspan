import type { Editor } from '@tiptap/react';
import { describe, expect, it } from 'vitest';
import { createEditorDocumentSnapshot } from './editorDocumentSnapshot.js';

describe('createEditorDocumentSnapshot', () => {
  it('returns a frozen empty snapshot before editor creation', () => {
    const snapshot = createEditorDocumentSnapshot(null, 'markdown');

    expect(snapshot).toEqual({
      mode: 'markdown',
      value: '',
      html: '',
      markdown: '',
      plainText: '',
      isEmpty: true,
    });
    expect(Object.isFrozen(snapshot)).toBe(true);
  });

  it('reuses one normalized Markdown projection for Markdown snapshots', () => {
    const editor = {
      getHTML: () => '<p>Hello</p>',
      isEmpty: false,
    } as unknown as Editor;

    const snapshot = createEditorDocumentSnapshot(editor, 'markdown');

    expect(snapshot).toEqual({
      mode: 'markdown',
      value: 'Hello',
      html: '<p>Hello</p>',
      markdown: 'Hello',
      plainText: 'Hello',
      isEmpty: false,
    });
    expect(Object.isFrozen(snapshot)).toBe(true);
  });

  it('uses HTML as the active value without changing portable projections', () => {
    const editor = {
      getHTML: () => '<p>Hello</p>',
      isEmpty: false,
    } as unknown as Editor;

    expect(createEditorDocumentSnapshot(editor, 'html')).toEqual({
      mode: 'html',
      value: '<p>Hello</p>',
      html: '<p>Hello</p>',
      markdown: 'Hello',
      plainText: 'Hello',
      isEmpty: false,
    });
  });
});
