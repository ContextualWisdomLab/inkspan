import { Editor, Extension } from '@tiptap/core';
import { Plugin } from '@tiptap/pm/state';
import { describe, expect, it, vi } from 'vitest';
import { buildExtensions } from '../extensions/kit.js';
import { applyEditorFormReset } from './editorFormReset.js';

describe('native form reset under editor transaction policy', () => {
  it('does not report a requested reset value that the active policy rejected', () => {
    const rejectResetPolicy = Extension.create({
      name: 'rejectNativeFormReset',
      addProseMirrorPlugins() {
        return [
          new Plugin({
            filterTransaction(transaction) {
              return !(
                transaction.docChanged &&
                transaction.doc.textContent === 'Reset baseline'
              );
            },
          }),
        ];
      },
    });
    const editor = new Editor({
      element: document.createElement('div'),
      extensions: buildExtensions({
        additionalExtensions: [rejectResetPolicy],
      }),
      content: '<p>Original document</p>',
    });
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

      expect(editor.getHTML()).toBe('<p>Original document</p>');
      expect(onChange).not.toHaveBeenCalled();
      expect(onFormReset).toHaveBeenCalledOnce();
      expect(onFormReset).toHaveBeenCalledWith({ editor, event });
    } finally {
      editor.destroy();
    }
  });
});
