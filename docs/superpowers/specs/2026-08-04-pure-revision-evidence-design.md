# Pure Document Revision Evidence Design

**Date:** 2026-08-04  
**Target release:** Inkspan 0.5.26

## Objective

Inkspan 0.5.25 can atomically capture a current editor envelope and its matching SHA-256 revision through `CwlEditorHandle`. Framework-independent persistence, migration, server, worker, and queue consumers still have to parse an object/JSON or strict UTF-8 source separately from revision generation when they need to retain the exact normalized payload that was hashed.

Add pure functions that return a frozen revision-envelope evidence contract from object/JSON and strict UTF-8 inputs. Publish those functions through an explicit framework-free package subpath while preserving the root exports for compatibility. This completes one provider-neutral evidence capability across React editors, Node/server code, workers, storage adapters, migration jobs, CWL infrastructure, and naruon modules without making non-editor consumers evaluate the editor dependency graph.

## Public API

Root compatibility surface:

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

Preferred pure-consumer surface:

```ts
import {
  createDocumentEnvelopeRevisionEvidence,
  createDocumentEnvelopeRevisionEvidenceBytes,
} from '@contextualwisdomlab/cwl-editor/revision-evidence';
```

The dedicated subpath exposes Inkspan-owned recursive JSON, envelope, limit,
digest-provider, revision, evidence, and redacted error contracts. Existing
revision-only and imperative APIs remain source-compatible.

## Architecture

Implement pure evidence creation in `documentRevisionEvidence.ts` and reuse it
from both the root editor surface and a dedicated `revision-evidence` facade:

1. Parse object/JSON through `parseDocumentEnvelope()` or bytes through `parseDocumentEnvelopeBytes()`.
2. Retain the exact deeply frozen normalized envelope returned by that boundary.
3. Derive its revision through the existing package-internal `createValidatedDocumentEnvelopeRevision()` helper.
4. Freeze and return `{ envelope, revision }`.
5. Expose a package-internal validated-envelope helper so the imperative handle uses the same pairing implementation and no longer carries a local duplicate helper.
6. Add `src/revision-evidence/index.ts` with explicit provider-neutral declarations and wrappers around the shared runtime implementation.
7. Bundle that entry as ESM and CommonJS without externalizing React, TipTap, ProseMirror, Yjs, or host libraries. The pure internal type-only TipTap reference is erased before bundling.
8. Publish `./revision-evidence` through package exports while retaining root exports for compatibility.

The facade uses explicit local public signatures, so declaration emission does
not pull the root editor's React or TipTap types into server and worker projects.
Runtime error constructors are aliased with explicit standalone constructor
contracts, preserving exact `instanceof` identity across the root and pure
entrypoints without leaking framework declarations.

## Invariants

- `revision` is derived from the exact returned `envelope`.
- The evidence object, envelope, nested document JSON, and revision are frozen.
- Object/JSON and strict UTF-8 sources are parsed once.
- Noncanonical valid bytes are normalized before hashing.
- One digest-provider call is made per evidence operation.
- Existing duplicate-name, strict UTF-8, resource-limit, canonicalization, provider-brand, and redacted-error guarantees remain authoritative.
- The imperative path continues to read the editor once and uses the shared validated-envelope helper.
- The `revision-evidence` runtime and declarations load with only the packed package present; no React, TipTap, ProseMirror, Yjs, transport, persistence, database, credential, or environment-variable dependency is required.
- The root package remains the editor surface; the new subpath is the preferred MSA/server/worker boundary.

## Security and privacy

Evidence envelopes contain complete client-controlled documents, including text, accepted links, inline image payloads, alternative text, and extension attributes. They must not be placed in ordinary logs, metric labels, analytics events, exception messages, public URLs, or compact revision metadata.

The revision is an equality validator, not a signature, authorization token, tenant identifier, or durable-commit receipt. CWL and naruon hosts retain authenticated atomic RFC 9110 `If-Match`, tenant isolation, encryption, signing, retention, regional residency, redaction, audit, and retry policy.

The standalone build is not a privilege boundary. It removes unnecessary editor
runtime coupling and accidental browser initialization from service code, but
hosts still own authorization, credentials, tenancy, persistence, migration,
retention, and model-use policy.

## Standards basis

The stable normative basis is RFC 8785 for canonical JSON, RFC 9110 for strong validators and `If-Match`, RFC 8259 plus the WHATWG Encoding Standard for UTF-8 JSON interchange, the 2017 W3C Web Cryptography API Recommendation for `SubtleCrypto.digest()`, and FIPS PUB 180-4 for SHA-256. Verified RFC 8785 erratum 7920 is applied to reject negative zero before canonicalization.

Web Cryptography Level 2 was a First Public Working Draft as of 2026-08-04. It is tracked as work in progress and is not used as the product's conformance claim. NIST has announced a future revision of FIPS PUB 180-4, but FIPS PUB 180-4 remains the current final Secure Hash Standard for SHA-256.

## Verification

- Object/JSON evidence returns the exact frozen parsed envelope and matching revision.
- Strict UTF-8 evidence normalizes valid noncanonical bytes and returns the normalized frozen envelope.
- Each path invokes the digest provider exactly once.
- A fixed canonical-envelope vector is checked against a real SHA-256 implementation and a precomputed digest.
- Invalid source, byte, resource, canonicalization, and provider paths retain existing typed redacted failures through composition.
- Imperative evidence continues to pass asynchronous movement and lifecycle tests through the shared helper.
- The package manifest contains ESM, CommonJS, and declaration targets for `./revision-evidence`.
- The exact npm tarball is extracted under an operating-system temporary consumer outside the repository, with no dependency installation and no repository-ancestor module fallback.
- Packed ESM and CommonJS consumers execute real object and byte evidence calls while React and TipTap are absent.
- A strict TypeScript consumer compiles against the packed standalone declarations without React, TipTap, or editor declaration packages.
- TypeScript production coverage remains 100%; Office Python 3.11/3.14 branch and shipped-symbol docstring coverage remain 100%.
- SAST, Security Scan, CodeRabbit, exact-head, and unresolved-review-thread gates pass.

## References (APA 7th edition)

Bray, T. (2017). *The JavaScript Object Notation (JSON) data interchange format*
(RFC 8259). RFC Editor. https://doi.org/10.17487/RFC8259

Fielding, R., Nottingham, M., & Reschke, J. (2022). *HTTP semantics* (RFC
9110). RFC Editor. https://doi.org/10.17487/RFC9110

National Institute of Standards and Technology. (2015). *Secure Hash Standard
(SHS)* (FIPS PUB 180-4). U.S. Department of Commerce.
https://doi.org/10.6028/NIST.FIPS.180-4

RFC Editor. (2024). *Errata ID 7920 for RFC 8785: Reject negative zero*.
https://www.rfc-editor.org/errata/eid7920

Rundgren, A., Jordan, B., & Erdtman, S. (2020). *JSON Canonicalization Scheme
(JCS)* (RFC 8785). RFC Editor. https://doi.org/10.17487/RFC8785

WHATWG. (n.d.). *Encoding Standard*. Retrieved August 4, 2026, from
https://encoding.spec.whatwg.org/

World Wide Web Consortium. (2017). *Web Cryptography API* (W3C
Recommendation). https://www.w3.org/TR/2017/REC-WebCryptoAPI-20170126/

World Wide Web Consortium. (2025). *Web Cryptography Level 2* (First Public
Working Draft). https://www.w3.org/TR/2025/WD-webcrypto-2-20250422/
