# Doctoring record: Durable autosave validator session

**Date:** 2026-08-05  
**Target release:** Unreleased after Inkspan 0.5.28  
**Decision owner:** ContextualWisdomLab  
**Scope:** Provider-neutral handoff of server-issued strong entity tags across the framework-independent single-flight autosave queue.

## Buyer-visible gap

Inkspan 0.5.28 supplies deterministic revision evidence and a bounded single-flight autosave queue. A host nevertheless has to retain a mutable durable `ETag` beside the queue, put the current value into every `If-Match` request, validate the server's replacement value, advance it only after a committed write, and replace it correctly after conflict recovery. That repeated closure is security-sensitive integration code. A missing, weak, malformed, stale, or locally derived validator can defeat lost-update protection even when the queue itself remains correctly ordered.

The selected bounded slice adds a durable autosave session to the existing framework-independent package. It makes the required concurrency base explicit in every host callback and owns only the local validator handoff. This reduces buyer integration risk without moving transport, authorization, tenant isolation, persistence, credentials, migration, retention, audit, retry, idempotency, conflict UX, or model-use policy into Inkspan.

## Decision

`createDocumentAutosaveSession()` combines one existing single-flight queue with one server-issued strong entity tag. The initial tag must come from the durable representation loaded by the host. For each active revision the session invokes the host callback with a frozen request containing:

- detached, deeply frozen Inkspan document revision evidence; and
- the exact current `ifMatchStrongEntityTag` that the host must compare atomically in its authorized durable write transaction.

A committed callback result must contain `status: "saved"` and the server-selected `nextStrongEntityTag`. The session advances its durable base only after that exact result passes fail-closed validation. A conflict result does not alter the base. A malformed result, inaccessible reflection surface, promise-assimilation failure, rejected callback, or thrown callback blocks progression through the existing redacted queue failure path and leaves the previous durable tag intact.

`resume(nextStrongEntityTag)` is intentionally explicit. It succeeds only while the session is blocked and only after validating one replacement strong entity tag obtained through a host-owned authenticated reload, compare/merge/fork decision, or idempotency confirmation. The replacement is installed before retained work resumes, so the next callback cannot observe the stale pre-recovery base.

## HTTP validator boundary

RFC 9110 defines an entity tag as an opaque validator selected by the origin server. `If-Match` uses the strong comparison function and is commonly used with state-changing methods to prevent the lost-update problem. Inkspan's SHA-256 revision evidence is deterministic local equality evidence for its canonical envelope; it is not automatically the durable service's selected representation validator.

`isStrongHttpEntityTag()` therefore accepts exactly one quoted opaque tag matching the RFC 9110 character grammar and rejects weak `W/` tags, unquoted values, whitespace, controls, lists, wildcards, Unicode beyond the HTTP `obs-text` range, and any input requiring trimming or repair. Syntax validation does not establish authorization, freshness, tenant membership, or correspondence to a durable representation; the host remains responsible for all of those properties.

## Concurrency and failure invariants

1. Exactly one durable save callback can be active because the session delegates scheduling to the existing single-flight queue.
2. Every callback receives the durable tag current at callback start, not the local content revision and not a later mutable value.
3. The durable tag advances only after an exact valid `saved` result supplies a valid server-selected replacement tag.
4. Conflict, invalid result, reflection failure, promise-assimilation failure, and callback failure never advance the durable tag.
5. Blocked retained work cannot restart until the host supplies a valid recovered durable tag.
6. The recovered tag is installed before queue progression resumes.
7. Session snapshots are frozen and contain no document body, callback result, credential, tenant identifier, or original exception.
8. Public errors remain redacted and machine-readable through the existing `DocumentAutosaveQueueError` categories.
9. The runtime and declaration graph contain no React, React DOM, TipTap, ProseMirror, Yjs, DOM, provider SDK, storage driver, credential, or network client dependency.
10. No database object, migration, scheduler, model call, reviewer identity, or credential-chain change is introduced.

These invariants create a linearizable process-local handoff around host callbacks. They do not create a distributed transaction. Durable correctness still requires the host to compare the supplied base and commit the new representation atomically inside the same authorized storage transaction.

## Security and privacy analysis

The session validates options and callback outcomes fail-closed. Callback result inspection uses exact own-property descriptors rather than ordinary status or tag getters. Promise assimilation is part of callback execution: a returned thenable whose `then` access throws is treated as an ambiguous host callback failure rather than as trustworthy result data. Reflection failures after successful assimilation are treated as invalid results. Neither path copies private values or exceptions into the public error.

Entity tags may correlate representations and must be treated as tenant-confidential metadata. They must not become public URLs, metric-label values, analytics dimensions, unauthenticated log fields, authorization tokens, or durable audit substitutes. The host applies its existing access control, encryption, retention, residency, redaction, and audit policy.

No database object is added. A host that persists session or document state must use database object names containing at least two descriptive words, with `snake_case` preferred unless the target ecosystem requires valid CamelCase or PascalCase.

## Modular ownership matrix

| Concern | Inkspan durable session | Host or CWL service |
| --- | --- | --- |
| Strong entity-tag syntax validation | Owns | Supplies server-selected values |
| One-active/one-pending local ordering | Owns | Chooses debounce and enqueue timing |
| Durable validator handoff between callbacks | Owns | Returns committed replacement tag |
| Transport and credentials | Does not own | Owns |
| Authentication and authorization | Does not own | Owns |
| Tenant isolation | Does not own | Owns |
| Atomic durable `If-Match` comparison and commit | Does not own | Owns |
| Persistence, migration, backup, and rollback | Does not own | Owns |
| Retention, residency, redaction, and audit storage | Does not own | Owns |
| Retry, offline, idempotency, and conflict UX | Does not own | Owns |
| Model provider and model-use policy | Does not own | Owns |

This boundary preserves standalone operation and allows naruon compose surfaces, `ui.panel`, contextual-orchestrator workflows, and other CWL hosts to supply their own authorized service adapters without importing host policy into the editor package.

## Verification evidence

Deterministic unit and integration tests cover strong-tag grammar, malformed options, hostile option getters, sequential server-validator handoff, frozen callback requests, conflict retention, explicit recovered-tag installation, invalid exact callback shapes, weak replacement validators, inaccessible reflection, promise-assimilation failure, thrown transport failure, flush, shutdown, and document-free snapshots.

The exact packed npm artifact is executed through ESM and CommonJS and compiled as a strict TypeScript consumer in an isolated temporary package tree that contains no React, React DOM, TipTap, ProseMirror, or Yjs installation. The packed tests prove that the exported session supplies the initial server tag, adopts only the returned replacement tag, preserves framework independence, and exposes complete declarations.

Repository acceptance remains 100% production statement, branch, function, and line coverage; TypeScript type checking; deterministic library and demo builds; isolated package-consumer verification; security and supply-chain scans; exact-current-head automated review; independent approval; and branch protection. A version bump or publication is prohibited until all integrated release-acceptance and provenance gates pass.

## References (APA 7th edition)

Fielding, R., Nottingham, M., & Reschke, J. (2022). *HTTP semantics* (RFC 9110). RFC Editor. https://doi.org/10.17487/RFC9110

Herlihy, M. P., & Wing, J. M. (1990). Linearizability: A correctness condition for concurrent objects. *ACM Transactions on Programming Languages and Systems, 12*(3), 463–492. https://doi.org/10.1145/78969.78972

International Organization for Standardization. (2023). *Systems and software engineering—Systems and software quality requirements and evaluation (SQuaRE)—Product quality model* (ISO/IEC 25010:2023). https://www.iso.org/standard/78176.html

Rundgren, A., Jordan, B., & Erdtman, S. (2020). *JSON Canonicalization Scheme (JCS)* (RFC 8785). RFC Editor. https://doi.org/10.17487/RFC8785
