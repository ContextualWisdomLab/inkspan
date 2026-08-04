import type { Node as ProseMirrorNode } from '@tiptap/pm/model';
import type { Editor } from '@tiptap/react';
import {
  createDocumentEnvelope,
  type CwlEditorDocumentEnvelope,
  type DocumentEnvelopeLimits,
} from './documentEnvelope.js';
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
      /** Detached validated envelope applied to the editor. */
      readonly envelope: CwlEditorDocumentEnvelope;
    }
  | {
      /** The current editor document no longer satisfies the precondition. */
      readonly status: 'conflict';
      /**
       * Stable observed revision, or `null` when the document moved while the
       * digest or untrusted-source preparation was in progress, or when the
       * editor was destroyed, and no captured tag is still current.
       */
      readonly currentRevision: CwlEditorDocumentRevision | null;
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

/** Restore strict UTF-8 envelope bytes only when the current tag matches. */
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
    });
  }

  const prepared = prepare(editor, source, limits);
  if (hasEditorMoved(editor, capturedDocument)) {
    return createMovedDocumentConflict();
  }

  const envelope = applyPreparedDocumentEnvelope(editor, prepared);
  return Object.freeze({
    status: 'restored',
    previousRevision: currentRevision,
    envelope,
  });
}

function hasEditorMoved(
  editor: Editor,
  capturedDocument: ProseMirrorNode,
): boolean {
  return editor.isDestroyed || editor.state.doc !== capturedDocument;
}

function createMovedDocumentConflict(): CwlEditorIfMatchRestoreResult {
  return Object.freeze({
    status: 'conflict',
    currentRevision: null,
  });
}

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
