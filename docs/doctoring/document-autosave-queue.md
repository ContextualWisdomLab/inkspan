# Doctoring record: Provider-neutral document autosave queue

**Date:** 2026-08-05  
**Target release:** Inkspan 0.5.28  
**Decision owner:** ContextualWisdomLab  
**Scope:** Framework-independent, single-flight autosave coordination for versioned document revision evidence.

## Buyer-visible gap

Inkspan already creates immutable document-envelope revision evidence and exposes
conflict-aware restore primitives, but every host still has to rebuild the same
concurrency machinery around them. A naïve host can start overlapping writes,
allow an older response to arrive after a newer one, retry a precondition
failure indefinitely, retain superseded document bodies in an unbounded queue,
or accumulate one internal waiter for every repeated flush request. Those
failure modes make autosave integration expensive to review and hard to defend
during enterprise acquisition diligence.

## Selected boundary

Inkspan will publish a framework-independent
`@contextualwisdomlab/cwl-editor/autosave` subpath containing one coalescing
single-flight queue. The queue accepts immutable
`CwlEditorDocumentRevisionEvidence` values and delegates each durable write to a
host callback. Inkspan owns deterministic local ordering, coalescing,
deduplication, bounded active/pending/flush-waiter retention, redacted failure
handling, and lifecycle state. Hosts continue to own change detection and
debounce policy, transport, authorization, tenant isolation, persistence,
atomic RFC 9110 `If-Match` enforcement, credentials, migration, retention,
audit storage, retry budgets, and conflict-resolution UX.

The queue intentionally contains no timer, network client, storage adapter,
credential, tenant identifier, model call, editor component, React hook, TipTap,
ProseMirror, or Yjs runtime import. A timer-free contract is deterministic in
SSR, workers, Node.js, tests, and embedded hosts while still allowing each
product to choose its own accessibility and interaction timing.

## State and outcome contract

The public queue exposes frozen snapshots with one of five states:

- `idle`: no callback is active and no revision is waiting;
- `saving`: exactly one host callback is active;
- `blocked`: a conflict or callback failure paused automatic progression;
- `closing`: new work is rejected while the active callback finishes; or
- `closed`: no further work can be accepted.

A host callback returns only `saved` or `conflict`. A saved revision becomes the
queue's last reported durable revision and re-establishes the internal shortcut
that can later return `unchanged`. A conflict resolves the active request as a
conflict, invalidates that shortcut, and blocks later writes until the host
explicitly calls `resume()` after completing its own authenticated conflict
workflow. A thrown callback or an invalid callback result rejects the active
request with a redacted `DocumentAutosaveQueueError`, invalidates the shortcut,
and blocks progression; the original exception is not copied into a library
error message.

Each enqueue request resolves as `saved`, `unchanged`, `superseded`, `conflict`,
or `closed`. Requests for the active or pending strong entity tag share the same
outcome. A newly queued different revision supersedes only the not-yet-started
pending revision. It never cancels or overlaps the active host write. At most one
active revision and one pending revision are retained, which bounds
library-owned document-memory growth independently of edit frequency.

`unchanged` is deliberately narrower than “this tag was saved sometime before.”
It is available only while the last successful save is still a valid assumption
about current durable state and no active or pending write can replace it. A
competing write, server conflict, invalid callback result, or ambiguous callback
failure prevents the shortcut. `resume()` clears only the blocked lifecycle
state; a subsequent successful save is required to establish a new durable
shortcut. The snapshot's `lastSavedStrongEntityTag` remains historical metadata
after uncertainty and is not proof that the revision is still current.

Concurrent nonterminal `flush()` calls share one pending promise rather than
appending one internal closure per call. That promise resolves when the queue is
idle, blocked, or closed; it does not hang waiting for an explicit conflict
decision. `close()` rejects new work, resolves not-yet-started work as closed,
and allows an already-active host callback to finish. The queue never silently
aborts host transport.

## Concurrency invariants

1. At most one save callback invocation is active.
2. Callback invocation order is the order in which revisions become active.
3. A pending revision can be replaced only before its callback starts.
4. Same-revision callers observe one shared callback result.
5. No save starts while conflict or failure state is blocked.
6. No save starts after closing begins.
7. At most one active request, one pending request, and one internal pending
   flush promise are retained.
8. Snapshot and request metadata contain no document body.
9. Every public result and snapshot is frozen before crossing the library
   boundary.
10. `unchanged` is returned only when a successful save has established a
    currently valid durable shortcut and no active or pending write can replace
    that revision.
11. Conflict, invalid callback results, and callback failures invalidate the
    durable shortcut across `resume()` until another save succeeds.
12. Public autosave evidence cannot reach the host callback unless its complete
    document JSON graph is descriptor-safe, JSON-compatible, deeply frozen, and
    within the active envelope resource ceilings.

These invariants provide a linearizable local coordination surface without
claiming distributed transaction semantics. Durable lost-update prevention
still depends on the host enforcing the evidence strong entity tag atomically in
the same authorized write transaction.

## Review finding: partially frozen look-alike evidence

The first queue implementation verified that the evidence object, envelope,
revision object, and `documentJson` root were frozen. That was insufficient for
a public structural TypeScript boundary: a caller could construct a frozen root
whose nested paragraph, text node, attribute object, or array remained mutable.
The queue would retain that look-alike value under a previously selected strong
entity tag, and the nested content could change before or during the host save.
This was a real process-local time-of-check/time-of-use integrity gap even though
evidence created by Inkspan itself is deeply frozen.

The corrected public `/autosave` boundary performs one iterative inspection
before scheduling. It reads only own data-property descriptors and never invokes
getters. It rejects mutable nested containers, accessor or non-enumerable fields,
symbol properties, non-finite numbers, unsupported prototypes, aliases, cycles,
sparse arrays, hostile reflection failures, nesting deeper than 128 levels, and
more than 1,000,000 JSON values. Those ceilings match the active document-envelope
defaults. The public wrapper then delegates to the existing exact schema and
SHA-256 metadata validation before any host callback begins.

The inspection deliberately does not recompute SHA-256. Recomputing would make
the synchronous queue boundary asynchronous and duplicate the canonicalization
work already performed by Inkspan evidence creation. Callers must still use
Inkspan-created evidence or an equivalent trusted private canonicalization and
hashing boundary. Deep immutability proves that the submitted graph cannot be
mutated after validation; it does not prove that a caller-supplied digest was
honestly derived from that graph.

## Security and privacy considerations

Revision tags are equality validators, not authorization tokens, signatures,
tenant identifiers, or proof of persistence. They can correlate identical
canonical documents and therefore remain tenant-confidential metadata. Hosts
must not place revision tags, document bodies, callback exceptions, credentials,
or conflict payloads in public URLs, metrics labels, or unauthenticated logs.

The queue validates public evidence and host callback-result shapes fail-closed
without evaluating ordinary accessor properties. Nested document inspection is
iterative rather than recursive so hostile depth cannot consume the JavaScript
call stack. Reflection exceptions become the same bounded redacted invalid-
evidence error and never copy candidate values or private exception text into a
public diagnostic.

No database object is introduced. Any host persistence object must use at least
two descriptive words and `snake_case` by default, or valid CamelCase/PascalCase
where an ecosystem requires it.

## Verification plan

The production module must retain 100% statement, branch, function, and line
coverage. Deterministic unit and concurrency tests cover same-revision
coalescing, pending supersession, single-flight ordering, re-entrant enqueue,
conflict pause and resume, callback failure and recovery, invalid outcomes,
quiescent unchanged revisions, competing-write requeue, blocked requeue,
durable-shortcut invalidation across resume, shared flush promises, close during
idle/saving/blocked states, frozen public values, invalid evidence, and bounded
active/pending retention.

Adversarial evidence tests use realistic frozen document graphs and prove that
mutable nested nodes, frozen getters, throwing proxies, aliases, cycles, sparse
or accessor arrays, symbol keys, non-enumerable properties, unsupported
prototypes, non-JSON values, excessive depth, and excessive value counts are
rejected before the host save callback. Valid deeply frozen graphs cover every
JSON primitive and null-prototype data objects. The packed ESM consumer repeats
the partially frozen nested-node regression against the exact publishable
artifact.

A packed-artifact consumer executes ESM and CommonJS imports and compiles a
strict TypeScript consumer from an operating-system temporary package tree. The
consumer contains the packed Inkspan artifact without React, React DOM, TipTap,
ProseMirror, or Yjs installed, so any framework runtime dependency from the
autosave subpath fails before merge.

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
