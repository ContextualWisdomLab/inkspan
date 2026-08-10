# ADR 0018: Revision-scoped W3C text-position selector evidence

Status: Proposed

## Context

Inkspan already exposes revision-scoped ProseMirror selection evidence on protected `main`. Those coordinates are structural positions in one ProseMirror document tree. They cannot be relabeled as W3C `TextPositionSelector` offsets because the W3C Web Annotation Data Model selects normalized text by Unicode code-point positions, uses an inclusive `start` and exclusive `end`, requires logical rather than visual order, and advises against boundaries inside grapheme clusters.

Enterprise review and annotation hosts need an interoperable selector without copying selected text into ordinary local evidence. At the same time, Inkspan must not assume host persistence, annotation identity, authorization, tenancy, durable audit, or cross-revision re-anchoring authority.

## Alternatives considered

### A. Persist raw ProseMirror positions as annotation selectors

Rejected. This would assign W3C semantics to a different coordinate system and make stored annotations dependent on undocumented ProseMirror structure.

### B. Emit `TextQuoteSelector` text with every local selection

Rejected as the default evidence contract. It copies source content into annotation metadata and broadens privacy, retention, and rights exposure. Hosts may deliberately derive quote evidence under their own policy if a future reviewed contract requires it.

### C. Emit a revision-scoped, versioned text projection and W3C `TextPositionSelector`

Selected. The selector is derived deterministically from the same immutable editor state used to derive the exact document revision. The projection identity is explicit and versioned, and the ordinary evidence contains no selected quote text.

### D. Make cross-revision re-anchoring an Inkspan persistence feature

Rejected. Re-anchoring requires application document identity, authorization, collaboration and persistence policy that belong to the host under Inkspan's current product boundary.

## Decision

Inkspan will expose a privacy-minimized `CwlEditorTextPositionSelectorEvidence` value that contains:

- an exact `CwlEditorDocumentRevision`;
- a W3C `TextPositionSelector` with non-negative inclusive `start` and exclusive `end` Unicode-code-point positions; and
- an explicit `CwlEditorTextProjectionIdentity`.

Projection version 1 is `inkspan-prosemirror-text` version `1` and uses:

- logical ProseMirror document order;
- U+000A LINE FEED as the configured block separator;
- U+FFFC OBJECT REPLACEMENT CHARACTER for supported non-text leaf nodes;
- no Unicode normalization or visual bidirectional reordering; and
- Unicode-code-point counting after projection.

Selection boundaries must coincide with grapheme-cluster boundaries. Inkspan uses `Intl.Segmenter` with grapheme granularity. If the runtime lacks the segmentation capability, construction fails closed with `segmenter_unavailable`; a boundary inside a grapheme cluster fails with `grapheme_boundary`. Inkspan does not silently move selection boundaries.

The editor handle captures one immutable `EditorState` before asynchronous digest work. Projection, selector, document envelope, and resulting revision are derived from that same state so later live editor changes cannot mix coordinates and content revisions.

## Consequences

### Benefits

- W3C-compatible position evidence can cross service/module boundaries without exposing selected quote text by default.
- Exact revision binding makes source drift explicit rather than silently reusing brittle offsets.
- Projection versioning prevents later separator, leaf-node, normalization, or counting changes from silently reinterpreting stored selectors.
- Standalone Inkspan remains independent of databases, providers, naruon, contextual-orchestrator, credentials, and model runtimes.

### Costs and limits

- Position selectors remain brittle across document changes, as the W3C model itself warns; revision changes require host-owned re-anchoring or another explicit strategy.
- `Intl.Segmenter` becomes a required runtime capability for this evidence operation, not for Inkspan editing generally.
- A position-only selector deliberately omits textual quote redundancy that some annotation systems use for recovery.

## Failure and recovery semantics

- Before an editor exists, imperative capture returns `null`.
- Unsupported grapheme segmentation fails closed with `segmenter_unavailable`.
- Invalid grapheme boundaries fail closed with `grapheme_boundary`.
- Envelope/digest failures preserve their existing error contracts.
- Unknown future projection versions must not be interpreted as version 1.
- When a host detects a revision mismatch, it must reject direct offset reuse and choose compare, reload, fork, merge, or separately reviewed re-anchoring.

## Security and privacy impact

Ordinary selector evidence contains no selected quote, complete document envelope, actor, tenant, timestamp, authorization decision, model identity, transport result, signature, or durable-write receipt. A revision digest proves content equality only. Hosts remain responsible for authentication, authorization, tenant isolation, source-resource IRI policy, annotation bodies and identifiers, persistence, retention, audit, publication, and collaboration-aware re-anchoring.

## Compatibility and migration

The feature extends the root package API without altering existing ProseMirror selection snapshots or revision-scoped selection evidence. Existing consumers continue to use their current coordinates. Consumers that adopt W3C selectors must persist or transmit the `textProjection` identity alongside offsets and must reject unsupported projection versions.

Any future change to block separators, leaf-node representation, normalization, code-point interpretation, or grapheme policy requires a new projection version and migration/compatibility guidance rather than silent reinterpretation.

## Verification and acceptance evidence

Acceptance requires:

- known-answer tests for astral Unicode, combining sequences, bidirectional logical order, multi-block separation, hard breaks/leaf nodes, caret and range selections;
- fail-closed grapheme and missing-segmenter tests;
- same-state atomicity while digest derivation is delayed and the live editor mutates;
- frozen/privacy-minimized evidence assertions;
- packed ESM, CommonJS, and strict TypeScript consumers;
- repository exact 100% owned production statement/branch/function/line coverage;
- canonical PRD/TRD/contracts/UML/data-model/traceability synchronization; and
- exact-current-head CI, security, review, and repository-policy acceptance.

Until the implementation reaches protected `main`, this ADR remains Proposed and the feature is `implemented_on_active_pr`, not shipped authority.

## Rollback and supersession

Rollback may remove the new public selector API while preserving existing ProseMirror selection and revision evidence. Previously produced version-1 selectors must never be reinterpreted as ProseMirror positions. A material change to selector authority or projection semantics supersedes this ADR with an explicit replacement decision.

## References — APA 7th

Ecma International. (2026). *ECMA-402: ECMAScript 2026 internationalization API specification* (13th ed.). https://402.ecma-international.org/

ProseMirror. (n.d.). *ProseMirror reference manual*. Retrieved August 10, 2026, from https://prosemirror.net/docs/ref/

World Wide Web Consortium. (2017, February 23). *Web Annotation Data Model*. https://www.w3.org/TR/annotation-model/
