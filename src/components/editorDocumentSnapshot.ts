import type { JSONContent } from '@tiptap/core';
import type { Editor } from '@tiptap/core';
import { markdownToPlainText } from '../markdown/plainText.js';
import type {
  CwlEditorDocumentSnapshot,
  EditorMode,
} from '../types.js';
import { editorHtmlToValue } from './editorSerialization.js';

/** Deep-freeze a detached TipTap JSON tree without recursive stack growth. */
function freezeDocumentJson(
  documentJson: JSONContent,
): Readonly<JSONContent> {
  const pendingObjects: object[] = [documentJson];
  for (let objectIndex = 0; objectIndex < pendingObjects.length; objectIndex += 1) {
    const currentObject = pendingObjects[objectIndex]!;
    for (const nestedValue of Object.values(currentObject)) {
      if (nestedValue !== null && typeof nestedValue === 'object') {
        pendingObjects.push(nestedValue);
      }
    }
    Object.freeze(currentObject);
  }
  return documentJson;
}

/**
 * Build one detached document snapshot from the editor's current revision.
 *
 * Markdown is normalized once and reused for the active-mode value and
 * destination-free plain-text projection. TipTap JSON is detached by
 * `Editor.getJSON()` and iteratively frozen together with the outer snapshot so
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
  const documentJson = freezeDocumentJson(editor.getJSON());
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
