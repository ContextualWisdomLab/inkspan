# Envelope identity-only migration routing

Status: Implemented on active PR
Decision: ADR 0015
Tracking: Issue #74

## Problem boundary

Inkspan's strict `parseDocumentEnvelope()` correctly rejects unknown schema identifiers and versions. That protects current document semantics, but a host still needs a safe way to determine which version-specific migration should receive a complete legacy or future envelope. Asking every host to parse untrusted envelope JSON independently would duplicate duplicate-name, UTF-8, resource-limit, accessor, proxy/reflection, and error-redaction policy at the compatibility boundary.

## Implemented decision

The active implementation adds `inspectDocumentEnvelopeIdentity()` and `inspectDocumentEnvelopeIdentityBytes()` plus the framework-independent `@contextualwisdomlab/cwl-editor/envelope-identity` package subpath. Successful inspection returns only a frozen `schemaId` string and positive safe-integer `schemaVersion`.

Inspection requires a complete syntactically valid envelope with `schemaId`, `schemaVersion`, and `documentJson`. It applies the established byte, text, value-count, string-length, nesting, duplicate-name, strict UTF-8, BOM, plain-object, dense-array, descriptor, accessor, proxy/reflection, and public-error boundaries where applicable. It deliberately does **not** require an unsupported `documentJson` to satisfy the current TipTap/ProseMirror schema before returning routing metadata.

`parseDocumentEnvelope()` remains strict and current-schema-only. The host owns migration selection and execution, schema registry, authorization, tenant isolation, persistence transaction, encryption, retention, durable audit, rollback, and recovery. A migrated value must pass the ordinary current-schema parser before it becomes canonical Inkspan document state.

## Security and privacy

The identity result contains no document body, selected text, links, inline image data, source-controlled future fields, actor, tenant, credential, transport state, signature, authorization decision, migration-success claim, or durable-write claim. Schema identity can still be application metadata and should remain purpose-bound rather than a public high-cardinality telemetry label.

Direct JavaScript objects are inspected through descriptors without invoking getters. Hostile proxy/reflection failures and unexpected internal inspection failures are converted to stable `DocumentEnvelopeError` messages that do not echo source strings or private exception causes. Byte inspection copies bounded `Uint8Array` input, rejects a leading UTF-8 BOM, and uses fatal UTF-8 decoding.

## Failure and recovery

Malformed JSON/UTF-8, duplicate object names, missing required envelope members, invalid identity scalar types, non-positive/unsafe versions, non-JSON body values, cycles, sparse/decorated/accessor arrays, accessors or symbols, hostile reflection, and resource-limit violations fail closed without partial identity output. An unknown but structurally valid identity is a routing result rather than proof that Inkspan understands or can migrate that document version.

If the host has no matching migration, it preserves the original source unchanged and reports an unsupported version. Migration failure does not authorize retry through the strict current parser or mutate the original source.

## Compatibility and packaging

The API is additive. Existing create/parse/encode/revision/restore behavior is unchanged. The dedicated `envelope-identity` subpath is built and consumed through ESM, CommonJS, and strict TypeScript without React, TipTap UI, ProseMirror view, Yjs, DOM globals, network clients, database clients, credentials, or model SDKs.

Rollback before protected integration removes the new entry points/subpath and restores the prior host migration guidance. Any future widening of identity semantics or movement of migration/persistence authority into Inkspan requires explicit versioning and an ADR update or supersession.

## Verification

Acceptance is test-first and requires: current/legacy/future identity routing; proof that the strict parser still rejects unsupported schemas; JSON text and strict UTF-8 bytes including Buffer; duplicate/malformed/BOM input; invalid scalar versions; accessors and hostile proxies; resource ceilings; absence of document-bearing output; root and framework-independent public exports; packed ESM/CommonJS/strict-TypeScript consumers; exact owned production coverage; public docstrings; security scans; zero valid unresolved findings; and live repository policy on the unchanged exact head.

## References

Bray, T. (Ed.). (2015). *The I-JSON Message Format* (RFC 7493). RFC Editor. https://doi.org/10.17487/RFC7493

Bray, T. (Ed.). (2017). *The JavaScript Object Notation (JSON) Data Interchange Format* (RFC 8259; STD 90). RFC Editor. https://doi.org/10.17487/RFC8259

Rundgren, A., Jordan, B., & Erdtman, S. (2020). *JSON Canonicalization Scheme (JCS)* (RFC 8785). RFC Editor. https://doi.org/10.17487/RFC8785
