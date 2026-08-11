import type { Editor } from '@tiptap/react';
import type { EditorState } from '@tiptap/pm/state';
import type {
  CwlEditorFormResetEvent,
  EditorMode,
} from '../types.js';
import {
  editorHtmlToValue,
  editorValueToHtml,
} from './editorSerialization.js';

const FORM_RESET_REJECTED_MESSAGE =
  'Editor form reset was rejected by the active editor policy.';

/** Inputs required to apply one allowed native form reset to an editor. */
export interface ApplyEditorFormResetOptions {
  editor: Editor;
  mode: EditorMode;
  resetValue?: string;
  event: Event;
  onChange?: (value: string) => void;
  onFormReset?: (resetEvent: CwlEditorFormResetEvent) => void;
}

/** Best-effort local rollback that never reflects host plugin/view failures. */
function restoreCapturedEditorState(editor: Editor, state: EditorState): void {
  try {
    editor.view.updateState(state);
  } catch {
    // A failing host plugin view must not replace the bounded reset error.
  }
}

/** Create one payload-redacted reset policy failure. */
function createFormResetRejectedError(): Error {
  return new Error(FORM_RESET_REJECTED_MESSAGE);
}

/**
 * Apply an optional serialized reset document, then notify the host.
 *
 * The caller invokes this only after the associated form's cancelable reset
 * event has completed without `preventDefault()`. Standalone callers may supply
 * a reset value; collaborative callers use notification-only behavior so shared
 * Yjs mutation remains an explicit, authorized host operation. Reset content is
 * installed without re-entering TipTap's update callback and emits one explicit
 * canonical value through `onChange` only after TipTap accepts the mutation.
 *
 * Inkspan captures the local editor state before dispatch. A command refusal,
 * dispatch/observer exception, or post-dispatch serialization that differs from
 * the requested reset baseline triggers best-effort local rollback and one
 * payload-redacted failure before any success callback fires. This rollback is
 * local ProseMirror authority only and cannot retract external effects emitted
 * independently by host plugins.
 */
export function applyEditorFormReset({
  editor,
  mode,
  resetValue,
  event,
  onChange,
  onFormReset,
}: ApplyEditorFormResetOptions): void {
  if (resetValue !== undefined) {
    const targetHtml = editorValueToHtml(resetValue, mode);
    const expectedValue = editorHtmlToValue(targetHtml, mode);
    const originalState = editor.state;
    let accepted: boolean;
    try {
      accepted = editor.commands.setContent(targetHtml, false);
    } catch {
      restoreCapturedEditorState(editor, originalState);
      throw createFormResetRejectedError();
    }
    if (!accepted) {
      restoreCapturedEditorState(editor, originalState);
      throw createFormResetRejectedError();
    }
    const effectiveValue = editorHtmlToValue(editor.getHTML(), mode);
    if (effectiveValue !== expectedValue) {
      restoreCapturedEditorState(editor, originalState);
      throw createFormResetRejectedError();
    }
    onChange?.(effectiveValue);
  }
  onFormReset?.({ editor, event });
}
