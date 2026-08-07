# Deterministic Document Transition Evidence Design

**Date:** 2026-08-07  
**Target release:** Inkspan 0.5.30 or later

## Objective

Inkspan can already normalize a versioned document envelope and derive the
matching SHA-256 revision evidence, and guarded editor restore can return full
before-and-after envelopes after one accepted replacement. Host persistence,
review, workflow, and audit systems still lack a compact framework-independent
contract that binds one validated content revision to another without copying
the complete document into logs or event metadata.

Add pure object/JSON and strict UTF-8 functions that validate two Inkspan
document envelopes, derive their exact revisions, and return one frozen,
privacy-minimized transition-evidence object. The result records content
lineage only. It is not proof that a durable write, review, authorization,
signature, user action, or model execution occurred.

## Public API

```ts
export const DOCUMENT_TRANSITION_EVIDENCE_SCHEMA_ID:
  'https://inkspan.io/schemas/document-transition-evidence/v1';

export const DOCUMENT_TRANSITION_EVIDENCE_SCHEMA_VERSION: 1;

export interface CwlEditorDocumentTransitionEvidence {
  readonly schemaId: typeof DOCUMENT_TRANSITION_EVIDENCE_SCHEMA_ID;
  readonly schemaVersion: typeof DOCUMENT_TRANSITION_EVIDENCE_SCHEMA_VERSION;
  readonly previousRevision: CwlEditorDocumentRevision;
  readonly resultingRevision: CwlEditorDocumentRevision;
  readonly changed: boolean;
}

export function createDocumentEnvelopeTransitionEvidence(
  previousSource: unknown,
  resultingSource: unknown,
  limits?: DocumentEnvelopeLimits,
  digestProvider?: DocumentEnvelopeDigestProvider | null,
): Promise<CwlEditorDocumentTransitionEvidence>;

export function createDocumentEnvelopeTransitionEvidenceBytes(
  previousSource: unknown,
  resultingSource: unknown,
  limits?: DocumentEnvelopeLimits,
  digestProvider?: DocumentEnvelopeDigestProvider | null,
): Promise<CwlEditorDocumentTransitionEvidence>;
```

The functions are exported from the package root and the existing
`@contextualwisdomlab/cwl-editor/revision-evidence` subpath. No new registry
package or runtime dependency is introduced.

## Architecture

Create `src/documentTransitionEvidence.ts` beside the existing envelope and
revision-evidence modules:

1. Parse both object/JSON sources through `parseDocumentEnvelope()` or both byte
   sources through `parseDocumentEnvelopeBytes()` before invoking the digest
   provider.
2. Retain the exact deeply frozen normalized envelopes only for the duration of
   the operation.
3. Derive the previous revision, then the resulting revision, through the
   existing package-internal validated-envelope helper. Digest calls remain
   sequential so stateful or hardware-backed providers are not forced into
   undocumented re-entrancy.
4. Compare the two lowercase SHA-256 digests to derive `changed`.
5. Return a shallow-frozen schema object containing only the two already-frozen
   revisions and the boolean transition classification.

The output deliberately omits document bodies, actor identity, tenant identity,
clock time, operation name, reason, authorization claims, signatures, durable
validators, model metadata, and transport status. Hosts may place the compact
result inside their own authenticated event schema, but Inkspan does not invent
or authorize those facts.

## Invariants

- Each returned revision is derived from the exact validated normalized source
  supplied for that side of the transition.
- Both sources are parsed successfully before any digest-provider call occurs.
- Exactly two sequential SHA-256 digest calls occur on a successful operation:
  previous first, resulting second.
- Equivalent noncanonical JSON or strict UTF-8 encodings produce equivalent
  revision pairs.
- `changed` is false exactly when the two derived strong revisions are equal.
- The top-level evidence object and both nested revisions are frozen.
- The returned object contains no `envelope`, `documentJson`, text, hyperlink,
  alternative-text, inline-image, or extension-attribute field.
- Existing duplicate-name, strict UTF-8, Unicode-scalar, negative-zero,
  resource-limit, canonicalization, digest-length, and redacted-error boundaries
  remain authoritative through composition.
- No React, React DOM, TipTap, ProseMirror, Yjs, transport, persistence,
  database, credential, tenant, model, scheduler, or environment dependency is
  added to the framework-independent subpath.

## Security, privacy, and provenance boundary

A pair of content revisions is compact local lineage evidence. It can help a
host deduplicate an event, bind a review artifact to its before-and-after
content, or construct a provider-neutral audit record without logging the
complete document. It does not prove who caused the transition, when or where it
occurred, which operation produced it, whether the source was authorized,
whether the result was accepted, or whether any durable representation exists.

W3C PROV distinguishes entities and their derivation from the activities,
agents, and times that establish occurrence provenance. Inkspan therefore owns
only the deterministic entity-revision pair. A host that needs an audit event
must add authenticated actor/service identity, tenant scope, operation type,
server time, request correlation, policy decision, durable result, retention,
signing, and access control under its own schema and transaction boundary.

The revision values remain equality validators, not signatures, bearer tokens,
non-repudiation evidence, tenant membership, or server-selected durable HTTP
validators. A service may expose one as an HTTP `ETag` only when it identifies
the exact selected representation and the service enforces RFC 9110 comparison
semantics. Full envelopes remain private and are intentionally absent from this
transition object.

## Failure and rollback behavior

- Invalid previous or resulting sources fail before hashing and return no
  partial evidence.
- Digest-provider failures retain the existing typed, bounded revision error and
  return no partial evidence.
- No mutation, network request, editor transaction, persistence write, or audit
  event occurs inside the API.
- Rollback is removal of the two functions, constants, and type exports; existing
  revision-evidence, guarded-restore, autosave, editor, collaboration, and Office
  surfaces remain source-compatible.

## Verification

- Different realistic documents return known SHA-256 previous and resulting
  revisions with `changed: true`.
- Equivalent object/JSON and noncanonical strict UTF-8 sources return
  `changed: false` and matching revision pairs.
- Invalid resulting input proves that neither side is hashed.
- A concurrency-sensitive provider proves the two digest calls never overlap
  and preserves previous-before-resulting call order.
- The result is frozen, nested revisions are frozen, and a recursive key scan
  proves that no document-content field is exposed.
- Root and framework-independent entrypoint tests expose the complete contract.
- Packed ESM, CommonJS, and strict TypeScript consumers execute the API without
  React, React DOM, TipTap, ProseMirror, or Yjs installed.
- Repository CI retains 100% production statement, branch, function, and line
  coverage; Office Python 3.11/3.14 branch and shipped-symbol docstring coverage
  remain 100%.
- Exact-head CI, security, SAST, package, provenance, unresolved-thread, and
  independent-review gates remain mandatory before merge or release.

## References (APA 7th edition)

Fielding, R., Nottingham, M., & Reschke, J. (2022). *HTTP semantics* (RFC
9110). RFC Editor. https://doi.org/10.17487/RFC9110

Moreau, L., & Missier, P. (Eds.). (2013). *PROV-DM: The PROV data model* (W3C
Recommendation). World Wide Web Consortium.
https://www.w3.org/TR/2013/REC-prov-dm-20130430/

National Institute of Standards and Technology. (2015). *Secure Hash Standard
(SHS)* (FIPS PUB 180-4). U.S. Department of Commerce.
https://doi.org/10.6028/NIST.FIPS.180-4

Rundgren, A., Jordan, B., & Erdtman, S. (2020). *JSON Canonicalization Scheme
(JCS)* (RFC 8785). RFC Editor. https://doi.org/10.17487/RFC8785

World Wide Web Consortium. (2013). *PROV overview*.
https://www.w3.org/TR/2013/NOTE-prov-overview-20130430/
