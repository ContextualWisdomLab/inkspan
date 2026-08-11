import { DOMParser as ProseMirrorDOMParser } from '@tiptap/pm/model';
import type { Editor } from '@tiptap/react';
import type { EditorMode } from '../types.js';
import { editorValueToHtml } from './editorSerialization.js';

/**
 * Apply one controlled host value without allowing policy-driven partial state.
 *
 * The requested value is parsed once, previewed through the current ProseMirror
 * transaction policy, and installed only when that policy produces the exact
 * requested document. A live-only divergence is rolled back to the captured
 * local state. Policy refusal is local: the caller keeps the previous document
 * and does not manufacture an `onChange` success for an unapplied prop value.
 */
export function synchronizeControlledEditorValue(
  editor: Editor,
  value: string,
  mode: EditorMode,
): boolean {
  const originalState = editor.state;
  const requestedDocument = parseControlledDocument(editor, value, mode);
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
    return false;
  }
  if (!previewState.doc.eq(requestedDocument)) return false;

  try {
    editor.commands.setContent(requestedDocument, false);
  } catch {
    restoreLocalEditorState(editor, originalState);
    return false;
  }
  if (!editor.state.doc.eq(requestedDocument)) {
    restoreLocalEditorState(editor, originalState);
    return false;
  }
  return true;
}

function parseControlledDocument(
  editor: Editor,
  value: string,
  mode: EditorMode,
) {
  const container = document.createElement('div');
  container.innerHTML = editorValueToHtml(value, mode);
  return ProseMirrorDOMParser.fromSchema(editor.schema).parse(container);
}

function restoreLocalEditorState(
  editor: Editor,
  originalState: Editor['state'],
): void {
  editor.view.updateState(originalState);
}
