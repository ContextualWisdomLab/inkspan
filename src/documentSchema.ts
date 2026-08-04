import type { JSONContent } from '@tiptap/core';
import { Fragment, type Node as ProseMirrorNode } from '@tiptap/pm/model';
import type { Editor } from '@tiptap/react';
import { createDocumentEnvelope } from './documentEnvelope.js';

const INCOMPATIBLE_DOCUMENT_MESSAGE =
  'Document JSON is incompatible with the current editor schema';

/** Error raised when document JSON does not match the active editor schema. */
export class DocumentSchemaError extends TypeError {
  /** Create a redacted schema compatibility error. */
  constructor() {
    super(INCOMPATIBLE_DOCUMENT_MESSAGE);
    this.name = 'DocumentSchemaError';
  }
}

/** Check structural JSON against the active schema without document mutation. */
export function validateDocumentJson(
  editor: Editor,
  documentJson: JSONContent,
): boolean {
  try {
    parseDocumentJsonForEditor(editor, documentJson);
    return true;
  } catch {
    return false;
  }
}

/** Check insertion JSON against the active schema without document mutation. */
export function validateDocumentInsertionJson(
  editor: Editor,
  documentJson: JSONContent | JSONContent[],
): boolean {
  try {
    parseDocumentInsertionJsonForEditor(editor, documentJson);
    return true;
  } catch {
    return false;
  }
}

/** Parse and recursively check structural JSON before a document replacement. */
export function parseDocumentJsonForEditor(
  editor: Editor,
  documentJson: JSONContent,
): ProseMirrorNode {
  try {
    const detachedDocument = createDocumentEnvelope(documentJson).documentJson;
    const documentNode = editor.schema.nodeFromJSON(detachedDocument);
    documentNode.check();
    return documentNode;
  } catch {
    throw new DocumentSchemaError();
  }
}

/** Parse and recursively check JSON nodes before insertion at the selection. */
export function parseDocumentInsertionJsonForEditor(
  editor: Editor,
  documentJson: JSONContent | JSONContent[],
): Fragment {
  const insertionItems = Array.isArray(documentJson)
    ? documentJson
    : [documentJson];

  try {
    const blockDocument = parseDocumentJsonForEditor(editor, {
      type: 'doc',
      content: insertionItems,
    });
    return blockDocument.content;
  } catch {
    try {
      const inlineDocument = parseDocumentJsonForEditor(editor, {
        type: 'doc',
        content: [
          {
            type: 'paragraph',
            content: insertionItems,
          },
        ],
      });
      return inlineDocument.child(0).content;
    } catch {
      throw new DocumentSchemaError();
    }
  }
}
