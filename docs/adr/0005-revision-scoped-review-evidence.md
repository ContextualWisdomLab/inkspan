# ADR 0005: Revision-scoped review evidence

Status: Proposed

## Context

Delayed review, annotation, AI assistance, and audit-like workflows need to refer to an exact editor state. Copying selected text or entire document bodies into ordinary metadata increases privacy exposure, while asynchronous hashing can accidentally bind coordinates to a later document if state is reread.

## Decision

Capture selection coordinates and the canonical document envelope from the same immutable editor state before asynchronous revision derivation. Transition evidence validates previous and resulting envelopes before deriving both revisions. Evidence contains only the minimum revision/coordinate/change metadata required by the versioned contract and excludes document bodies, actor, tenant, time, authorization, model identity, transport result, signature, and durable-write claims.

## Consequences

Hosts can detect stale review coordinates and content transitions without duplicating full document content in routine evidence. Hosts remain responsible for durable annotation IDs, cross-revision re-anchoring, actor/time attribution, authorization, audit storage, and model-use policy.

## Failure and recovery

If editor state changes during a capture boundary, the API must not emit a stale mixed-state claim. Coordinates are valid only with the matching revision. A changed document requires an explicit host re-anchor, compare, merge, fork, or collaborative anchoring policy.

## Verification

Use concurrency tests, range/caret cases, transition ordering tests, recursive document-content absence checks, frozen-output checks, packed ESM/CommonJS/strict-TypeScript consumers, and exact-head coverage/security gates.

## Rollback or supersession

Rollback removes the convenience evidence surface while preserving canonical envelope/revision primitives. Supersession requires a versioned anchor/evidence contract that retains minimum disclosure and explicitly defines compatibility/migration semantics.
