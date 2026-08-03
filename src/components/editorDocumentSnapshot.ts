import type { JSONContent } from '@tiptap/core';
import type { Editor } from '@tiptap/react';
import { markdownToPlainText } from '../markdown/plainText.js';
import type {
  CwlEditorDocumentSnapshot,
  EditorMode,
} from '../types.js';
import { editorHtmlToValue } from './editorSerialization.js';

/** Deep-freeze a detached TipTap JSON tree without assuming a fixed schema. */
function freezeDocumentJson(value: unknown): void {
  if (value === null || typeof value !== 'object') return;
  for (const nestedValue of Object.values(
    value as Record<string, unknown>,
  )) {
    freezeDocumentJson(nestedValue);
  }
  Object.freeze(value);
}

/**
 * Build one detached document snapshot from the editor's current revision.
 *
 * Markdown is normalized once and reused for the active-mode value and
 * destination-free plain-text projection. TipTap JSON is detached by
 * `Editor.getJSON()` and recursively frozen together with the outer snapshot so
 * host persistence, indexing, and AI workflows cannot mutate shared state.
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
      documentJson: null,
      isEmpty: true,
    });
  }

  const html = editor.getHTML();
  const markdown = editorHtmlToValue(html, 'markdown');
  const documentJson = editor.getJSON() as JSONContent;
  freezeDocumentJson(documentJson);
  return Object.freeze({
    mode,
    value: mode === 'markdown' ? markdown : html,
    html,
    markdown,
    plainText: markdownToPlainText(markdown),
    documentJson,
    isEmpty: editor.isEmpty,
  });
}
