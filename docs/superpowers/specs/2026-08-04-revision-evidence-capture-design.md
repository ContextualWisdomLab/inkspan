# Atomic revision-envelope evidence capture

**Status:** implemented for Inkspan 0.5.25  
**Scope owner:** Inkspan editor and deterministic conversion surfaces  
**Host owners:** transport, authorization, tenant isolation, persistence,
credentials, migration, retention, audit, and model-use policy

## Problem

Inkspan already exposed a frozen versioned document envelope and a SHA-256
strong revision validator. A host that needed both values for an autosave, AI,
template, semantic-review, or retry operation had to invoke separate methods.
Because digest generation is asynchronous, the editor could change between the
independent reads and the host could associate a revision with a different
document envelope.

That mismatch is commercially material: it can make later compare-and-swap,
conflict display, merge, fork, retry, and audit evidence internally
inconsistent even when each individual value is valid.

## Decision

Add one imperative method shared by standalone and provider-neutral
collaborative editors:

```ts
getDocumentEnvelopeRevisionEvidence(
  limits?: DocumentEnvelopeLimits,
  digestProvider?: DocumentEnvelopeDigestProvider | null,
): Promise<CwlEditorDocumentRevisionEvidence | null>;
```

The method:

1. reads the active ProseMirror document once;
2. creates one detached, deeply frozen versioned envelope under the requested
   resource limits;
3. derives the SHA-256 strong revision from the canonical bytes of that exact
   envelope;
4. returns one frozen `{ envelope, revision }` evidence object; and
5. returns `null` before editor creation or after destruction without invoking
   the digest provider.

It does not reread the editor after hashing begins. A concurrent local edit can
therefore make the returned capture stale for application, but cannot make the
returned pair internally inconsistent.

## Invariants

- `revision` is derived from the exact returned `envelope`.
- The evidence object, envelope, document JSON, and revision are frozen.
- No second editor read, document traversal, clone, parser pass, schema
  reconstruction, or digest-provider call is introduced.
- Existing envelope resource ceilings and canonicalization rules remain
  authoritative.
- Digest failures remain typed and redacted.
- The method is available through the shared `CwlEditorHandle` contract without
  adding transport or persistence dependencies.
- Production statement and branch coverage remains 100%.

## Concurrency boundary

The evidence pair is the base revision of an operation. It is not a promise that
the local editor is still unchanged when hashing finishes. Delayed local
application must use Inkspan's revision-guarded restore APIs. Durable writes
must use authenticated atomic compare-and-swap in host-owned storage, typically
with the strong entity tag as an HTTP `ETag` and `If-Match` precondition.

A server must evaluate the precondition and mutation in one transaction. Local
revision evidence does not replace authorization, tenant checks, durable commit
status, or conflict policy.

## Security and privacy

The envelope can contain the full client-controlled document, accepted links,
inline image payloads, alternative text, and extension attributes. It is not a
telemetry-safe summary. Hosts must apply the same authorization, encryption,
redaction, retention, regional-residency, and audit controls used for persisted
documents.

The SHA-256 revision is an equality validator. It is not a signature, bearer
credential, tenant identifier, authorization decision, or proof of durable
persistence. Inkspan does not own signing keys, transport credentials, tenant
membership, storage transactions, or retention policy.

## Verification

- pre-hydration lifecycle fallback returns `null`;
- a deterministic asynchronous digest is paused after capture;
- the editor is changed while hashing is pending;
- the returned envelope retains the pre-change document;
- the active editor retains the newer document;
- recomputing the revision from the returned envelope yields the returned
  revision;
- all returned evidence is frozen;
- the packed strict TypeScript consumer can import and invoke the public API;
- existing ESM, CommonJS, SSR, collaboration, converter, demo, Office, SAST,
  security, and 100% coverage gates continue to pass.

## Standards basis

- Rundgren, A., Jordan, B., & Erdtman, S. (2020). *JSON Canonicalization Scheme
  (JCS)* (RFC 8785). RFC Editor. https://doi.org/10.17487/RFC8785
- Fielding, R., Nottingham, M., & Reschke, J. (2022). *HTTP semantics* (RFC
  9110), Section 13.1.1. RFC Editor. https://doi.org/10.17487/RFC9110
- World Wide Web Consortium. (2017). *Web Cryptography API*. W3C
  Recommendation. https://www.w3.org/TR/2017/REC-WebCryptoAPI-20170126/
