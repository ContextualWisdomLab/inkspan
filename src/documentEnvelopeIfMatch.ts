import type { Node as ProseMirrorNode } from '@tiptap/pm/model';
import type { Editor } from '@tiptap/react';
import {
  createDocumentEnvelope,
  type CwlEditorDocumentEnvelope,
  type DocumentEnvelopeLimits,
} from './documentEnvelope.js';
import {
  createValidatedDocumentEnvelopeRevisionEvidence,
} from './documentRevisionEvidence.js';
import {
  createValidatedDocumentEnvelopeRevision,
  DocumentEnvelopeRevisionError,
  type CwlEditorDocumentRevision,
  type DocumentEnvelopeDigestProvider,
} from './documentEnvelopeRevision.js';
import {
  applyPreparedDocumentEnvelope,
  prepareDocumentEnvelopeBytesForEditor,
  prepareDocumentEnvelopeForEditor,
  type PreparedDocumentEnvelope,
} from './documentEnvelopeRestore.js';

const STRONG_DOCUMENT_ENTITY_TAG = /^"sha256-[0-9a-f]{64}"$/u;
const STRONG_DOCUMENT_ENTITY_TAG_LENGTH = 73;

/** Result of applying an envelope under a local strong-revision precondition. */
export type CwlEditorIfMatchRestoreResult =
  | {
      /** The expected revision matched and one replacement was applied. */
      readonly status: 'restored';
      /** Stable revision that guarded the replacement. */
      readonly previousRevision: CwlEditorDocumentRevision;
      /** Exact frozen envelope from which `previousRevision` was derived. */
      readonly previousEnvelope: CwlEditorDocumentEnvelope;
      /** SHA-256 strong validator derived from the applied `envelope`. */
      readonly revision: CwlEditorDocumentRevision;
      /** Exact frozen active-schema envelope applied to the editor. */
      readonly envelope: CwlEditorDocumentEnvelope;
    }
  | {
      /** A stable current document did not satisfy the precondition. */
      readonly status: 'conflict';
      /** Stable observed revision that did not match the expected validator. */
      readonly currentRevision: CwlEditorDocumentRevision;
      /** Exact frozen envelope from which `currentRevision` was derived. */
      readonly currentEnvelope: CwlEditorDocumentEnvelope;
    }
  | {
      /** No captured version can still be reported as the active document. */
      readonly status: 'conflict';
      /** Null because the editor moved or was destroyed during the operation. */
      readonly currentRevision: null;
      /** Null in lockstep with `currentRevision`; the host must read afresh. */
      readonly currentEnvelope: null;
    };

type DocumentEnvelopePreparation = (
  editor: Editor,
  source: unknown,
  limits?: DocumentEnvelopeLimits,
) => PreparedDocumentEnvelope;

/**
 * Restore an object or JSON-text envelope only when the current tag matches.
 *
 * Revision mismatch, document movement, and editor destruction are normal
 * conflict results. Invalid tags, digest failures, envelope violations, schema
 * incompatibility, and editor policy rejection retain typed, redacted
 * exceptions and never report success.
 */
export function restoreDocumentEnvelopeIfMatch(
  editor: Editor,
  expectedStrongEntityTag: string,
  source: unknown,
  limits?: DocumentEnvelopeLimits,
  digestProvider?: DocumentEnvelopeDigestProvider | null,
): Promise<CwlEditorIfMatchRestoreResult> {
  return restoreIfMatch(
    editor,
    expectedStrongEntityTag,
    source,
    limits,
    digestProvider,
    prepareDocumentEnvelopeForEditor,
  );
}

/**
 * Restore strict UTF-8 envelope bytes only when the current tag matches.
 *
 * The byte path applies the same lifecycle, revision, schema, policy, and
 * revision-envelope evidence guarantees as the object and JSON-text path.
 */
export function restoreDocumentEnvelopeBytesIfMatch(
  editor: Editor,
  expectedStrongEntityTag: string,
  source: unknown,
  limits?: DocumentEnvelopeLimits,
  digestProvider?: DocumentEnvelopeDigestProvider | null,
): Promise<CwlEditorIfMatchRestoreResult> {
  return restoreIfMatch(
    editor,
    expectedStrongEntityTag,
    source,
    limits,
    digestProvider,
    prepareDocumentEnvelopeBytesForEditor,
  );
}

/**
 * Execute one guarded restore using a caller-selected envelope preparation path.
 *
 * The function captures and hashes one current envelope, returns that same
 * frozen envelope beside every non-null current revision, reconstructs the
 * incoming source through the active schema, and hashes the exact normalized
 * document that will be applied. It does not inspect the incoming source when
 * the expected validator already conflicts.
 */
async function restoreIfMatch(
  editor: Editor,
  expectedStrongEntityTag: string,
  source: unknown,
  limits: DocumentEnvelopeLimits | undefined,
  digestProvider: DocumentEnvelopeDigestProvider | null | undefined,
  prepare: DocumentEnvelopePreparation,
): Promise<CwlEditorIfMatchRestoreResult> {
  assertExpectedStrongEntityTag(expectedStrongEntityTag);
  if (editor.isDestroyed) {
    return createMovedDocumentConflict();
  }

  const capturedDocument = editor.state.doc;
  const currentEnvelope = createDocumentEnvelope(
    capturedDocument.toJSON(),
    limits,
  );
  const currentRevision = await createValidatedDocumentEnvelopeRevision(
    currentEnvelope,
    digestProvider,
  );

  if (hasEditorMoved(editor, capturedDocument)) {
    return createMovedDocumentConflict();
  }
  if (currentRevision.strongEntityTag !== expectedStrongEntityTag) {
    return Object.freeze({
      status: 'conflict',
      currentRevision,
      currentEnvelope,
    });
  }

  const prepared = prepare(editor, source, limits);
  const appliedEnvelope = createDocumentEnvelope(
    prepared.documentNode.toJSON(),
    limits,
  );
  const nextEvidence =
    await createValidatedDocumentEnvelopeRevisionEvidence(
      appliedEnvelope,
      digestProvider,
    );
  if (hasEditorMoved(editor, capturedDocument)) {
    return createMovedDocumentConflict();
  }

  applyPreparedDocumentEnvelope(editor, prepared);
  return Object.freeze({
    status: 'restored',
    previousRevision: currentRevision,
    previousEnvelope: currentEnvelope,
    revision: nextEvidence.revision,
    envelope: nextEvidence.envelope,
  });
}

/** Check whether the captured document can no longer authorize a replacement. */
function hasEditorMoved(
  editor: Editor,
  capturedDocument: ProseMirrorNode,
): boolean {
  return editor.isDestroyed || editor.state.doc !== capturedDocument;
}

/** Create the frozen conflict returned when no captured evidence remains current. */
function createMovedDocumentConflict(): CwlEditorIfMatchRestoreResult {
  return Object.freeze({
    status: 'conflict',
    currentRevision: null,
    currentEnvelope: null,
  });
}

/** Reject any validator outside Inkspan's exact quoted lowercase strong-tag form. */
function assertExpectedStrongEntityTag(value: unknown): asserts value is string {
  if (
    typeof value !== 'string' ||
    value.length !== STRONG_DOCUMENT_ENTITY_TAG_LENGTH ||
    !STRONG_DOCUMENT_ENTITY_TAG.test(value)
  ) {
    throw new DocumentEnvelopeRevisionError(
      'Expected document revision must be an Inkspan SHA-256 strong entity tag',
    );
  }
}
