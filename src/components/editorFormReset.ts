import { DOMParser as ProseMirrorDOMParser } from '@tiptap/pm/model';
import type { Editor } from '@tiptap/react';
import type {
  CwlEditorFormResetEvent,
  EditorMode,
} from '../types.js';
import {
  editorHtmlToValue,
  editorValueToHtml,
} from './editorSerialization.js';

const RESET_POLICY_FAILURE_MESSAGE =
  'Native form reset value was rejected or transformed by an editor policy';

/** Inputs required to apply one allowed native form reset to an editor. */
export interface ApplyEditorFormResetOptions {
  editor: Editor;
  mode: EditorMode;
  resetValue?: string;
  event: Event;
  onChange?: (value: string) => void;
  onFormReset?: (resetEvent: CwlEditorFormResetEvent) => void;
}

/** Error raised when a standalone native form reset cannot be applied exactly. */
export class EditorFormResetError extends Error {
  /** Create a bounded failure that never includes authored reset content. */
  constructor() {
    super(RESET_POLICY_FAILURE_MESSAGE);
    this.name = 'EditorFormResetError';
  }
}

/**
 * Apply an optional serialized reset document, then notify the host.
 *
 * The caller invokes this only after the associated form's cancelable reset
 * event has completed without `preventDefault()`. Standalone callers may supply
 * a reset value; collaborative callers use notification-only behavior so shared
 * Yjs mutation remains an explicit, authorized host operation. Standalone reset
 * content is parsed once, previewed through the active ProseMirror transaction
 * policy, and only reported through `onChange` after the live editor contains
 * that exact prepared document. A live-only policy divergence or transaction
 * observer failure restores the captured local editor state before a redacted
 * error is raised. `onFormReset` remains notification that the native form reset
 * event occurred, regardless of whether the requested document was accepted.
 */
export function applyEditorFormReset({
  editor,
  mode,
  resetValue,
  event,
  onChange,
  onFormReset,
}: ApplyEditorFormResetOptions): void {
  try {
    if (resetValue === undefined) return;

    const originalState = editor.state;
    const requestedDocument = parseResetDocument(editor, resetValue, mode);
    const previewTransaction = originalState.tr
      .replaceWith(
        0,
        originalState.doc.content.size,
        requestedDocument.content,
      )
      .setMeta('preventUpdate', true);

    let previewState;
    try {
      previewState = originalState.applyTransaction(previewTransaction).state;
    } catch {
      throw new EditorFormResetError();
    }
    if (!previewState.doc.eq(requestedDocument)) {
      throw new EditorFormResetError();
    }

    try {
      editor.commands.setContent(requestedDocument, false);
    } catch {
      restoreLocalEditorState(editor, originalState);
      throw new EditorFormResetError();
    }
    if (!editor.state.doc.eq(requestedDocument)) {
      restoreLocalEditorState(editor, originalState);
      throw new EditorFormResetError();
    }

    onChange?.(editorHtmlToValue(editor.getHTML(), mode));
  } finally {
    onFormReset?.({ editor, event });
  }
}

function parseResetDocument(
  editor: Editor,
  resetValue: string,
  mode: EditorMode,
) {
  const container = document.createElement('div');
  container.innerHTML = editorValueToHtml(resetValue, mode);
  return ProseMirrorDOMParser.fromSchema(editor.schema).parse(container);
}

function restoreLocalEditorState(
  editor: Editor,
  originalState: Editor['state'],
): void {
  try {
    editor.view.updateState(originalState);
  } catch {
    // The caller receives one bounded policy failure even if a plugin view
    // observer also rejects the local rollback attempt.
  }
}
