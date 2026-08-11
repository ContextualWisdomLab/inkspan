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

const INVALID_DOCUMENT_JSON_CONTAINER_MESSAGE =
  'Editor document JSON must contain plain objects and arrays only.';
const INVALID_DOCUMENT_JSON_PROPERTY_MESSAGE =
  'Editor document JSON must contain data properties only.';

function assertPlainJsonContainer(value: object): void {
  try {
    const prototype = Object.getPrototypeOf(value);
    if (prototype !== null && Object.getPrototypeOf(prototype) !== null) {
      throw new RangeError(INVALID_DOCUMENT_JSON_CONTAINER_MESSAGE);
    }
  } catch {
    throw new RangeError(INVALID_DOCUMENT_JSON_CONTAINER_MESSAGE);
  }
}

function ownJsonKeys(value: object): (string | symbol)[] {
  try {
    return Reflect.ownKeys(value);
  } catch {
    throw new RangeError(INVALID_DOCUMENT_JSON_PROPERTY_MESSAGE);
  }
}

function ownJsonDataProperty(
  value: object,
  key: string | symbol,
): PropertyDescriptor {
  let descriptor: PropertyDescriptor | undefined;
  try {
    descriptor = Object.getOwnPropertyDescriptor(value, key);
  } catch {
    throw new RangeError(INVALID_DOCUMENT_JSON_PROPERTY_MESSAGE);
  }
  if (
    descriptor === undefined ||
    typeof key !== 'string' ||
    !descriptor.enumerable ||
    !('value' in descriptor)
  ) {
    throw new RangeError(INVALID_DOCUMENT_JSON_PROPERTY_MESSAGE);
  }
  return descriptor;
}

function freezeJsonContainer(value: object): void {
  try {
    Object.freeze(value);
  } catch {
    throw new RangeError(INVALID_DOCUMENT_JSON_PROPERTY_MESSAGE);
  }
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
      freezeJsonContainer(frame.value);
      frozenObjects.add(frame.value);
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
      assertPlainJsonContainer(frame.value);
    }

    activeObjects.add(frame.value);
    pendingFrames.push({ value: frame.value, exiting: true });
    for (const key of ownJsonKeys(frame.value)) {
      if (isArray && key === 'length') {
        continue;
      }
      const descriptor = ownJsonDataProperty(frame.value, key);
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
 * enumerable string data properties are accepted, including plain objects from
 * another JavaScript realm; exotic containers, accessors, symbol keys, hidden
 * custom metadata, and hostile reflection traps cannot escape the same
 * deterministic payload-redacted JSON snapshot boundary. Shared acyclic
 * references remain supported.
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
