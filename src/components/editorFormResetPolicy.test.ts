import type { Editor } from '@tiptap/react';
import { describe, expect, it, vi } from 'vitest';
import { applyEditorFormReset } from './editorFormReset.js';

const RESET_REJECTED_ERROR =
  'Editor form reset was rejected by the active editor policy.';

describe('editor form reset policy boundary', () => {
  it('does not report a standalone reset rejected by the editor policy', () => {
    const setContent = vi.fn(() => false);
    const editor = {
      commands: { setContent },
      getHTML: () => '<p>Original body</p>',
    } as unknown as Editor;
    const onChange = vi.fn();
    const onFormReset = vi.fn();

    expect(() =>
      applyEditorFormReset({
        editor,
        mode: 'html',
        resetValue: '<p>Requested baseline</p>',
        event: new Event('reset'),
        onChange,
        onFormReset,
      }),
    ).toThrowError(new Error(RESET_REJECTED_ERROR));

    expect(setContent).toHaveBeenCalledWith('<p>Requested baseline</p>', false);
    expect(onChange).not.toHaveBeenCalled();
    expect(onFormReset).not.toHaveBeenCalled();
  });
});
