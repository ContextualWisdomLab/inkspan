import type { Editor } from '@tiptap/react';
import type { EditorState } from '@tiptap/pm/state';
import {
  parseDocumentEnvelope,
  parseDocumentEnvelopeBytes,
  type CwlEditorDocumentEnvelope,
  type DocumentEnvelopeLimits,
} from './documentEnvelope.js';
import { parseValidatedDocumentJsonForEditor } from './documentSchema.js';

const REJECTED_RESTORE_MESSAGE =
  'Document replacement was rejected or transformed by an editor policy';

type DocumentEnvelopeParser = (
  source: unknown,
  limits?: DocumentEnvelopeLimits,
) => CwlEditorDocumentEnvelope;

/** Error raised when an active editor policy refuses the prepared document. */
export class DocumentEnvelopeRestoreError extends Error {
  /** Create a bounded error that never includes document content. */
  constructor() {
    super(REJECTED_RESTORE_MESSAGE);
    this.name = 'DocumentEnvelopeRestoreError';
  }
}

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
  return applyPreparedDocumentEnvelope(
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
  return applyPreparedDocumentEnvelope(
    editor,
    prepareDocumentEnvelopeBytesForEditor(editor, source, limits),
  );
}

/**
 * Apply one already-validated envelope and verify the active editor accepted it.
 *
 * ProseMirror transaction filters may reject schema-valid content for security
 * or host policy reasons, while append-transaction hooks may transform an
 * otherwise accepted replacement. Preview those document-policy semantics on
 * detached state first so a known rejection/transformation cannot partially
 * mutate the live editor. If live dispatch either diverges or throws after the
 * view has already accepted the replacement, restore the captured local editor
 * state before reporting one payload-redacted restore failure. The rollback is
 * intentionally local; Inkspan does not claim authority over external effects
 * a host plugin or observer may have emitted during dispatch.
 */
export function applyPreparedDocumentEnvelope(
  editor: Editor,
  prepared: PreparedDocumentEnvelope,
): CwlEditorDocumentEnvelope {
  const originalState = editor.state;
  const previewTransaction = originalState.tr
    .replaceWith(
      0,
      originalState.doc.content.size,
      prepared.documentNode.content,
    )
    .setMeta('preventUpdate', true);
  const previewState = originalState.applyTransaction(previewTransaction).state;
  if (!previewState.doc.eq(prepared.documentNode)) {
    throw new DocumentEnvelopeRestoreError();
  }

  try {
    editor.commands.setContent(prepared.documentNode, false);
  } catch {
    restoreCapturedEditorState(editor, originalState);
    throw new DocumentEnvelopeRestoreError();
  }
  if (!editor.state.doc.eq(prepared.documentNode)) {
    restoreCapturedEditorState(editor, originalState);
    throw new DocumentEnvelopeRestoreError();
  }
  return prepared.envelope;
}

/** Best-effort local rollback that never reflects host callback/plugin failures. */
function restoreCapturedEditorState(editor: Editor, state: EditorState): void {
  try {
    editor.view.updateState(state);
  } catch {
    // A hostile or failing plugin view must not replace the redacted restore error.
  }
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
