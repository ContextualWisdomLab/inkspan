import type { Editor } from '@tiptap/react';
import {
  parseDocumentEnvelope,
  parseDocumentEnvelopeBytes,
  type CwlEditorDocumentEnvelope,
  type DocumentEnvelopeLimits,
} from './documentEnvelope.js';
import { parseValidatedDocumentJsonForEditor } from './documentSchema.js';

type DocumentEnvelopeParser = (
  source: unknown,
  limits?: DocumentEnvelopeLimits,
) => CwlEditorDocumentEnvelope;

/** Parsed envelope plus the complete active-schema document node to apply. */
export interface PreparedDocumentEnvelope {
  /** Detached, deeply frozen envelope accepted by the strict parser. */
  readonly envelope: CwlEditorDocumentEnvelope;
  /** Complete ProseMirror document reconstructed under the active schema. */
  readonly documentNode: ReturnType<typeof parseValidatedDocumentJsonForEditor>;
}

/** Prepare an object or JSON-text envelope without mutating the editor. */
export function prepareDocumentEnvelopeForEditor(
  editor: Editor,
  source: unknown,
  limits?: DocumentEnvelopeLimits,
): PreparedDocumentEnvelope {
  return prepareWithParser(editor, source, limits, parseDocumentEnvelope);
}

/** Prepare strict UTF-8 envelope bytes without mutating the editor. */
export function prepareDocumentEnvelopeBytesForEditor(
  editor: Editor,
  source: unknown,
  limits?: DocumentEnvelopeLimits,
): PreparedDocumentEnvelope {
  return prepareWithParser(editor, source, limits, parseDocumentEnvelopeBytes);
}

/** Check whether a JSON-text or object envelope can be restored safely. */
export function validateDocumentEnvelopeForEditor(
  editor: Editor,
  source: unknown,
  limits?: DocumentEnvelopeLimits,
): boolean {
  return validateWithPreparation(
    editor,
    source,
    limits,
    prepareDocumentEnvelopeForEditor,
  );
}

/** Check whether strict UTF-8 envelope bytes can be restored safely. */
export function validateDocumentEnvelopeBytesForEditor(
  editor: Editor,
  source: unknown,
  limits?: DocumentEnvelopeLimits,
): boolean {
  return validateWithPreparation(
    editor,
    source,
    limits,
    prepareDocumentEnvelopeBytesForEditor,
  );
}

/** Atomically restore a JSON-text or object envelope into an active editor. */
export function restoreDocumentEnvelope(
  editor: Editor,
  source: unknown,
  limits?: DocumentEnvelopeLimits,
): CwlEditorDocumentEnvelope {
  return restorePrepared(
    editor,
    prepareDocumentEnvelopeForEditor(editor, source, limits),
  );
}

/** Atomically restore strict canonical UTF-8 envelope bytes into an editor. */
export function restoreDocumentEnvelopeBytes(
  editor: Editor,
  source: unknown,
  limits?: DocumentEnvelopeLimits,
): CwlEditorDocumentEnvelope {
  return restorePrepared(
    editor,
    prepareDocumentEnvelopeBytesForEditor(editor, source, limits),
  );
}

type DocumentEnvelopePreparation = (
  editor: Editor,
  source: unknown,
  limits?: DocumentEnvelopeLimits,
) => PreparedDocumentEnvelope;

function validateWithPreparation(
  editor: Editor,
  source: unknown,
  limits: DocumentEnvelopeLimits | undefined,
  prepare: DocumentEnvelopePreparation,
): boolean {
  try {
    prepare(editor, source, limits);
    return true;
  } catch {
    return false;
  }
}

function restorePrepared(
  editor: Editor,
  prepared: PreparedDocumentEnvelope,
): CwlEditorDocumentEnvelope {
  editor.commands.setContent(prepared.documentNode, false);
  return prepared.envelope;
}

function prepareWithParser(
  editor: Editor,
  source: unknown,
  limits: DocumentEnvelopeLimits | undefined,
  parser: DocumentEnvelopeParser,
): PreparedDocumentEnvelope {
  const envelope = parser(source, limits);
  return {
    envelope,
    documentNode: parseValidatedDocumentJsonForEditor(
      editor,
      envelope.documentJson,
    ),
  };
}
