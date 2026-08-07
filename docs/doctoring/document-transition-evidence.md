# Doctoring record: Privacy-minimized document transition evidence

**Date:** 2026-08-07  
**Target release:** Inkspan 0.5.30 or later  
**Decision owner:** ContextualWisdomLab  
**Scope:** Framework-independent, deterministic content-lineage evidence for two validated Inkspan document envelopes.

## Review finding

Inkspan already produced one immutable document envelope paired with its exact
SHA-256 revision, and its guarded restore surface returned full before-and-after
envelopes after an accepted local replacement. Those contracts were sufficient
for optimistic-concurrency coordination and conflict handling, but they left a
buyer-visible auditability gap: a host that wanted compact before/after lineage
had to invent its own revision-pair schema or place complete document bodies in
an event record.

Copying full envelopes into logs, metrics, analytics, review metadata, or event
headers is an avoidable privacy and operational risk. An envelope may include
author text, accepted hyperlinks, alternative text, inline base64 image bytes,
and extension attributes. Conversely, a bare pair of hashes can be overclaimed
as proof of a durable write, user action, authorization decision, signature, or
review acceptance when it proves only equality of two canonical content
entities.

## Selected design

Inkspan now exposes a compact schema from both the root package and
`@contextualwisdomlab/cwl-editor/revision-evidence`:

```ts
interface CwlEditorDocumentTransitionEvidence {
  readonly schemaId:
    'https://inkspan.io/schemas/document-transition-evidence/v1';
  readonly schemaVersion: 1;
  readonly previousRevision: CwlEditorDocumentRevision;
  readonly resultingRevision: CwlEditorDocumentRevision;
  readonly changed: boolean;
}
```

`createDocumentEnvelopeTransitionEvidence()` accepts envelope objects or JSON
texts. `createDocumentEnvelopeTransitionEvidenceBytes()` accepts strict UTF-8
bytes. Both functions:

1. validate and normalize the previous source;
2. validate and normalize the resulting source;
3. complete both parses before invoking a digest provider;
4. derive the previous SHA-256 revision first and the resulting revision second;
5. classify `changed` by exact lowercase digest equality; and
6. return a frozen object containing only the two frozen revisions and the
   classification.

The sequential digest order avoids silently imposing re-entrancy on injected
Web Crypto, Node.js, hardware-backed, remote-isolated, or test providers. The
existing RFC 8785 canonicalization, strict UTF-8, duplicate-name rejection,
Unicode-scalar validation, negative-zero rejection, resource ceilings,
digest-length checks, and redacted typed failures remain authoritative through
composition.

## Provenance and claim boundary

W3C PROV-DM distinguishes entities and their derivations from the activities,
agents, roles, usage/generation events, and times that establish occurrence
provenance. Inkspan therefore owns deterministic content-entity lineage only.
The transition object does not prove who caused a transition, when it occurred, or whether it was durably accepted. It also does not prove authorization,
tenant membership, review approval, signature validity, model execution,
transport success, or non-repudiation.

A standalone host, naruon panel, service, queue, or audit pipeline may embed the
compact object inside a host-owned authenticated event. That event must add and
validate its own actor or service identity, tenant scope, operation type,
server-selected time, request correlation, policy decision, durable result,
retention class, access policy, signing or attestation, and transactional
relationship to persistence. Those facts must not be inferred from Inkspan's
content revisions.

The revisions are local equality validators. Under RFC 9110, a service may emit
one as an HTTP `ETag` only when it identifies the exact selected representation
served by that service. Durable compare-and-swap still requires authenticated,
atomic `If-Match` enforcement in the same transaction that writes the durable
representation. A browser-generated content revision must never substitute for
a server-selected validator when the selected representation or authorization
boundary differs.

## Security and privacy analysis

### Content minimization

The transition result intentionally omits envelopes and every document-bearing
field. It has no `documentJson`, text, hyperlink, alternative-text, inline-image,
extension-attribute, actor, tenant, prompt, model, credential, or transport
field. Tests recursively inspect public keys and realistic confidential fixture
text to prevent accidental content reintroduction.

Revision values may still be tenant-confidential metadata. Equality can reveal
that two parties or events refer to the same canonical content. Hosts must apply
appropriate tenant authorization, retention, logging, and disclosure policy and
must not expose revisions as bearer credentials or public object identifiers.

### Parse-before-hash

Both sources must validate before the first digest call. Invalid resulting input
therefore produces no partial previous-side evidence and cannot cause a host to
record an apparently complete transition. Successful calls invoke the provider
exactly twice in documented order. Provider failures retain the existing typed,
bounded revision error and return no partial object.

### No occurrence fabrication

The API performs no editor transaction, network request, database write, queue
publication, clock read, identity lookup, authorization check, signature, or
model invocation. A successful return means only that two supplied envelopes
were valid and their canonical SHA-256 revisions were derived. It does not make
a local operation shareable or audit-grade by itself.

### Algorithm basis and lifecycle

The revision contract uses SHA-256 as specified by FIPS PUB 180-4. NIST has
announced that FIPS 180-4 will be revised. Its current Hash Functions project
still lists SHA-256 in the approved SHA-2 family, the NIST Policy on Hash
Functions permits SHA-2 for applications that employ secure hash algorithms and
encourages SHA-256 at minimum for interoperability, and the Cryptographic
Algorithm Validation Program continues SHA2-256 validation testing. Inkspan
keeps the algorithm literal and schema version explicit so a future
standards-driven migration can add a new contract rather than silently changing
existing revision semantics.

## Framework-independent and MSA boundary

The `/revision-evidence` subpath bundles the transition implementation with the
existing envelope parser, canonical serializer, and revision contract. It does
not load React, React DOM, TipTap, ProseMirror, Yjs, a transport client, database
adapter, credential, provider SDK, scheduler, or environment configuration.
Packed-artifact tests execute ESM and CommonJS consumers and compile strict
TypeScript with `lib: ['ES2022']` and no DOM or framework types.

Inkspan remains usable alone. In CWL composition, naruon or another host may
place the result in an authenticated workflow or audit event, while
contextual-orchestrator remains responsible only for host-approved model routing
and execution policy. `ContextualWisdomLab/.github` supplies reusable CI,
security, provenance, and release controls but does not become a runtime data
owner.

No database object is introduced. A future host persistence schema must use at
least two descriptive words and `snake_case` by default, or valid
CamelCase/PascalCase where required by an ecosystem convention.

## Alternatives rejected

### Return full previous and resulting envelopes

Rejected because it duplicates private document bodies in a surface intended
for compact lineage metadata. Full envelopes remain available at explicit
restore or conflict boundaries where the host needs compare, merge, fork, or
recovery behavior.

### Accept precomputed revision strings

Rejected because the API could no longer prove that each revision came from the
exact validated source supplied to that call. Reusing the existing validated-
envelope helper preserves one authoritative canonicalization and digest
contract.

### Hash both documents concurrently

Rejected because concurrency would impose undocumented re-entrancy and ordering
requirements on injected providers. Two sequential calls are deterministic and
negligible relative to document parsing, canonicalization, and host persistence.

### Add actor, tenant, operation, or timestamp fields

Rejected because Inkspan cannot authenticate those facts. Accepting arbitrary
caller strings would create a structurally persuasive but unauthenticated audit
event. Occurrence provenance belongs to the host transaction and identity
boundary.

### Call the result an audit record or signature

Rejected because SHA-256 revisions do not establish identity, authorization,
intent, time, durable acceptance, or non-repudiation. The public name and docs
use “transition evidence” and “content-lineage evidence” with explicit limits.

## Verification evidence

The test suite requires:

- known SHA-256 revisions for realistic before-and-after documents;
- changed and unchanged classifications;
- object/JSON and strict UTF-8 parity;
- validation of both sources before any digest invocation;
- exactly two non-overlapping digest calls in previous-then-resulting order;
- frozen top-level and nested revision objects;
- recursive absence of document-bearing fields and fixture text;
- matching root and framework-independent subpath exports;
- dependency-free packed ESM and CommonJS execution;
- strict TypeScript declaration consumption without DOM or framework types; and
- 100% production statement, branch, function, and line coverage.

Exact-head CI, Office Python 3.11/3.14 coverage and docstrings, SAST, Security
Scan, package verification, review findings, branch protection, independent
non-author approval, and release acceptance remain mandatory. A passing local
lineage test is not release or acquisition evidence by itself.

## Failure, rollback, and compatibility

Invalid inputs, unsupported versions, resource-limit violations, malformed
UTF-8, duplicate object names, invalid digest outputs, and provider failures
reject without returning partial transition evidence. The API mutates no source,
editor, provider, transport, or persistent state.

Rollback removes the transition constants, type, functions, tests, and docs.
Existing envelope, revision-evidence, guarded-restore, autosave, collaboration,
editor, converter, and Office APIs remain source-compatible. No migration,
database rollback, credential rotation, or persistent-data rewrite is required.

## Release decision

This feature may merge only when the exact current head passes all repository
and inherited required checks, exposes zero valid unresolved findings, and has a
qualifying independent non-author approval. It does not independently justify a
version bump or publication. Versioning and release remain a separate protected
acceptance decision after integration.

## References (APA 7th edition)

Fielding, R., Nottingham, M., & Reschke, J. (2022). *HTTP semantics* (RFC
9110). RFC Editor. https://doi.org/10.17487/RFC9110

Moreau, L., & Missier, P. (Eds.). (2013). *PROV-DM: The PROV data model* (W3C
Recommendation). World Wide Web Consortium.
https://www.w3.org/TR/2013/REC-prov-dm-20130430/

National Institute of Standards and Technology. (2015). *Secure Hash Standard
(SHS)* (FIPS PUB 180-4). U.S. Department of Commerce.
https://doi.org/10.6028/NIST.FIPS.180-4

National Institute of Standards and Technology. (2023, March 7). *Decision to
revise FIPS 180-4, Secure Hash Standard*. U.S. Department of Commerce.
https://csrc.nist.gov/News/2023/decision-to-revise-fips-180-4

National Institute of Standards and Technology. (n.d.). *Cryptographic
Algorithm Validation Program: Secure hashing*. U.S. Department of Commerce.
Retrieved August 7, 2026, from
https://csrc.nist.gov/projects/cryptographic-algorithm-validation-program/secure-hashing

National Institute of Standards and Technology. (n.d.). *Hash functions*. U.S.
Department of Commerce. Retrieved August 7, 2026, from
https://csrc.nist.gov/projects/hash-functions

National Institute of Standards and Technology. (2022, December 15). *NIST
Policy on Hash Functions*. U.S. Department of Commerce.
https://csrc.nist.gov/projects/hash-functions/nist-policy-on-hash-functions

Rundgren, A., Jordan, B., & Erdtman, S. (2020). *JSON Canonicalization Scheme
(JCS)* (RFC 8785). RFC Editor. https://doi.org/10.17487/RFC8785

World Wide Web Consortium. (2013). *PROV overview*.
https://www.w3.org/TR/2013/NOTE-prov-overview-20130430/
