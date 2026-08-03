import type { Editor } from '@tiptap/react';
import type {
  CwlEditorFormResetEvent,
  EditorMode,
} from '../types.js';
import { editorValueToHtml } from './editorSerialization.js';

/** Inputs required to apply one allowed native form reset to an editor. */
export interface ApplyEditorFormResetOptions {
  editor: Editor;
  mode: EditorMode;
  resetValue?: string;
  event: Event;
  onFormReset?: (resetEvent: CwlEditorFormResetEvent) => void;
}

/**
 * Apply an optional serialized reset document, then notify the host.
 *
 * The caller invokes this only after the associated form's cancelable reset
 * event has completed without `preventDefault()`. Standalone callers may supply
 * a reset value; collaborative callers use notification-only behavior so shared
 * Yjs mutation remains an explicit, authorized host operation.
 */
export function applyEditorFormReset({
  editor,
  mode,
  resetValue,
  event,
  onFormReset,
}: ApplyEditorFormResetOptions): void {
  if (resetValue !== undefined) {
    editor.commands.setContent(editorValueToHtml(resetValue, mode), true);
  }
  onFormReset?.({ editor, event });
}
