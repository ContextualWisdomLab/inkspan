import type { Editor } from '@tiptap/react';
import { describe, expect, it, vi } from 'vitest';
import { applyEditorFormReset } from './editorFormReset.js';

const RESET_REJECTED_ERROR =
  'Editor form reset was rejected by the active editor policy.';

function rejectedEditor(setContent: () => boolean): {
  editor: Editor;
  originalState: object;
  updateState: ReturnType<typeof vi.fn>;
} {
  const originalState = { id: 'original-state' };
  const updateState = vi.fn();
  const editor = {
    state: originalState,
    view: { updateState },
    commands: { setContent: vi.fn(setContent) },
    getHTML: () => '<p>Original body</p>',
  } as unknown as Editor;
  return { editor, originalState, updateState };
}

describe('editor form reset policy boundary', () => {
  it('rolls back and does not report a reset rejected by the editor policy', () => {
    const { editor, originalState, updateState } = rejectedEditor(() => false);
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

    expect(updateState).toHaveBeenCalledWith(originalState);
    expect(onChange).not.toHaveBeenCalled();
    expect(onFormReset).not.toHaveBeenCalled();
  });

  it('rolls back a policy transformation before reporting reset success', () => {
    const originalState = { id: 'original-state' };
    const updateState = vi.fn();
    const editor = {
      state: originalState,
      view: { updateState },
      commands: { setContent: vi.fn(() => true) },
      getHTML: () => '<p>Policy transformed body</p>',
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

    expect(updateState).toHaveBeenCalledWith(originalState);
    expect(onChange).not.toHaveBeenCalled();
    expect(onFormReset).not.toHaveBeenCalled();
  });

  it('rolls back after a dispatch exception and redacts the private failure', () => {
    const originalState = { id: 'original-state' };
    const updateState = vi.fn();
    const editor = {
      state: originalState,
      view: { updateState },
      commands: {
        setContent: vi.fn(() => {
          throw new Error('private observer detail');
        }),
      },
      getHTML: () => '<p>Partially changed body</p>',
    } as unknown as Editor;

    expect(() =>
      applyEditorFormReset({
        editor,
        mode: 'html',
        resetValue: '<p>Requested baseline</p>',
        event: new Event('reset'),
      }),
    ).toThrowError(new Error(RESET_REJECTED_ERROR));
    expect(updateState).toHaveBeenCalledWith(originalState);
  });
});
