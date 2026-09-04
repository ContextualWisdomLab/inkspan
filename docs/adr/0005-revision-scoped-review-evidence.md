# ADR 0005: Revision-scoped review evidence

Status: Proposed

## Context

Delayed review, annotation, AI assistance, and audit-like workflows need to refer to an exact editor state. Copying selected text or entire document bodies into ordinary metadata increases privacy exposure, while asynchronous hashing can accidentally bind coordinates to a later document if state is reread.

## Alternatives considered

- Store selected text or full documents in ordinary review metadata. Rejected because it duplicates sensitive content and still does not guarantee stable anchoring after edits.
- Capture coordinates first and reread the document later for hashing. Rejected because asynchronous work can bind coordinates and revision to different editor states.
- Capture structural coordinates and canonical content from one immutable editor snapshot, then derive minimum revision-scoped evidence. Selected because it preserves temporal consistency while minimizing disclosure.
- Let each host translate review selectors and dispatch its own editor steps. Rejected because it duplicates the projection boundary, produces inconsistent undo behavior, and moves deterministic editor mutation out of Inkspan.

## Decision

Capture selection coordinates and the canonical document envelope from the same immutable editor state before asynchronous revision derivation. Transition evidence validates previous and resulting envelopes before deriving both revisions. Evidence contains only the minimum revision/coordinate/change metadata required by the versioned contract and excludes document bodies, actor, tenant, time, authorization, model identity, transport result, signature, and durable-write claims.

For an authorized insert/delete proposal, `CwlEditorHandle.applyReviewSuggestionDecision()` captures one immutable `EditorState`, validates the proposal and exact canonical revision, and confirms that the live state is still the captured state before dispatch. Acceptance maps the versioned text projection back to validated text positions and dispatches one ProseMirror transaction so normal undo/redo history remains authoritative. Rejection preserves the document and creates no transaction. The adapter never silently re-anchors a stale or unsupported selector.

## Consequences

Hosts can detect stale review coordinates and content transitions without duplicating full document content in routine evidence. Authorized insert/delete decisions share one deterministic transaction and history boundary. Hosts remain responsible for durable annotation IDs, exact-once decision persistence, cross-revision re-anchoring, actor/time attribution, authorization, audit storage, and model-use policy.

## Failure and recovery

If editor state changes during a capture boundary, the API must not emit a stale mixed-state claim. Coordinates are valid only with the matching revision. A changed document requires an explicit host re-anchor, compare, merge, fork, or collaborative anchoring policy.

## Security and privacy impact

Ordinary evidence is deliberately content-minimized and does not synthesize actor, tenant, model, authorization, signature, or durable-save claims. Revision identifiers and structural coordinates can still correlate tenant activity, so hosts must treat them as purpose-bound metadata and avoid public high-cardinality telemetry or unauthenticated disclosure.

## Compatibility and migration

Evidence shape and coordinate semantics are versioned contracts. Existing evidence remains meaningful only against its exact revision. A future durable/collaborative anchor format requires an explicit new version or migration rule; old coordinates must not be silently reinterpreted against a new document generation.

## Verification

Use concurrency tests, insert/delete/reject and undo/redo cases, Unicode projection boundaries, range/caret cases, transition ordering tests, recursive document-content absence checks, frozen-output checks, packed ESM/CommonJS/strict-TypeScript consumers, and exact-head coverage/security gates.

## Rollback or supersession

Rollback removes the convenience evidence surface while preserving canonical envelope/revision primitives. Supersession requires a versioned anchor/evidence contract that retains minimum disclosure and explicitly defines compatibility/migration semantics.
