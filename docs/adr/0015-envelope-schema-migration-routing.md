# ADR 0015: Envelope schema identity and host-owned migration routing

Status: Proposed

## Context

Inkspan's protected implementation uses a strict versioned document envelope so canonical document bytes, revisions, restore behavior, and conversion contracts are not silently reinterpreted. The current parser is intentionally current-schema-only. That protects document semantics, but it also means a host that receives a structurally valid legacy or future envelope cannot use the strict parser merely to learn which migration route should handle it.

Issue #74 tracks a bounded identity-only inspection surface for that gap. The architectural question is whether Inkspan should become a migration engine, relax the current parser, require every host to reimplement hostile-input parsing, or expose only enough validated schema identity to let the host select its own migration.

## Alternatives considered

- Make the current envelope parser permissive for unknown versions. Rejected because identifying a version is not the same as validating that version's document semantics; permissive parsing would weaken the source/revision authority in ADR 0002.
- Require each host to parse untrusted envelope JSON independently before calling Inkspan. Rejected because duplicate-name, strict UTF-8, resource-limit, accessor, descriptor, and redacted-error boundaries would drift across hosts exactly where version routing must be trustworthy.
- Move schema registry, migration execution, persistence transactions, rollback, and audit into Inkspan. Rejected because durable migration is host-owned under ADR 0001 and would couple the standalone editor to application persistence and tenancy.
- Provide a bounded identity-only inspection API while retaining strict current-schema parsing. Selected because it reuses Inkspan's deterministic hostile-input boundary without granting migration or persistence authority.

## Decision

Inkspan may expose a framework-independent identity inspector that returns only a frozen `schemaId` and positive safe-integer `schemaVersion` after bounded structural validation. The inspector is a dispatcher aid, not a document parser or migration engine.

The identity path must share the envelope's existing byte, string, depth, value-count, JSON, duplicate-name, strict UTF-8, BOM, plain-object, descriptor, accessor, proxy/reflection, and redacted-error boundaries where applicable. It may require the complete envelope and the presence of `documentJson` while deliberately avoiding current TipTap/ProseMirror semantic validation of that member before returning routing metadata. It may ignore future fields only when doing so requires no accessor execution and does not weaken complete-input validation.

`parseDocumentEnvelope()` remains strict and current-schema-only. After identity inspection, the host selects and executes any migration, authorizes the operation, chooses schema-registry policy, performs durable persistence, records audit evidence, applies tenant isolation and retention, and decides rollback. A migrated result must re-enter the ordinary strict current-schema validation path before it can become canonical Inkspan document state.

## Consequences

A host can route old or future envelopes without duplicating a second untrusted JSON parser, while Inkspan avoids accepting unknown document semantics. The public API gains one additional versioned evidence/value surface, so package consumers and acquisition reviewers can distinguish schema identification from migration success.

The identity result is intentionally too small to support editing, authorization, durable persistence, or provenance claims. A host that needs richer legacy metadata must obtain it from the version-specific migration component rather than widening this generic inspector.

## Failure and recovery

Malformed JSON or UTF-8, duplicate names, missing identity/body members, invalid scalar types, unsafe version numbers, accessors, hostile proxies, decorated roots, resource-limit violations, or reflection failures fail closed with stable redacted errors. No partial identity is returned.

An unsupported identity is not itself an error if the bounded identity contract is valid; it is a routing result. If no host migration is registered, the host keeps the original source unchanged and reports an unsupported-version outcome. Migration failure does not alter the original envelope and does not permit the current parser to accept the unsupported representation.

## Security and privacy impact

The inspector performs no network, file-system, environment, credential, database, scheduler, model, or collaboration-provider operation. It does not return `documentJson`, document text, links, inline image data, source-controlled property names, tenant identifiers, actor data, credentials, transport state, signatures, or durable-write claims.

Schema identity can still be application metadata, so hosts may classify it as tenant-confidential. Public errors and generic telemetry must not echo arbitrary schema strings or private exception causes. The inspector does not authorize migration and does not prove that a supplied envelope came from a trusted actor.

## Compatibility and migration

Existing current-schema create/parse/encode/revision/restore behavior remains unchanged. The identity inspector is additive and must be available from a framework-independent package surface without pulling in React, TipTap UI, ProseMirror view, Yjs, DOM globals, network clients, or model SDKs.

Any future change to envelope identity fields, canonicalization, or digest meaning requires an explicit new versioned contract and corresponding ADR update or supersession. Migration implementations remain host-owned and version-specific; this ADR does not define a universal transformation between arbitrary schema generations.

## Verification

Issue #74 defines the test-first implementation acceptance. Verification must include legacy/current/future identity, JSON text and strict UTF-8 bytes, duplicate names, malformed input, hostile JavaScript descriptors/proxies, resource limits, recursive absence of document-bearing output, deterministic repeated inspection, packed ESM/CommonJS/strict-TypeScript consumers, and proof that the strict current parser still rejects unsupported schemas.

Repository-wide exact owned production statement/branch/function/line coverage and public docstring gates remain unchanged. Exact-head CI, security, package, provenance, review, and branch-protection evidence are required before the implementation can become protected-main authority.

## Rollback or supersession

Before protected integration, rollback removes the proposed inspector and leaves the strict parser plus host-owned migration guidance unchanged. After integration, removal or semantic broadening is a compatibility change requiring package-version review and migration guidance.

Supersession is acceptable only if a later design preserves or strengthens the separation between bounded schema identification, strict current-schema validation, and host-owned migration/persistence authority.

## References

Bray, T. (Ed.). (2015). *The I-JSON Message Format* (RFC 7493). RFC Editor. https://doi.org/10.17487/RFC7493

Bray, T. (Ed.). (2017). *The JavaScript Object Notation (JSON) Data Interchange Format* (RFC 8259; STD 90). RFC Editor. https://doi.org/10.17487/RFC8259

Rundgren, A., Jordan, B., & Erdtman, S. (2020). *JSON Canonicalization Scheme (JCS)* (RFC 8785). RFC Editor. https://doi.org/10.17487/RFC8785
