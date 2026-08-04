# Pure Document Revision Evidence Design

**Date:** 2026-08-04  
**Target release:** Inkspan 0.5.26

## Objective

Inkspan 0.5.25 can atomically capture a current editor envelope and its matching SHA-256 revision through `CwlEditorHandle`. Framework-independent persistence, migration, server, worker, and queue consumers still have to parse an object/JSON or strict UTF-8 source separately from revision generation when they need to retain the exact normalized payload that was hashed.

Add pure functions that return the existing frozen `CwlEditorDocumentRevisionEvidence` contract from object/JSON and strict UTF-8 inputs. This completes one provider-neutral evidence surface across React editors, Node/server code, workers, storage adapters, migration jobs, CWL infrastructure, and naruon modules.

## Public API

```ts
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
```

The existing `CwlEditorDocumentRevisionEvidence` type remains the shared contract. Existing revision-only and imperative APIs remain source-compatible.

## Architecture

Implement pure evidence creation in `documentRevisionEvidence.ts`, beside the public evidence contract and imperative handle augmentation:

1. Parse object/JSON through `parseDocumentEnvelope()` or bytes through `parseDocumentEnvelopeBytes()`.
2. Retain the exact deeply frozen normalized envelope returned by that boundary.
3. Derive its revision through the existing package-internal `createValidatedDocumentEnvelopeRevision()` helper.
4. Freeze and return `{ envelope, revision }`.
5. Expose a package-internal validated-envelope helper so the imperative handle uses the same pairing implementation and no longer carries a local duplicate helper.

This avoids circular imports: revision generation remains in `documentEnvelopeRevision.ts`; evidence creation depends on it, not vice versa.

## Invariants

- `revision` is derived from the exact returned `envelope`.
- The evidence object, envelope, nested document JSON, and revision are frozen.
- Object/JSON and strict UTF-8 sources are parsed once.
- Noncanonical valid bytes are normalized before hashing.
- One digest-provider call is made per evidence operation.
- Existing duplicate-name, strict UTF-8, resource-limit, canonicalization, provider-brand, and redacted-error guarantees remain authoritative.
- The imperative path continues to read the editor once and uses the shared validated-envelope helper.
- No React, TipTap, transport, persistence, database, credential, or environment-variable dependency is added to pure consumers.

## Security and privacy

Evidence envelopes contain complete client-controlled documents, including text, accepted links, inline image payloads, alternative text, and extension attributes. They must not be placed in ordinary logs, metric labels, analytics events, exception messages, public URLs, or compact revision metadata.

The revision is an equality validator, not a signature, authorization token, tenant identifier, or durable-commit receipt. CWL and naruon hosts retain authenticated atomic RFC 9110 `If-Match`, tenant isolation, encryption, signing, retention, regional residency, redaction, audit, and retry policy.

## Standards basis

- RFC 8785, JSON Canonicalization Scheme, for deterministic hashable JSON bytes.
- RFC 9110 §§8.8 and 13.1.1, strong entity tags and lost-update prevention through `If-Match`.
- W3C Web Cryptography Level 2, `SubtleCrypto.digest()` with `SHA-256`.
- WHATWG Encoding Standard and RFC 8259 for strict UTF-8 JSON interchange.

## Verification

- Object/JSON evidence returns the exact frozen parsed envelope and matching revision.
- Strict UTF-8 evidence normalizes valid noncanonical bytes and returns the normalized frozen envelope.
- Each path invokes the digest provider exactly once.
- Invalid source, byte, resource, canonicalization, and provider paths retain existing typed redacted failures through composition.
- Imperative evidence continues to pass asynchronous movement and lifecycle tests through the shared helper.
- Packed ESM, CommonJS, and strict TypeScript consumers expose both pure functions and the evidence type.
- TypeScript production coverage remains 100%; Office Python 3.11/3.14 branch and shipped-symbol docstring coverage remain 100%.
- SAST, Security Scan, CodeRabbit, exact-head, and unresolved-review-thread gates pass.
