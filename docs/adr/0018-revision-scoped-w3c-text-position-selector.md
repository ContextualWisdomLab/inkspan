# ADR 0018: Revision-scoped W3C text-position selector evidence

Status: Accepted

## Context

Inkspan exposes revision-scoped ProseMirror selection evidence on protected `main`. Those coordinates are structural positions in one ProseMirror document tree. They cannot be relabeled as W3C `TextPositionSelector` offsets because the W3C Web Annotation Data Model selects a text representation by Unicode code-point positions, uses an inclusive `start` and exclusive `end`, and warns that position selectors are brittle when the source changes.

Enterprise review and annotation hosts need an interoperable selector without copying selected text into ordinary local evidence. Inkspan must also preserve its existing authority boundary: the editor may produce deterministic local evidence, while the host owns source-resource identity, annotation identity/body, authorization, tenancy, durable persistence, audit, publication, and cross-revision re-anchoring.

## Alternatives considered

### A. Persist raw ProseMirror positions as annotation selectors

Rejected. This would assign W3C semantics to a different coordinate system and make stored annotations dependent on undocumented ProseMirror structure.

### B. Emit `TextQuoteSelector` text with every local selection

Rejected as the default evidence contract. It copies source content into annotation metadata and broadens privacy, retention, and rights exposure. A host may deliberately derive quote evidence under its own separately reviewed policy.

### C. Emit a revision-scoped, versioned text projection and W3C `TextPositionSelector`

Selected. The selector is derived deterministically from the same immutable editor state used to derive the exact document revision. The projection identity is explicit and versioned, and ordinary evidence contains no selected quote text.

### D. Silently shift boundaries to the nearest grapheme boundary

Rejected. Moving a user-selected boundary changes the selected range without authority and can make an invalid selector appear valid.

### E. Make cross-revision re-anchoring an Inkspan persistence feature

Rejected. Re-anchoring requires application document identity, authorization, collaboration, conflict, and persistence policy that belong to the host under Inkspan's current product boundary.

## Decision

Inkspan exposes a privacy-minimized `CwlEditorTextPositionSelectorEvidence` value containing:

- an exact `CwlEditorDocumentRevision`;
- a W3C `TextPositionSelector` satisfying `0 <= start <= end <= projectedCodePointLength`, with inclusive `start` and exclusive `end` Unicode-code-point positions; and
- an explicit `CwlEditorTextProjectionIdentity`.

The range invariant is a producer invariant, not a separate untrusted-input parser contract. `createTextPositionSelector()` receives one already-valid ProseMirror `Selection`; ProseMirror supplies ordered in-document `from` and `to` positions, and Inkspan derives both offsets from prefixes of the same projected document. Therefore an emitted range outside `0 <= start <= end <= projectedCodePointLength` indicates an Inkspan/ProseMirror internal invariant defect and must never be normalized or published. The current public constructor has no caller-supplied numeric selector range, so inventing a reachable public `selector_range` error would misdescribe the implementation. If a future version accepts external selector numbers, that parser requires an explicit bounded range-validation error contract before release.

Projection version 1 is `inkspan-prosemirror-text` version `1`. Its normative mapping is closed by the following table and by ProseMirror `Node.textBetween(0, position, "\n", "\uFFFC")` semantics used by the protected implementation.

| ProseMirror content encountered in the active validated document | Projection-v1 output |
| --- | --- |
| Text node content | Exact stored Unicode string slice; no NFC/NFKC or other Unicode normalization and no visual bidi reordering |
| Every non-text leaf node encountered by `Node.textBetween` | One U+FFFC OBJECT REPLACEMENT CHARACTER, regardless of leaf node type; this covers active-schema leaf nodes such as hard breaks and images when present |
| Boundary between separated block content encountered by `Node.textBetween` | U+000A LINE FEED using the configured block separator |
| Nested block structure | Traversed in logical ProseMirror document order; separators are exactly those emitted by the same `Node.textBetween` call, never inferred from DOM/layout |
| Empty block or container with no projected text/leaf contribution | No invented character; any separator is only one that `Node.textBetween` emits when separating actual projected block content |
| Node that cannot exist in the active validated editor schema | No projection fallback. External document JSON must be rejected by the existing active-schema validation boundary before selector evidence construction |

The evidence operation supports any valid ProseMirror `Selection` present in the active editor state by using its ordered `from`/`to` bounds. This includes caret/range text selections, valid node selections, and all-document selections. Selection-specific UI semantics are not reinterpreted: only the exact projected range between the valid ProseMirror bounds becomes W3C position evidence. A future custom selection class is supported only if it preserves the ProseMirror `Selection` contract with valid ordered document bounds; otherwise evidence construction must fail before publication rather than guess coordinates.

Selection boundaries must coincide with grapheme-cluster boundaries in the complete projection. Inkspan uses `Intl.Segmenter` with grapheme granularity. If the runtime lacks that capability, construction fails closed with `segmenter_unavailable`; a boundary inside a grapheme cluster fails with `grapheme_boundary`. Inkspan never silently moves an invalid boundary.

The editor handle captures one immutable `EditorState` before asynchronous digest work. Projection, selector, document envelope, and resulting revision are derived from that same state so later live editor changes cannot mix coordinates and content revisions.

This decision is implemented on protected `main` by merge commit `52cff8355b2408a3b62f9cbb26ad76b91442f511`. Protected implementation makes this ADR Accepted; later feature-branch or predecessor-head evidence does not supersede the protected contract.

## Consequences

### Benefits

- W3C-compatible position evidence can cross service/module boundaries without exposing selected quote text by default.
- Exact revision binding makes source drift explicit instead of silently reusing brittle offsets.
- Projection versioning prevents later separator, leaf-node, normalization, or counting changes from silently reinterpreting stored selectors.
- The closed mapping makes independent producers/consumers able to reconstruct the same projection semantics instead of relying on prose such as “supported leaf nodes.”
- Standalone Inkspan remains independent of databases, providers, naruon, contextual-orchestrator, credentials, and model runtimes.

### Costs and limits

- Position selectors remain brittle across document changes; revision changes require host-owned re-anchoring or another explicit strategy.
- `Intl.Segmenter` is required for this evidence operation, though not for Inkspan editing generally.
- A position-only selector deliberately omits textual quote redundancy that some annotation systems use for recovery.
- The selector proves location within one versioned text projection, not identity of a user, authorization, occurrence time, or durable annotation acceptance.
- Projection v1 intentionally follows ProseMirror `textBetween` semantics; changing that dependency contract is a compatibility event requiring a new projection version or explicit equivalence proof.

## Failure and recovery

- Before an editor exists, imperative capture returns `null`.
- Unsupported grapheme segmentation fails closed with `segmenter_unavailable`.
- Invalid grapheme boundaries fail closed with `grapheme_boundary`.
- Envelope/digest failures preserve their existing fail-closed contracts.
- Unknown future projection versions must not be interpreted as version 1.
- An impossible producer-range violation (`start > end`, negative output, or `end > projectedCodePointLength`) is an internal invariant defect: do not publish evidence or silently repair the range. The present API does not accept external numeric selectors and therefore does not expose a fabricated range-error code.
- A document/node shape outside the validated active schema must be rejected by the existing document-schema boundary; projection v1 does not invent an unsupported-node placeholder beyond its defined every-non-text-leaf U+FFFC rule.
- When a host detects a revision mismatch, it must reject direct offset reuse and choose compare, reload, fork, merge, or separately reviewed re-anchoring.
- A failure to produce selector evidence does not corrupt the editor document or grant the host permission to fall back to unversioned structural coordinates.

## Security and privacy impact

Ordinary selector evidence contains no selected quote, complete document envelope, actor, tenant, timestamp, authorization decision, model identity, transport result, signature, or durable-write receipt. A revision digest proves content equality only.

Hosts remain responsible for authentication, authorization, tenant isolation, source-resource IRI policy, annotation bodies and identifiers, persistence, retention, audit, publication, and collaboration-aware re-anchoring. Selector and revision metadata can still be sensitive and must not become unauthenticated logs or unbounded public metric labels.

## Compatibility and migration

The feature extends the root package API without altering existing ProseMirror selection snapshots or revision-scoped selection evidence. Existing consumers continue to use their current coordinates. Consumers that adopt W3C selectors must retain the `textProjection` identity alongside offsets and reject unsupported projection versions.

Any future change to block separators, leaf-node representation, normalization, code-point interpretation, supported selection semantics, or grapheme policy requires a new projection version and explicit compatibility/migration guidance rather than silent reinterpretation. A new projection must not rewrite the meaning of already-issued version-1 evidence.

## Verification

Protected-main acceptance includes:

- known-answer tests for astral Unicode, combining sequences, bidirectional logical order, multi-block separation, hard breaks/non-text leaves, caret and range selections;
- explicit producer-range invariant assertions against the complete projected code-point length;
- node-selection and all-selection projection fixtures when those selection forms are exercised by the public editor surface;
- fail-closed grapheme and missing-segmenter tests;
- same-state atomicity while digest derivation is delayed and the live editor mutates;
- frozen/privacy-minimized evidence assertions;
- packed ESM, CommonJS, and strict TypeScript consumers;
- repository exact 100% owned production statement/branch/function/line coverage; and
- exact-head CI/security/package evidence for the protected implementation lineage.

Canonical PRD, TRD, contracts, UML, conceptual data/evidence model, documentation fitness, and traceability must describe the protected contract without transferring host persistence or annotation authority to Inkspan.

## Rollback or supersession

A later release may remove the public selector API only as a compatibility-significant change with explicit migration guidance. Previously produced version-1 selectors must never be reinterpreted as ProseMirror positions or under a different projection.

A material change to selector authority, projection semantics, default privacy disclosure, supported selection semantics, or re-anchoring ownership requires a superseding ADR. Rollback of this capability must leave existing editor/revision evidence and host-owned durable data readable and must not silently mutate stored annotation semantics.

## References

Ecma International. (2026). *ECMA-402: ECMAScript 2026 internationalization API specification* (13th ed.). https://402.ecma-international.org/

ProseMirror. (n.d.). *ProseMirror reference manual*. Retrieved August 10, 2026, from https://prosemirror.net/docs/ref/

World Wide Web Consortium. (2017, February 23). *Web Annotation Data Model*. https://www.w3.org/TR/annotation-model/
