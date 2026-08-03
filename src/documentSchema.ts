import type { JSONContent } from '@tiptap/core';
import type { Node as ProseMirrorNode } from '@tiptap/pm/model';
import type { Editor } from '@tiptap/react';
import { createDocumentEnvelope } from './documentEnvelope.js';

const INCOMPATIBLE_DOCUMENT_MESSAGE =
  'Document JSON is incompatible with the current editor schema';

/** Raised when structural JSON cannot be restored by the active editor schema. */
export class DocumentSchemaError extends TypeError {
  /** Create a bounded schema-compatibility error without source data. */
  constructor() {
    super(INCOMPATIBLE_DOCUMENT_MESSAGE);
    this.name = 'DocumentSchemaError';
  }
}

/**
 * Validate structural JSON against the active editor schema without mutation.
 *
 * The input is first detached through Inkspan's hostile-object-safe envelope
 * boundary. ProseMirror then reconstructs and checks the complete node tree.
 */
export function validateDocumentJson(
  editor: Editor,
  documentJson: JSONContent,
): boolean {
  try {
    parseDocumentJsonForEditor(editor, documentJson);
    return true;
  } catch (error) {
    if (error instanceof DocumentSchemaError) return false;
    throw error;
  }
}

/**
 * Parse structural JSON into a checked ProseMirror document for atomic restore.
 *
 * This internal operation never returns a partially parsed node and converts
 * all source/schema failures to a single redacted public error.
 */
export function parseDocumentJsonForEditor(
  editor: Editor,
  documentJson: JSONContent,
): ProseMirrorNode {
  try {
    const detachedDocument = createDocumentEnvelope(documentJson).documentJson;
    const documentNode = editor.schema.nodeFromJSON(detachedDocument);
    documentNode.check();
    if (documentNode.type !== editor.schema.topNodeType) {
      throw new DocumentSchemaError();
    }
    return documentNode;
  } catch {
    throw new DocumentSchemaError();
  }
}
