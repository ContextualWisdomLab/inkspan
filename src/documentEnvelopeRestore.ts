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

interface PreparedDocumentEnvelope {
  readonly envelope: CwlEditorDocumentEnvelope;
  readonly documentNode: ReturnType<typeof parseValidatedDocumentJsonForEditor>;
}

/** Check whether a JSON-text or object envelope can be restored safely. */
export function validateDocumentEnvelopeForEditor(
  editor: Editor,
  source: unknown,
  limits?: DocumentEnvelopeLimits,
): boolean {
  return validateWithParser(editor, source, limits, parseDocumentEnvelope);
}

/** Check whether strict UTF-8 envelope bytes can be restored safely. */
export function validateDocumentEnvelopeBytesForEditor(
  editor: Editor,
  source: unknown,
  limits?: DocumentEnvelopeLimits,
): boolean {
  return validateWithParser(editor, source, limits, parseDocumentEnvelopeBytes);
}

/** Atomically restore a JSON-text or object envelope into an active editor. */
export function restoreDocumentEnvelope(
  editor: Editor,
  source: unknown,
  limits?: DocumentEnvelopeLimits,
): CwlEditorDocumentEnvelope {
  return restoreWithParser(editor, source, limits, parseDocumentEnvelope);
}

/** Atomically restore strict canonical UTF-8 envelope bytes into an editor. */
export function restoreDocumentEnvelopeBytes(
  editor: Editor,
  source: unknown,
  limits?: DocumentEnvelopeLimits,
): CwlEditorDocumentEnvelope {
  return restoreWithParser(editor, source, limits, parseDocumentEnvelopeBytes);
}

function validateWithParser(
  editor: Editor,
  source: unknown,
  limits: DocumentEnvelopeLimits | undefined,
  parser: DocumentEnvelopeParser,
): boolean {
  try {
    prepareDocumentEnvelope(editor, source, limits, parser);
    return true;
  } catch {
    return false;
  }
}

function restoreWithParser(
  editor: Editor,
  source: unknown,
  limits: DocumentEnvelopeLimits | undefined,
  parser: DocumentEnvelopeParser,
): CwlEditorDocumentEnvelope {
  const prepared = prepareDocumentEnvelope(editor, source, limits, parser);
  editor.commands.setContent(prepared.documentNode, false);
  return prepared.envelope;
}

function prepareDocumentEnvelope(
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
