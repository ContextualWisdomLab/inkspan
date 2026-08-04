/**
 * Framework-independent Inkspan revision-evidence entrypoint.
 *
 * This subpath intentionally excludes React, TipTap, ProseMirror, Yjs, editor
 * components, and transport or persistence adapters. Server, worker, queue,
 * migration, and storage processes can parse versioned envelopes, create
 * deterministic canonical bytes, and derive paired SHA-256 revision evidence
 * without loading the interactive editor bundle.
 */

export {
  DEFAULT_DOCUMENT_ENVELOPE_LIMITS,
  DOCUMENT_ENVELOPE_SCHEMA_ID,
  DOCUMENT_ENVELOPE_SCHEMA_VERSION,
  DocumentEnvelopeError,
  createDocumentEnvelope,
  parseDocumentEnvelope,
  parseDocumentEnvelopeBytes,
} from '../documentEnvelope.js';
export type {
  CwlEditorDocumentEnvelope,
  DocumentEnvelopeLimits,
} from '../documentEnvelope.js';
export {
  encodeDocumentEnvelope,
  serializeDocumentEnvelope,
} from '../documentEnvelopeCanonical.js';
export {
  DocumentEnvelopeRevisionError,
  createDocumentEnvelopeRevision,
  createDocumentEnvelopeRevisionBytes,
} from '../documentEnvelopeRevision.js';
export type {
  CwlEditorDocumentRevision,
  DocumentEnvelopeDigestProvider,
} from '../documentEnvelopeRevision.js';
export {
  createDocumentEnvelopeRevisionEvidence,
  createDocumentEnvelopeRevisionEvidenceBytes,
} from '../documentRevisionEvidence.js';
export type { CwlEditorDocumentRevisionEvidence } from '../documentRevisionEvidence.js';
