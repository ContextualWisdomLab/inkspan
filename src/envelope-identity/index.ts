/**
 * Framework-independent document-envelope identity routing entrypoint.
 *
 * This subpath intentionally excludes React, TipTap UI, ProseMirror view, Yjs,
 * network clients, persistence adapters, credentials, and model SDKs. It returns
 * only validated schema identity so a host can select its own migration path.
 */
export {
  inspectDocumentEnvelopeIdentity,
  inspectDocumentEnvelopeIdentityBytes,
} from '../documentEnvelopeIdentity.js';
export type { CwlEditorDocumentEnvelopeIdentity } from '../documentEnvelopeIdentity.js';
export type { DocumentEnvelopeLimits } from '../documentEnvelope.js';
