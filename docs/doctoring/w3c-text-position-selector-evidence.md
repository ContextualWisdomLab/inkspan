# W3C text-position selector evidence

Status: Implemented on active PR

## Purpose

Inkspan already exposes revision-scoped ProseMirror selection evidence. That contract is intentionally local to one editor state: ProseMirror positions are structural positions, not portable W3C text offsets. This active change adds a second, privacy-minimized interoperability representation that binds a W3C `TextPositionSelector` to the exact same immutable document revision without copying selected text into ordinary evidence metadata.

## Standards authority

The W3C *Web Annotation Data Model* Recommendation defines `TextPositionSelector` using an inclusive `start` and exclusive `end` in a normalized text representation. Its text-position processing model counts Unicode code points rather than implementation code units and cautions that selection boundaries should not split grapheme clusters. Position-only selectors avoid copying quote text into the annotation graph, but they are sensitive to source changes; Inkspan therefore binds every selector to an exact revision rather than claiming durable cross-revision anchoring.

ProseMirror remains the editor-structure authority. Its document positions are tree-structural coordinates, and `Node.textBetween(from, to, blockSeparator, leafText)` is the primitive used by the versioned Inkspan projection. A ProseMirror position is never relabeled as a W3C position by identity.

ECMA-402 13th edition, June 2026 is the current published ECMAScript internationalization standard. Inkspan uses `Intl.Segmenter` with `granularity: 'grapheme'` to reject selection boundaries that do not coincide with grapheme-cluster boundaries. A runtime lacking that capability fails closed with the stable `segmenter_unavailable` classification instead of silently weakening the evidence contract.

## Projection version 1

`textProjection` is part of the public evidence because selector offsets are meaningless without a deterministic projection identity.

Projection v1 is:

- `id = "inkspan-prosemirror-text"`;
- `version = 1`;
- logical ProseMirror document order, independent of visual bidirectional rendering order;
- U+000A LINE FEED between block boundaries where ProseMirror `textBetween` inserts the configured block separator;
- U+FFFC OBJECT REPLACEMENT CHARACTER for supported non-text leaf nodes;
- Unicode-code-point counting for W3C `start` and `end`;
- inclusive `start` and exclusive `end`;
- grapheme-cluster boundary validation before evidence is returned.

Array/tree order and actual text content remain authoritative. The projection does not normalize Unicode text, reorder bidirectional text visually, or invent source quote text.

## Atomicity

`getTextPositionSelectorEvidence()` captures one `editor.state` before asynchronous digest work begins. The projection and selector are derived from that captured `state.doc` and `state.selection`; the document envelope used for SHA-256 revision derivation is produced from the same captured `state.doc`. A live editor mutation after digest work starts cannot change the pending evidence object.

The returned top-level evidence, `selector`, and `textProjection` are frozen. Ordinary evidence contains no selected text, surrounding quote, complete document envelope, actor, tenant, timestamp, model identity, authorization decision, transport result, signature, or durable-write claim.

## Failure semantics

- Before editor creation, the handle resolves to `null`, matching the existing revision-scoped selection fallback.
- A selection boundary inside a grapheme cluster fails with `TextPositionSelectorEvidenceError.code = "grapheme_boundary"`.
- Absence of supported `Intl.Segmenter` grapheme segmentation fails with `code = "segmenter_unavailable"`.
- Existing document-envelope and digest validation failures retain their own fail-closed behavior.
- The API never silently adjusts an invalid boundary to a nearby grapheme boundary because doing so would change the user's selected range without explicit authority.

## Privacy and ownership

Inkspan owns only the deterministic projection and exact-revision selector evidence. Hosts own annotation identifiers and bodies, source-resource IRI policy, authentication, authorization, tenant isolation, durable persistence, retention, audit, collaborative anchors, re-anchoring after revisions, publication, and any W3C Annotation graph stored or transmitted outside the editor.

A revision digest plus text-position selector proves neither who selected the range, when it was selected, whether it was authorized, nor whether an annotation was durably accepted. Hosts must compare the bound revision before reusing the positions. If the document changed, the host chooses compare, merge, fork, reload, or a separately designed collaborative re-anchoring strategy.

## Compatibility and rollback

Projection semantics are versioned. A future change to block separators, leaf representations, normalization, code-point interpretation, or grapheme policy must publish a new projection version rather than silently reinterpret stored v1 offsets. Unknown projection versions must fail closed in any future parser/consumer.

Rollback removes the new selector API while leaving the pre-existing ProseMirror revision-scoped selection evidence intact. Rollback does not authorize a host to reinterpret existing v1 W3C selectors as ProseMirror coordinates.

## Verification

Permanent tests cover astral Unicode code points, bidirectional multi-block logical order, U+FFFC leaf-node projection, combining-mark grapheme rejection, unavailable-segmenter failure, same-state atomicity under delayed hashing, frozen evidence, pre-editor null behavior, and absence of source text in ordinary evidence. The repository's exact 100% owned production coverage gate applies to the implementation.

## References — APA 7th

Ecma International. (2026). *ECMA-402: ECMAScript 2026 internationalization API specification* (13th ed.). https://ecma-international.org/publications-and-standards/standards/ecma-402/

ProseMirror. (n.d.). *ProseMirror reference manual*. Retrieved August 10, 2026, from https://prosemirror.net/docs/ref/

World Wide Web Consortium. (2017, February 23). *Web Annotation Data Model*. https://www.w3.org/TR/annotation-model/
