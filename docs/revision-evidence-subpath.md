# Framework-independent revision evidence

Use the dedicated revision-evidence subpath in servers, workers, queues,
migration jobs, storage adapters, and other processes that do not render an
editor:

```ts
import {
  createDocumentEnvelopeRevisionEvidence,
  createDocumentEnvelopeRevisionEvidenceBytes,
  createDocumentEnvelopeTransitionEvidence,
  createDocumentEnvelopeTransitionEvidenceBytes,
  type DocumentEnvelopeDigestProvider,
} from '@contextualwisdomlab/cwl-editor/revision-evidence';

const captured = await createDocumentEnvelopeRevisionEvidence(
  persistedEnvelope,
  limits,
  digestProvider,
);

await saveVersion({
  document_envelope: captured.envelope,
  strong_entity_tag: captured.revision.strongEntityTag,
});

const transition = await createDocumentEnvelopeTransitionEvidence(
  previousEnvelope,
  resultingEnvelope,
  limits,
  digestProvider,
);

await publishAuthenticatedAuditEvent({
  actor_identity: authenticatedActorIdentity,
  tenant_scope: authorizedTenantScope,
  operation_type: 'document_revision_replaced',
  occurred_at: serverTime,
  durable_result: durableWriteResult,
  content_transition: transition,
});
```

The subpath is published as independent ESM, CommonJS, and TypeScript
declaration artifacts. It bundles only Inkspan's versioned-envelope parser,
canonical JSON/UTF-8 serializer, SHA-256 revision contract, frozen revision-
envelope pairing, and compact content-lineage evidence. It does not load React,
React DOM, TipTap, ProseMirror, Yjs, an editor component, a transport client, a
database adapter, credentials, or environment configuration.

The root package continues to export the same functions for compatibility.
Applications already using `CwlEditor` can keep one root import. Non-editor
processes should prefer `/revision-evidence` so their loaded module graph does
not evaluate the interactive editor.

Because this subpath is distributed inside the existing editor package, a normal
npm or pnpm installation still installs the package-level dependencies declared
by `@contextualwisdomlab/cwl-editor`. The subpath guarantees framework-free
module evaluation, not a smaller registry dependency graph. A separately
versioned npm package would be required if procurement, image size, or software
composition policy later requires dependency-level isolation.

## Single-revision evidence semantics

Both single-revision object/JSON and strict UTF-8 functions return one shallow-
frozen object:

```ts
{
  envelope, // detached and deeply frozen
  revision, // frozen SHA-256 equality validator
}
```

The revision is derived from the RFC 8785 canonical UTF-8 representation of the
returned envelope. One operation performs one strict parse and one digest-
provider invocation. Equivalent noncanonical JSON input is normalized before
hashing.

The strong entity tag may be used as an HTTP `ETag` only when it identifies the
actual selected representation. A durable service must enforce authenticated,
atomic RFC 9110 `If-Match` comparison in the same transaction that writes the
new document. Local evidence is not authorization, tenant membership, a
signature, a bearer token, or proof of persistence.

## Transition evidence semantics

`createDocumentEnvelopeTransitionEvidence()` validates two envelope objects or
JSON texts. `createDocumentEnvelopeTransitionEvidenceBytes()` applies the same
contract to two strict UTF-8 byte views. Both sources are parsed successfully
before either digest begins. Successful operations invoke the digest provider
exactly twice and sequentially: previous first and resulting second.

The frozen result contains only:

```ts
{
  schemaId: 'https://inkspan.io/schemas/document-transition-evidence/v1',
  schemaVersion: 1,
  previousRevision,
  resultingRevision,
  changed,
}
```

`changed` is false exactly when the two canonical SHA-256 digests are equal.
Equivalent noncanonical JSON inputs therefore classify identically. The result
contains no envelope or document body and is suitable for embedding inside a
host-owned authenticated event without duplicating author content.

Transition evidence is local content-lineage evidence and does not prove that a durable write occurred. It also does not prove actor identity, tenant authority,
operation type, time, authorization, signature, review acceptance, transport
success, model execution, or non-repudiation. Hosts must add and authenticate
those occurrence facts under their own event schema and persistence transaction.

## Failure and rollback behavior

Invalid previous or resulting input fails before hashing and returns no partial
evidence. Malformed UTF-8, byte-order marks, duplicate object names, unsupported
versions, Unicode-scalar failures, negative zero, resource-limit violations,
invalid digest lengths, and digest-provider failures retain the existing typed,
bounded, redacted boundaries.

The API performs no editor mutation, network request, clock read, queue
publication, database write, authorization check, or model call. Removing the
transition constants, type, and functions requires no stored-document migration
and leaves existing revision evidence, guarded restore, autosave, collaboration,
and editor behavior source-compatible.

## Security and privacy

Single-revision evidence contains the complete client-controlled envelope,
including author text, accepted hyperlinks, alternative text, inline base64
image payloads, and extension attributes. Do not copy its envelope into ordinary
logs, metrics labels, analytics events, exception messages, public URLs, or
compact revision metadata.

Compact transition evidence omits both envelopes, but its revisions can still
reveal content equality and should be treated as tenant-confidential metadata
unless host policy explicitly permits sharing. Never use a revision as a bearer
credential, public object identifier, signature, authorization grant, tenant
identifier, or server-selected durable validator without verifying that it
identifies the exact selected representation.

CWL and naruon hosts retain tenant authorization, request-size and concurrency
limits, migration routing, encryption and signing, key management, retention,
regional residency, audit, retry, occurrence provenance, and conflict-resolution
policy. No database object is introduced by this API. Host persistence objects
should use at least two descriptive words and `snake_case` by default.

## Standalone, naruon, and service integration

A standalone application can create transition evidence in the same process and
attach it to its own authenticated audit record. A naruon `compose` or
`ui.panel` host can capture it at the panel boundary and send only the compact
revision pair to a host service. Workers and queues can validate the same object
through the framework-independent subpath without loading the editor graph.

Inkspan owns canonical content and revision semantics. The host owns transport,
authorization, tenant isolation, persistence, credentials, migration, retention,
actor and service identity, server time, operation naming, durable acceptance,
signing, access control, and model-use policy. `contextual-orchestrator` may be
used only after the host authorizes model execution; it does not become the
owner of editor state or transition provenance.

## Distribution verification

The release gate packs the exact npm artifact, extracts it into an operating-
system temporary `node_modules` tree containing only Inkspan, and executes the
subpath through ESM and CommonJS without installing any framework dependency.
The consumers execute both single-revision and transition evidence. A strict
TypeScript consumer compiles both public types against the same extracted
package with `lib: ['ES2022']` and no DOM or framework types.

An accidental React, React DOM, TipTap, ProseMirror, Yjs, missing export, or
editor-type import therefore fails before merge. This deliberately tests the
subpath's runtime graph more strictly than a normal package-manager installation,
which installs the package-level closure.

## References (APA 7th edition)

Bray, T. (2017). *The JavaScript Object Notation (JSON) data interchange format*
(RFC 8259). RFC Editor. https://doi.org/10.17487/RFC8259

Fielding, R., Nottingham, M., & Reschke, J. (2022). *HTTP semantics* (RFC
9110). RFC Editor. https://doi.org/10.17487/RFC9110

Moreau, L., & Missier, P. (Eds.). (2013). *PROV-DM: The PROV data model* (W3C
Recommendation). World Wide Web Consortium.
https://www.w3.org/TR/2013/REC-prov-dm-20130430/

National Institute of Standards and Technology. (2015). *Secure Hash Standard
(SHS)* (FIPS PUB 180-4). U.S. Department of Commerce.
https://doi.org/10.6028/NIST.FIPS.180-4

OpenJS Foundation. (n.d.). *Packages: Package entry points*. Node.js. Retrieved
August 4, 2026, from https://nodejs.org/api/packages.html#package-entry-points

Rundgren, A., Jordan, B., & Erdtman, S. (2020). *JSON Canonicalization Scheme
(JCS)* (RFC 8785). RFC Editor. https://doi.org/10.17487/RFC8785

WHATWG. (n.d.). *Encoding Standard*. Retrieved August 4, 2026, from
https://encoding.spec.whatwg.org/

World Wide Web Consortium. (2013). *PROV overview*.
https://www.w3.org/TR/2013/NOTE-prov-overview-20130430/

World Wide Web Consortium. (2017). *Web Cryptography API* (W3C
Recommendation). https://www.w3.org/TR/2017/REC-WebCryptoAPI-20170126/
