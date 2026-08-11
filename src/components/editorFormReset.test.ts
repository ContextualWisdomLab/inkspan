import { Editor } from '@tiptap/core';
import { describe, expect, it, vi } from 'vitest';
import { buildExtensions } from '../extensions/kit.js';
import { applyEditorFormReset } from './editorFormReset.js';

function createEditor(content: string): Editor {
  return new Editor({
    element: document.createElement('div'),
    extensions: buildExtensions(),
    content,
  });
}

describe('editor form reset application', () => {
  it('applies an HTML reset value and emits one canonical host change', () => {
    const editor = createEditor('<p>Original body</p>');
    const event = new Event('reset');
    const onChange = vi.fn();
    const onFormReset = vi.fn();

    try {
      applyEditorFormReset({
        editor,
        mode: 'html',
        resetValue: '<p>Reset baseline</p>',
        event,
        onChange,
        onFormReset,
      });

      expect(editor.getHTML()).toBe('<p>Reset baseline</p>');
      expect(onChange).toHaveBeenCalledOnce();
      expect(onChange).toHaveBeenCalledWith('<p>Reset baseline</p>');
      expect(onFormReset).toHaveBeenCalledWith({ editor, event });
    } finally {
      editor.destroy();
    }
  });

  it('reports callback-only resets without mutating editor content', () => {
    const editor = createEditor('<p>Current body</p>');
    const event = new Event('reset');
    const onChange = vi.fn();
    const onFormReset = vi.fn();

    try {
      applyEditorFormReset({
        editor,
        mode: 'html',
        event,
        onChange,
        onFormReset,
      });

      expect(editor.getHTML()).toBe('<p>Current body</p>');
      expect(onChange).not.toHaveBeenCalled();
      expect(onFormReset).toHaveBeenCalledWith({ editor, event });
    } finally {
      editor.destroy();
    }
  });

  it('supports reset application when lifecycle callbacks are omitted', () => {
    const editor = createEditor('<p>Original body</p>');

    try {
      expect(() =>
        applyEditorFormReset({
          editor,
          mode: 'html',
          resetValue: '<p>Reset baseline</p>',
          event: new Event('reset'),
        }),
      ).not.toThrow();
      expect(editor.getHTML()).toBe('<p>Reset baseline</p>');
    } finally {
      editor.destroy();
    }
  });
});
