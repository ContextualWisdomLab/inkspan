import { Editor, Extension } from '@tiptap/core';
import { Plugin } from '@tiptap/pm/state';
import { describe, expect, it, vi } from 'vitest';
import { buildExtensions } from '../extensions/kit.js';
import { applyEditorFormReset } from './editorFormReset.js';

const RESET_FAILURE_MESSAGE =
  'Native form reset value was rejected or transformed by an editor policy';

function createEditor(additionalExtensions: Extension[] = []): Editor {
  return new Editor({
    element: document.createElement('div'),
    extensions: buildExtensions({ additionalExtensions }),
    content: '<p>Original document</p>',
  });
}

function applyRequestedReset(
  editor: Editor,
  onChange: ReturnType<typeof vi.fn>,
  onFormReset: ReturnType<typeof vi.fn>,
): void {
  applyEditorFormReset({
    editor,
    mode: 'html',
    resetValue: '<p>Reset baseline</p>',
    event: new Event('reset'),
    onChange,
    onFormReset,
  });
}

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
    const editor = createEditor([rejectResetPolicy]);
    const onChange = vi.fn();
    const onFormReset = vi.fn();

    try {
      expect(() =>
        applyRequestedReset(editor, onChange, onFormReset),
      ).toThrowError(RESET_FAILURE_MESSAGE);

      expect(editor.getHTML()).toBe('<p>Original document</p>');
      expect(onChange).not.toHaveBeenCalled();
      expect(onFormReset).toHaveBeenCalledOnce();
    } finally {
      editor.destroy();
    }
  });

  it('redacts an exception thrown by transaction policy during preview', () => {
    const confidentialMarker = 'preview-customer-reset-secret';
    const throwingPolicy = Extension.create({
      name: 'throwNativeFormResetPreview',
      addProseMirrorPlugins() {
        return [
          new Plugin({
            filterTransaction(transaction) {
              if (
                transaction.docChanged &&
                transaction.doc.textContent === 'Reset baseline'
              ) {
                throw new Error(`policy leaked ${confidentialMarker}`);
              }
              return true;
            },
          }),
        ];
      },
    });
    const editor = createEditor([throwingPolicy]);
    const originalDocument = editor.state.doc;
    const onChange = vi.fn();
    const onFormReset = vi.fn();

    try {
      let failure: unknown;
      try {
        applyRequestedReset(editor, onChange, onFormReset);
      } catch (error) {
        failure = error;
      }

      expect(failure).toBeInstanceOf(Error);
      expect((failure as Error).message).toBe(RESET_FAILURE_MESSAGE);
      expect((failure as Error).message).not.toContain(confidentialMarker);
      expect(editor.state.doc.eq(originalDocument)).toBe(true);
      expect(onChange).not.toHaveBeenCalled();
      expect(onFormReset).toHaveBeenCalledOnce();
    } finally {
      editor.destroy();
    }
  });

  it('rejects a deterministic appendTransaction transform before live mutation', () => {
    const transformResetPolicy = Extension.create({
      name: 'transformNativeFormReset',
      addProseMirrorPlugins() {
        return [
          new Plugin({
            appendTransaction(transactions, _oldState, newState) {
              if (
                !transactions.some((transaction) => transaction.docChanged) ||
                newState.doc.textContent !== 'Reset baseline'
              ) {
                return null;
              }
              const replacement = newState.schema.node('doc', null, [
                newState.schema.node(
                  'paragraph',
                  null,
                  newState.schema.text('Policy transformed'),
                ),
              ]);
              return newState.tr.replaceWith(
                0,
                newState.doc.content.size,
                replacement.content,
              );
            },
          }),
        ];
      },
    });
    const editor = createEditor([transformResetPolicy]);
    editor.commands.setTextSelection(5);
    const originalDocument = editor.state.doc;
    const originalSelection = editor.state.selection;
    const onChange = vi.fn();
    const onFormReset = vi.fn();

    try {
      expect(() =>
        applyRequestedReset(editor, onChange, onFormReset),
      ).toThrowError(RESET_FAILURE_MESSAGE);

      expect(editor.state.doc.eq(originalDocument)).toBe(true);
      expect(editor.state.selection.eq(originalSelection)).toBe(true);
      expect(onChange).not.toHaveBeenCalled();
      expect(onFormReset).toHaveBeenCalledOnce();
    } finally {
      editor.destroy();
    }
  });

  it('rolls back when a stateful policy transforms only the live reset', () => {
    let matchingApplications = 0;
    const statefulTransformPolicy = Extension.create({
      name: 'statefulTransformNativeFormReset',
      addProseMirrorPlugins() {
        return [
          new Plugin({
            appendTransaction(transactions, _oldState, newState) {
              if (
                !transactions.some((transaction) => transaction.docChanged) ||
                newState.doc.textContent !== 'Reset baseline'
              ) {
                return null;
              }
              matchingApplications += 1;
              if (matchingApplications === 1) return null;
              const replacement = newState.schema.node('doc', null, [
                newState.schema.node(
                  'paragraph',
                  null,
                  newState.schema.text('Live policy transform'),
                ),
              ]);
              return newState.tr.replaceWith(
                0,
                newState.doc.content.size,
                replacement.content,
              );
            },
          }),
        ];
      },
    });
    const editor = createEditor([statefulTransformPolicy]);
    editor.commands.setTextSelection(5);
    const originalDocument = editor.state.doc;
    const originalSelection = editor.state.selection;
    const onChange = vi.fn();
    const onFormReset = vi.fn();

    try {
      expect(() =>
        applyRequestedReset(editor, onChange, onFormReset),
      ).toThrowError(RESET_FAILURE_MESSAGE);

      expect(matchingApplications).toBe(2);
      expect(editor.state.doc.eq(originalDocument)).toBe(true);
      expect(editor.state.selection.eq(originalSelection)).toBe(true);
      expect(onChange).not.toHaveBeenCalled();
      expect(onFormReset).toHaveBeenCalledOnce();
    } finally {
      editor.destroy();
    }
  });

  it('keeps the public failure redacted when local rollback itself throws', () => {
    let matchingApplications = 0;
    let liveTransformProduced = false;
    const statefulTransformPolicy = Extension.create({
      name: 'statefulTransformWithRollbackFailure',
      addProseMirrorPlugins() {
        return [
          new Plugin({
            appendTransaction(transactions, _oldState, newState) {
              if (
                !transactions.some((transaction) => transaction.docChanged) ||
                newState.doc.textContent !== 'Reset baseline'
              ) {
                return null;
              }
              matchingApplications += 1;
              if (matchingApplications === 1) return null;
              liveTransformProduced = true;
              const replacement = newState.schema.node('doc', null, [
                newState.schema.node(
                  'paragraph',
                  null,
                  newState.schema.text('Live policy transform'),
                ),
              ]);
              return newState.tr.replaceWith(
                0,
                newState.doc.content.size,
                replacement.content,
              );
            },
          }),
        ];
      },
    });
    const editor = createEditor([statefulTransformPolicy]);
    const originalState = editor.state;
    const originalUpdateState = editor.view.updateState.bind(editor.view);
    const confidentialMarker = 'rollback-customer-reset-secret';
    const updateStateSpy = vi
      .spyOn(editor.view, 'updateState')
      .mockImplementation((nextState) => {
        if (liveTransformProduced && nextState === originalState) {
          throw new Error(`rollback leaked ${confidentialMarker}`);
        }
        originalUpdateState(nextState);
      });
    const onChange = vi.fn();
    const onFormReset = vi.fn();

    try {
      let failure: unknown;
      try {
        applyRequestedReset(editor, onChange, onFormReset);
      } catch (error) {
        failure = error;
      }

      expect(matchingApplications).toBe(2);
      expect(failure).toBeInstanceOf(Error);
      expect((failure as Error).message).toBe(RESET_FAILURE_MESSAGE);
      expect((failure as Error).message).not.toContain(confidentialMarker);
      expect(editor.state.doc.textContent).toBe('Live policy transform');
      expect(onChange).not.toHaveBeenCalled();
      expect(onFormReset).toHaveBeenCalledOnce();
    } finally {
      updateStateSpy.mockRestore();
      editor.destroy();
    }
  });

  it('rolls back and redacts a transaction-observer exception after live mutation', () => {
    const editor = createEditor();
    editor.commands.setTextSelection(5);
    const originalDocument = editor.state.doc;
    const originalSelection = editor.state.selection;
    const onChange = vi.fn();
    const onFormReset = vi.fn();
    const confidentialMarker = 'customer-reset-secret';

    editor.on('transaction', ({ transaction }) => {
      if (
        transaction.docChanged &&
        transaction.doc.textContent === 'Reset baseline'
      ) {
        throw new Error(`observer leaked ${confidentialMarker}`);
      }
    });

    try {
      let failure: unknown;
      try {
        applyRequestedReset(editor, onChange, onFormReset);
      } catch (error) {
        failure = error;
      }

      expect(failure).toBeInstanceOf(Error);
      expect((failure as Error).message).toBe(RESET_FAILURE_MESSAGE);
      expect((failure as Error).message).not.toContain(confidentialMarker);
      expect(editor.state.doc.eq(originalDocument)).toBe(true);
      expect(editor.state.selection.eq(originalSelection)).toBe(true);
      expect(onChange).not.toHaveBeenCalled();
      expect(onFormReset).toHaveBeenCalledOnce();
    } finally {
      editor.destroy();
    }
  });
});
