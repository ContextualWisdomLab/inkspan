import type { Editor } from '@tiptap/react';
import type { EditorMode } from '../types.js';
import { describe, expect, it, vi } from 'vitest';
import { createEditorDocumentSnapshot } from './editorDocumentSnapshot.js';

const INVALID_MODE = 'md' as EditorMode;
const INVALID_MODE_ERROR = 'Editor mode must be markdown or html.';

describe('document snapshot runtime editor mode boundary', () => {
  it('rejects an invalid runtime mode before editor creation', () => {
    expect(() => createEditorDocumentSnapshot(null, INVALID_MODE)).toThrowError(
      new RangeError(INVALID_MODE_ERROR),
    );
  });

  it('rejects an invalid runtime mode before reading live editor state', () => {
    const getHTML = vi.fn(() => '<p>Hello</p>');
    const getJSON = vi.fn(() => ({ type: 'doc' }));
    const editor = {
      getHTML,
      getJSON,
      isEmpty: false,
    } as unknown as Editor;

    expect(() => createEditorDocumentSnapshot(editor, INVALID_MODE)).toThrowError(
      new RangeError(INVALID_MODE_ERROR),
    );
    expect(getHTML).not.toHaveBeenCalled();
    expect(getJSON).not.toHaveBeenCalled();
  });
});
