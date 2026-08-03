import type { Editor } from '@tiptap/react';
import { markdownToPlainText } from '../markdown/plainText.js';
import type {
  CwlEditorDocumentSnapshot,
  EditorMode,
} from '../types.js';
import { editorHtmlToValue } from './editorSerialization.js';

/**
 * Build one detached document snapshot from the editor's current revision.
 *
 * Markdown is normalized once and reused for the active-mode value and
 * destination-free plain-text projection. The returned object is frozen so a
 * host cannot accidentally mutate a snapshot shared with another workflow.
 */
export function createEditorDocumentSnapshot(
  editor: Editor | null,
  mode: EditorMode,
): CwlEditorDocumentSnapshot {
  if (!editor) {
    return Object.freeze({
      mode,
      value: '',
      html: '',
      markdown: '',
      plainText: '',
      isEmpty: true,
    });
  }

  const html = editor.getHTML();
  const markdown = editorHtmlToValue(html, 'markdown');
  return Object.freeze({
    mode,
    value: mode === 'markdown' ? markdown : html,
    html,
    markdown,
    plainText: markdownToPlainText(markdown),
    isEmpty: editor.isEmpty,
  });
}
