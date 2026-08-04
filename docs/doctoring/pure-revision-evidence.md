# Doctoring record: Pure document revision evidence

**Date:** 2026-08-04  
**Target release:** Inkspan 0.5.26  
**Decision owner:** ContextualWisdomLab  
**Scope:** Framework-independent revision-envelope evidence for object/JSON, strict UTF-8, standalone editor, provider-neutral collaborative editor, server, worker, migration, queue, and storage consumers.

## Product problem

A durable document workflow often needs both a normalized versioned envelope and the exact validator derived from that payload. Before this change, a server, worker, migration job, queue consumer, or storage adapter could parse an envelope and derive a revision in two separate calls. Mutable input, inconsistent normalization, or an intervening read could then associate the returned validator with the wrong document.

The first implementation exported pure evidence only from Inkspan's root editor entrypoint. Although the pure functions themselves did not use React or TipTap, a server or worker import still evaluated the root package graph and its editor dependencies. That contradicted the claimed framework-independent MSA boundary and made deployment evidence dependent on a full editor dependency installation.

Inkspan 0.5.26 therefore introduces pure object/JSON and strict UTF-8 functions that return one frozen `{ envelope, revision }` value and publishes them through `@contextualwisdomlab/cwl-editor/revision-evidence`. The root exports remain for compatibility. The imperative standalone and Yjs-backed editor handle uses the same pairing helper. This closes the client- and process-local time-of-check/time-of-use gap without transferring transport, database, authorization, tenant, or provider ownership into Inkspan.

## Selected design

The shared implementation performs the following bounded sequence:

1. Parse the source through Inkspan's existing versioned-envelope boundary.
2. Reject malformed JSON, duplicate object names, invalid UTF-8, unsupported schema identifiers or versions, hostile values, resource-limit violations, and noncanonicalizable values using existing typed redacted errors.
3. Retain the exact detached, deeply frozen normalized envelope returned by that parser.
4. Serialize that envelope as RFC 8785 canonical JSON encoded as UTF-8.
5. Derive one SHA-256 revision through the Web Cryptography-compatible digest-provider contract.
6. Return a shallow-frozen evidence object containing the frozen envelope and frozen revision.

The standalone entrypoint wraps that implementation with explicit Inkspan-owned recursive JSON, envelope, limit, digest-provider, revision, evidence, and error declarations. Its ESM and CommonJS artifacts bundle only strict parsing, canonicalization, and SHA-256 orchestration. Runtime error constructors are shared with the root package so `instanceof` remains stable, while public declarations avoid React and TipTap types.

Object/JSON and strict UTF-8 evidence creation each parse once and invoke the digest provider once. The package does not add a second document traversal, second parser pass, second digest, network call, database dependency, credential, or environment-variable contract.

## Standards interpretation

### JSON interchange and canonicalization

RFC 8259 defines JSON interchange and requires UTF-8 for interoperable exchange outside closed ecosystems. Inkspan's byte path uses strict UTF-8 decoding and rejects malformed sequences and byte-order marks rather than repairing them. Duplicate member names are rejected before native parsing because RFC 8259 notes that behavior with duplicate names is unpredictable across implementations.

RFC 8785 defines the JSON Canonicalization Scheme. Inkspan applies deterministic object-member ordering, ECMAScript-compatible primitive serialization, no insignificant whitespace, and strict Unicode handling before hashing. Verified RFC 8785 erratum 7920 is applied: negative zero is rejected because ECMAScript serialization would otherwise collapse `-0` and `0` to the same canonical representation.

### Hash and runtime API

SHA-256 remains specified by the current final FIPS PUB 180-4. NIST has announced a future revision, but the product does not claim conformance to an unpublished successor.

The stable runtime API basis is the 2017 W3C Web Cryptography API Recommendation and its `SubtleCrypto.digest()` contract. Web Cryptography Level 2 was a First Public Working Draft as of 2026-08-04. Inkspan tracks it as work in progress and does not claim Level 2 conformance.

The root editor contract accepts Web Cryptography's `BufferSource`. The standalone declaration exposes the structurally equivalent union of `ArrayBuffer` and `ArrayBufferView`, avoiding a framework declaration dependency while retaining byte-address semantics. Inkspan does not fall back to SHA-1 or a non-cryptographic checksum. A fixed canonical-envelope vector is verified with Node's native SHA-256 implementation and a precomputed expected digest, in addition to injected-provider boundary tests.

### HTTP optimistic concurrency

RFC 9110 defines entity tags and requires strong comparison for `If-Match`. Inkspan's quoted `sha256-<hex>` value is suitable as an equality validator for the exact canonical envelope representation. A host may expose it as an HTTP `ETag` only when it represents the actual selected representation.

The durable service must compare the expected validator and perform the mutation atomically in the same storage transaction. A mismatch must leave durable content unchanged and normally produce `412 Precondition Failed`. The validator is not authorization, tenant membership, a signature, a bearer token, or proof that a prior write was committed.

## Realistic verification evidence

The release candidate includes tests for:

- object/JSON evidence from reordered but equivalent input;
- strict UTF-8 evidence from valid noncanonical whitespace and property ordering;
- exact pairing between the returned normalized envelope and revision;
- one digest-provider call per operation;
- deep and shallow freezing guarantees;
- a fixed real SHA-256 known-answer vector over canonical envelope bytes;
- standalone and provider-neutral Yjs imperative evidence capture;
- asynchronous editor movement and destruction;
- exact error-constructor identity between root and standalone entrypoints;
- existing malformed, duplicate-name, resource-limit, UTF-8, canonicalization, and digest-provider failure categories;
- dedicated bundled ESM and CommonJS `revision-evidence` artifacts;
- an exact npm tarball extracted under an operating-system temporary consumer outside the repository tree without installing React, TipTap, or the package's dependency closure;
- ESM, CommonJS, and strict TypeScript execution against that extracted standalone subpath rather than the repository's package self-reference;
- explicit rejection of repository-ancestor module fallback and accidental framework declaration references;
- repository-wide 100% TypeScript statement, branch, function, and line coverage;
- Office Python 3.11 and 3.14 100% production branch and shipped-symbol docstring coverage.

GitHub CI, SAST Semgrep, Security Scan, CodeRabbit, unresolved-review-thread, package, demo, and Office gates remain exact-head merge prerequisites.

## Security, privacy, and MSA boundary

A revision-evidence envelope contains the complete client-controlled document: author text, accepted hyperlinks, alternative text, inline base64 image payloads, and extension attributes. Evidence objects must not be copied to ordinary logs, metric labels, analytics events, public URLs, exception messages, or compact revision metadata. Hosts must apply the same authorization, tenant isolation, purpose limitation, encryption, regional-residency, retention, redaction, and audit controls used for persisted documents.

Inkspan owns strict parsing, normalization, canonicalization, local SHA-256 derivation, frozen evidence pairing, editor integration, deterministic conversion surfaces, and deterministic package entrypoints. ContextualWisdomLab and naruon hosts own authenticated transport, descriptive nonnumeric document and tenant identifiers, atomic durable compare-and-swap, persistence, migration routing, encryption and signing, key management, retention, audit, retry policy, conflict UX, and model-use policy.

The standalone subpath is a dependency and deployment boundary, not an authorization or sandbox boundary. It prevents pure service code from loading unnecessary editor frameworks, but it cannot establish tenant isolation, persistence atomicity, authenticity, retention, or credential policy.

No database object is introduced by this change. Future host persistence objects must contain at least two descriptive words and use `snake_case` by default, or valid CamelCase/PascalCase where ecosystem conventions require it.

## Alternatives rejected

### Keep pure functions only on the root entrypoint

Rejected after review because Node and worker consumers would still traverse the React/TipTap editor package graph. Function-level purity is insufficient when the published package boundary evaluates unrelated runtime dependencies.

### Install the full dependency closure in the package verifier

Rejected as the final standalone proof because a dependency installation can conceal accidental React or TipTap imports. The stronger gate extracts only the exact tarball, leaves framework dependencies absent, and then runs the dedicated runtime and declaration surfaces.

### Return only canonical bytes

Rejected because most consumers need the normalized structured envelope for storage, migration, comparison, or editor restoration. Returning only bytes would force an additional parse and recreate pairing risk.

### Return only a digest

Rejected because it preserves the existing need for a separate document read and cannot prove which normalized payload was hashed inside the process.

### Add transport or database adapters to Inkspan

Rejected because it would break standalone operation, couple the editor to deployment-specific authorization and persistence choices, and weaken modular MSA reuse across CWL and naruon.

### Eagerly sign the evidence

Rejected because signature policy requires host-owned identities, keys, rotation, trust anchors, tenant scope, algorithm policy, and audit. SHA-256 evidence is deliberately an equality observation, not an authenticity claim.

## Release decision

Inkspan 0.5.26 may merge only when the exact current head passes all required CI, coverage, package-consumer, Office, SAST, security, review, and unresolved-thread gates. Source merge and package verification do not by themselves prove that a Git tag, immutable GitHub Release, npm publication, or PyPI publication occurred; those distribution events require separate release-pipeline evidence.

## References (APA 7th edition)

Bray, T. (2017). *The JavaScript Object Notation (JSON) data interchange format* (RFC 8259). RFC Editor. https://doi.org/10.17487/RFC8259

Fielding, R., Nottingham, M., & Reschke, J. (2022). *HTTP semantics* (RFC 9110). RFC Editor. https://doi.org/10.17487/RFC9110

National Institute of Standards and Technology. (2015). *Secure Hash Standard (SHS)* (FIPS PUB 180-4). U.S. Department of Commerce. https://doi.org/10.6028/NIST.FIPS.180-4

Node.js. (2026). *Modules: Packages*. Retrieved August 4, 2026, from https://nodejs.org/api/packages.html

npm, Inc. (2026). *npm pack*. Retrieved August 4, 2026, from https://docs.npmjs.com/cli/v11/commands/npm-pack

RFC Editor. (2024). *Errata ID 7920 for RFC 8785: Reject negative zero*. https://www.rfc-editor.org/errata/eid7920

Rundgren, A., Jordan, B., & Erdtman, S. (2020). *JSON Canonicalization Scheme (JCS)* (RFC 8785). RFC Editor. https://doi.org/10.17487/RFC8785

WHATWG. (n.d.). *Encoding Standard*. Retrieved August 4, 2026, from https://encoding.spec.whatwg.org/

World Wide Web Consortium. (2017). *Web Cryptography API* (W3C Recommendation). https://www.w3.org/TR/2017/REC-WebCryptoAPI-20170126/

World Wide Web Consortium. (2025). *Web Cryptography Level 2* (First Public Working Draft). https://www.w3.org/TR/2025/WD-webcrypto-2-20250422/
