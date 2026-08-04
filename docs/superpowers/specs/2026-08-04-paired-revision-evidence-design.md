# Paired Revision Evidence Design

**Date:** 2026-08-04  
**Target release:** Inkspan 0.5.25

## Objective

Close the remaining time-of-check/time-of-use gap at the start of optimistic-concurrency workflows. Inkspan can currently export a frozen document envelope and independently derive a strong revision validator, but a host that calls `getDocumentEnvelope()` and `getDocumentEnvelopeRevision()` separately can observe different editor revisions. The same host can also parse or clone a pure envelope twice merely to retain the payload that was hashed.

Inkspan will provide one operation that returns the exact deeply frozen envelope together with the SHA-256 strong validator derived from that same object. The pair is suitable for autosave requests, delayed AI operations, compare/merge/fork workflows, audit records, and RFC 9110 `If-Match` preparation without a second editor read or a second envelope parse.

## Selected approach

Add a frozen evidence type and paired object/JSON, strict UTF-8 byte, and imperative editor-handle APIs:

```ts
export interface CwlEditorDocumentRevisionEvidence {
  /** Exact frozen envelope whose canonical bytes were hashed. */
  readonly envelope: CwlEditorDocumentEnvelope;
  /** SHA-256 strong validator derived from `envelope`. */
  readonly revision: CwlEditorDocumentRevision;
}

export function createDocumentEnvelopeRevisionEvidence(
  source: unknown,
  limits?: DocumentEnvelopeLimits,
  digestProvider?: DocumentEnvelopeDigestProvider | null,
): Promise<CwlEditorDocumentRevisionEvidence>;

export function createDocumentEnvelopeRevisionEvidenceBytes(
  source: unknown,
  limits?: DocumentEnvelopeLimits,
  digestProvider?: DocumentEnvelopeDigestProvider | null,
): Promise<CwlEditorDocumentRevisionEvidence>;

CwlEditorHandle.getDocumentEnvelopeRevisionEvidence(
  limits?: DocumentEnvelopeLimits,
  digestProvider?: DocumentEnvelopeDigestProvider | null,
): Promise<CwlEditorDocumentRevisionEvidence | null>;
```

The existing `createDocumentEnvelopeRevision()`, `createDocumentEnvelopeRevisionBytes()`, and `getDocumentEnvelopeRevision()` methods remain source-compatible. They delegate to the paired path and return only `evidence.revision`.

## Alternatives considered

### Host-side object assembly

A host could call the existing envelope and revision APIs and combine their results. This was rejected because imperative calls can observe different editor documents and pure calls duplicate parsing or validation work.

### Add the envelope to `CwlEditorDocumentRevision`

Embedding the full document inside the revision object was rejected because a validator should remain a compact identifier suitable for headers, metadata, and comparison. It would also silently expand logging and telemetry payloads that currently contain only non-content revision fields.

### Return canonical JSON or bytes beside the revision

Returning serialized data was rejected because the frozen envelope is the reusable source of truth and callers can derive canonical JSON or bytes only when needed. Eager serialization would add allocation to every evidence capture.

## Data flow

1. Parse an object/JSON source or strict UTF-8 byte source through the existing versioned envelope boundary.
2. Retain the returned deeply frozen envelope object.
3. Canonicalize that exact envelope under RFC 8785.
4. Hash the canonical UTF-8 bytes through the existing Web Cryptography-compatible SHA-256 provider boundary.
5. Freeze and return `{ envelope, revision }`.
6. Existing revision-only functions return `evidence.revision` without reparsing or rehashing.
7. The imperative handle captures `editor.getJSON()` once, creates one envelope, and delegates to the validated paired helper. Before creation or after destruction it resolves to `null` without invoking the digest provider.

The `revision` and `envelope` properties therefore always describe the same validated payload.

## Error behavior

- Malformed JSON, duplicate names, unsupported versions, invalid UTF-8, resource-limit violations, canonicalization failures, unavailable digest providers, rejected digest operations, and invalid provider results retain the existing typed redacted errors.
- No partially populated evidence object is returned.
- A digest failure does not expose source document content or provider exception details.
- The imperative pre-creation fallback is `null`, matching existing revision export behavior.

## Security and privacy

The evidence envelope contains the complete client-controlled document, including text, safe links, inline image payloads, alternative text, and extension attributes. The evidence object is not safe for ordinary logs, metrics labels, analytics events, URLs, exception messages, or compact revision metadata.

The strong entity tag is an equality validator, not a signature, authorization token, tenant identifier, or proof of durable persistence. CWL and naruon hosts retain authenticated transport, tenant isolation, server-side atomic RFC 9110 `If-Match`, encryption, retention, redaction, regional-residency, and audit policy.

## Performance

Each paired call performs one envelope parse or editor snapshot, one canonical serialization, and one SHA-256 digest. It reuses the already-validated frozen envelope in the result. No second document clone, parse, canonicalization, digest, schema reconstruction, provider call, or editor read is permitted.

## Public documentation

Update README, the document revision guide, imperative persistence guide, package description, strict package-consumer verification, and CHANGELOG. Examples must demonstrate that callers retain the pair and send `evidence.revision.strongEntityTag` only as the compact validator while protecting `evidence.envelope` as document content.

## Verification

Tests must demonstrate:

- object/JSON evidence returns the exact frozen parsed envelope and matching frozen revision;
- strict UTF-8 evidence normalizes noncanonical valid bytes before hashing and returns the parsed frozen envelope;
- existing revision-only APIs delegate without an extra digest;
- imperative capture reads the editor document once and returns a matching pair;
- imperative pre-creation capture resolves to `null` without invoking the provider;
- packed ESM, CommonJS, and strict declaration consumers expose the new functions, type, and handle method;
- repository-wide TypeScript statement, branch, function, and line coverage remains 100%;
- Office Python 3.11 and 3.14 branch and docstring coverage gates remain 100%;
- SAST, Security Scan, CodeRabbit, exact-head, and unresolved-review-thread gates pass.

## Standards and primary documentation

- RFC 8785, JSON Canonicalization Scheme, for stable hashable JSON bytes.
- RFC 9110 §§8.8 and 13.1.1, strong entity tags and `If-Match` lost-update prevention.
- W3C Web Cryptography Level 2, `SubtleCrypto.digest()` and the recognized `SHA-256` algorithm.
- TipTap editor API, `editor.getJSON()` for one current document snapshot.
