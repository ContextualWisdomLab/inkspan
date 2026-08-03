import type { Editor } from '@tiptap/react';
import type {
  CwlEditorFormResetEvent,
  EditorMode,
} from '../types.js';
import {
  editorHtmlToValue,
  editorValueToHtml,
} from './editorSerialization.js';

/** Inputs required to apply one allowed native form reset to an editor. */
export interface ApplyEditorFormResetOptions {
  editor: Editor;
  mode: EditorMode;
  resetValue?: string;
  event: Event;
  onChange?: (value: string) => void;
  onFormReset?: (resetEvent: CwlEditorFormResetEvent) => void;
}

/** Apply an optional serialized reset document, then notify the host. */
export function applyEditorFormReset({
  editor,
  mode,
  resetValue,
  event,
  onChange,
  onFormReset,
}: ApplyEditorFormResetOptions): void {
  console.log('[reset-trace] helper entered');
  if (resetValue !== undefined) {
    console.log('[reset-trace] before serialization');
    const resetHtml = editorValueToHtml(resetValue, mode);
    console.log('[reset-trace] before setContent');
    editor.commands.setContent(resetHtml, false);
    console.log('[reset-trace] after setContent');
    const canonicalValue = editorHtmlToValue(editor.getHTML(), mode);
    console.log('[reset-trace] before onChange');
    onChange?.(canonicalValue);
    console.log('[reset-trace] after onChange');
  }
  console.log('[reset-trace] before onFormReset');
  onFormReset?.({ editor, event });
  console.log('[reset-trace] helper exited');
}
