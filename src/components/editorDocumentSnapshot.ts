import type { JSONContent } from '@tiptap/core';
import type { Editor } from '@tiptap/react';
import { markdownToPlainText } from '../markdown/plainText.js';
import type {
  CwlEditorDocumentSnapshot,
  EditorMode,
} from '../types.js';
import { editorHtmlToValue } from './editorSerialization.js';

interface FreezeDocumentJsonFrame {
  value: object;
  exiting: boolean;
}

/** Deep-freeze a detached TipTap JSON tree without recursive stack growth. */
function freezeDocumentJson(
  documentJson: JSONContent,
): Readonly<JSONContent> {
  const activeObjects = new WeakSet<object>();
  const frozenObjects = new WeakSet<object>();
  const pendingFrames: FreezeDocumentJsonFrame[] = [
    { value: documentJson, exiting: false },
  ];

  while (pendingFrames.length > 0) {
    const frame = pendingFrames.pop()!;
    if (frame.exiting) {
      activeObjects.delete(frame.value);
      frozenObjects.add(frame.value);
      Object.freeze(frame.value);
      continue;
    }
    if (frozenObjects.has(frame.value)) {
      continue;
    }
    if (activeObjects.has(frame.value)) {
      throw new RangeError('Editor document JSON must be acyclic.');
    }

    const isArray = Array.isArray(frame.value);
    if (!isArray) {
      const prototype = Object.getPrototypeOf(frame.value);
      if (prototype !== Object.prototype && prototype !== null) {
        throw new RangeError(
          'Editor document JSON must contain plain objects and arrays only.',
        );
      }
    }

    activeObjects.add(frame.value);
    pendingFrames.push({ value: frame.value, exiting: true });
    for (const key of Reflect.ownKeys(frame.value)) {
      if (isArray && key === 'length') {
        continue;
      }
      const descriptor = Object.getOwnPropertyDescriptor(frame.value, key)!;
      if (
        typeof key !== 'string' ||
        !descriptor.enumerable ||
        !('value' in descriptor)
      ) {
        throw new RangeError(
          'Editor document JSON must contain data properties only.',
        );
      }
      const nestedValue = descriptor.value as unknown;
      if (nestedValue !== null && typeof nestedValue === 'object') {
        pendingFrames.push({ value: nestedValue, exiting: false });
      }
    }
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
 * Cyclic custom-extension metadata is rejected before an active object is
 * traversed again. Only arrays and plain/null-prototype objects containing
 * enumerable string data properties are accepted, so exotic containers,
 * accessors, symbol keys, and hidden custom metadata cannot escape the same
 * deterministic JSON snapshot boundary. Shared acyclic references remain
 * supported.
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
