# Doctoring record: Provider-neutral document autosave queue

**Date:** 2026-08-04  
**Target release:** Inkspan 0.5.28  
**Decision owner:** ContextualWisdomLab  
**Scope:** Framework-independent, single-flight autosave coordination for versioned document revision evidence.

## Buyer-visible gap

Inkspan already creates immutable document-envelope revision evidence and exposes
conflict-aware restore primitives, but every host still has to rebuild the same
concurrency machinery around them. A naïve host can start overlapping writes,
allow an older response to arrive after a newer one, retry a precondition
failure indefinitely, or retain superseded document bodies in an unbounded
queue. Those failure modes make autosave integration expensive to review and
hard to defend during enterprise acquisition diligence.

## Selected boundary

Inkspan will publish a framework-independent
`@contextualwisdomlab/cwl-editor/autosave` subpath containing one coalescing
single-flight queue. The queue accepts immutable
`CwlEditorDocumentRevisionEvidence` values and delegates each durable write to a
host callback. Inkspan owns deterministic local ordering, coalescing,
deduplication, redacted failure handling, and lifecycle state. Hosts continue to
own change detection and debounce policy, transport, authorization, tenant
isolation, persistence, atomic RFC 9110 `If-Match` enforcement, credentials,
migration, retention, audit storage, retry budgets, and conflict-resolution UX.

The queue intentionally contains no timer, network client, storage adapter,
credential, tenant identifier, model call, editor component, React hook, TipTap,
ProseMirror, or Yjs import. A timer-free contract is deterministic in SSR,
workers, tests, and embedded hosts while still allowing each product to choose
its own accessibility and interaction timing.

## State and outcome contract

The public queue exposes frozen snapshots with one of five states:

- `idle`: no callback is active and no revision is waiting;
- `saving`: exactly one host callback is active;
- `blocked`: a conflict or callback failure paused automatic progression;
- `closing`: new work is rejected while the active callback finishes; or
- `closed`: no further work can be accepted.

A host callback returns only `saved` or `conflict`. A saved revision becomes the
queue's last durable revision. A conflict resolves the active request as a
conflict and blocks later writes until the host explicitly calls `resume()`
after completing its own authenticated conflict workflow. A thrown callback or
an invalid callback result rejects the active request with a redacted
`DocumentAutosaveQueueError` and blocks progression; the original exception is
not copied into a library error message.

Each enqueue request resolves as `saved`, `unchanged`, `superseded`, `conflict`,
or `closed`. Requests for the active or pending strong entity tag share the same
outcome. A newly queued different revision supersedes only the not-yet-started
pending revision. It never cancels or overlaps the active host write. At most one
pending revision is retained, which bounds document-memory growth independently
of edit frequency.

`flush()` resolves when the queue is idle, blocked, or closed; it does not hang
waiting for an explicit conflict decision. `close()` rejects new work, resolves
not-yet-started work as closed, and allows an already-active host callback to
finish. The queue never silently aborts host transport.

## Concurrency invariants

1. At most one save callback invocation is active.
2. Callback invocation order is the order in which revisions become active.
3. A pending revision can be replaced only before its callback starts.
4. Same-revision callers observe one shared callback result.
5. No save starts while conflict or failure state is blocked.
6. No save starts after closing begins.
7. Snapshot and request metadata contain no document body.
8. Every public result and snapshot is frozen before crossing the library boundary.

These invariants provide a linearizable local coordination surface without
claiming distributed transaction semantics. Durable lost-update prevention
still depends on the host enforcing the evidence strong entity tag atomically in
the same authorized write transaction.

## Security and privacy considerations

Revision tags are equality validators, not authorization tokens, signatures,
tenant identifiers, or proof of persistence. They can correlate identical
canonical documents and therefore remain tenant-confidential metadata. Hosts
must not place revision tags, document bodies, callback exceptions, credentials,
or conflict payloads in public URLs, metrics labels, or unauthenticated logs.

The queue validates the evidence revision contract and host callback outcome
fail-closed. It does not recompute the document digest because evidence creation
already performs canonicalization and hashing; callers must enqueue evidence
returned by Inkspan rather than constructing look-alike objects.

No database object is introduced. Any host persistence object must use at least
two descriptive words and `snake_case` by default, or valid CamelCase/PascalCase
where an ecosystem requires it.

## Verification plan

The production module will have 100% statement and branch coverage. Deterministic
unit and concurrency tests will cover same-revision coalescing, pending
supersession, single-flight ordering, re-entrant enqueue, conflict pause and
resume, callback failure and recovery, invalid outcomes, unchanged revisions,
flush behavior, close during idle/saving/blocked states, frozen public values,
invalid evidence, and bounded pending retention.

A packed-artifact consumer will execute ESM and CommonJS imports and compile a
strict TypeScript consumer from an operating-system temporary package tree. The
consumer will contain the packed Inkspan artifact without React, React DOM,
TipTap, ProseMirror, or Yjs, so any framework import from the autosave subpath
fails before merge.

## References (APA 7th edition)

Fielding, R., Nottingham, M., & Reschke, J. (2022). *HTTP semantics* (RFC
9110). RFC Editor. https://doi.org/10.17487/RFC9110

Herlihy, M. P., & Wing, J. M. (1990). Linearizability: A correctness condition
for concurrent objects. *ACM Transactions on Programming Languages and Systems,
12*(3), 463–492. https://doi.org/10.1145/78969.78972

International Organization for Standardization. (2023). *Systems and software
engineering—Systems and software quality requirements and evaluation
(SQuaRE)—Product quality model* (ISO/IEC 25010:2023).
https://www.iso.org/standard/78176.html

Rundgren, A., Jordan, B., & Erdtman, S. (2020). *JSON Canonicalization Scheme
(JCS)* (RFC 8785). RFC Editor. https://doi.org/10.17487/RFC8785
