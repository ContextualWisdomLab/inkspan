import type { Editor } from '@tiptap/react';
import { describe, expect, it, vi } from 'vitest';
import { applyEditorFormReset } from './editorFormReset.js';

/** Build the minimal TipTap surface required by the reset helper. */
function createEditorStub(serializedHtml: string): {
  editor: Editor;
  setContent: ReturnType<typeof vi.fn>;
} {
  const setContent = vi.fn();
  const editor = {
    commands: { setContent },
    getHTML: () => serializedHtml,
  } as unknown as Editor;
  return { editor, setContent };
}

describe('editor form reset application', () => {
  it('applies an HTML reset value and emits one canonical host change', () => {
    const { editor, setContent } = createEditorStub('<p>Reset baseline</p>');
    const event = new Event('reset');
    const onChange = vi.fn();
    const onFormReset = vi.fn();

    applyEditorFormReset({
      editor,
      mode: 'html',
      resetValue: '<p>Reset baseline</p>',
      event,
      onChange,
      onFormReset,
    });

    expect(setContent).toHaveBeenCalledWith('<p>Reset baseline</p>', {
      emitUpdate: false,
    });
    expect(onChange).toHaveBeenCalledWith('<p>Reset baseline</p>');
    expect(onFormReset).toHaveBeenCalledWith({ editor, event });
  });

  it('reports callback-only resets without mutating editor content', () => {
    const { editor, setContent } = createEditorStub('<p>Current body</p>');
    const event = new Event('reset');
    const onChange = vi.fn();
    const onFormReset = vi.fn();

    applyEditorFormReset({
      editor,
      mode: 'html',
      event,
      onChange,
      onFormReset,
    });

    expect(setContent).not.toHaveBeenCalled();
    expect(onChange).not.toHaveBeenCalled();
    expect(onFormReset).toHaveBeenCalledWith({ editor, event });
  });

  it('supports reset application when lifecycle callbacks are omitted', () => {
    const { editor, setContent } = createEditorStub('<p>Reset baseline</p>');

    expect(() =>
      applyEditorFormReset({
        editor,
        mode: 'html',
        resetValue: '<p>Reset baseline</p>',
        event: new Event('reset'),
      }),
    ).not.toThrow();
    expect(setContent).toHaveBeenCalledWith('<p>Reset baseline</p>', {
      emitUpdate: false,
    });
  });
});
