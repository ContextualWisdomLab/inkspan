# ADR 0028: Strict invalidation and semantic-neutral accessibility for writing diagnostics v1

Status: Proposed

## Context

ADR 0027, its design specification, and its implementation plan established the correct high-level boundary: hosts own every semantic writing judgment while Inkspan owns deterministic validation, revision/selector integrity, presentation, accessibility, and ordinary editor transactions.

Two lower-level clauses nevertheless permitted incompatible first-release interpretations:

1. some prose allowed a diagnostic to survive a local transaction when ProseMirror mapping appeared valid, while the implementation plan's global contract required every local or collaborative document change to invalidate every active diagnostic; and
2. the decoration plan proposed `aria-invalid="spelling"` when a host category “maps to mechanics,” although `categoryCode` is deliberately opaque and the v1 contract contains no explicit semantic accessibility field.

Leaving those ambiguities unresolved would force implementers either to invent semantic mapping from an opaque string or to maintain two competing stale-diagnostic lifecycles.

## Alternatives considered

### Preserve diagnostics through transaction mapping

Rejected for v1. ProseMirror can map structural positions, but position continuity does not prove that a host model's semantic judgment still applies to changed prose. This also conflicts with the already implemented controller/decorations direction and complicates collaborative edits, asynchronous digest races, application revalidation, testing, and host refresh ownership.

### Derive ARIA validity from `categoryCode`

Rejected. `categoryCode` is host-defined opaque metadata. Comparing it with strings such as `spelling`, `grammar`, `mechanics`, or language-specific equivalents would be the semantic keyword fallback that ADR 0027 explicitly prohibits.

### Add an explicit semantic ARIA enum to v1

Deferred. A future version may add a bounded, explicitly declared accessibility semantic if evidence shows that decoration-level `aria-invalid` is interoperable and useful across supported browser/assistive-technology combinations. That addition requires its own versioned contract, tests, compatibility review, and ADR.

### Strictly invalidate on every document change and keep decorations semantically neutral

Selected for v1 because it is deterministic, explainable, provider-neutral, privacy-minimized, compatible with the existing implementation stack, and safe under both standalone and collaborative editing.

## Decision

For writing diagnostics v1:

- every transaction with `docChanged === true`, whether local or collaborative, invalidates the complete active diagnostic generation before any further display or mutation authority can be used;
- no diagnostic range is preserved, remapped, repaired, or re-admitted through ProseMirror mapping, nearest-text search, quote search, keyword search, or semantic guessing;
- a host that wants current guidance after a document change must submit a new diagnostic set bound to a newly derived exact document revision;
- final application still performs exact current-state verification under the implementation plan, but mapping is not an alternate admission path;
- inline decorations contain static Inkspan classes, priority styling, and an opaque diagnostic identifier only;
- Inkspan does not derive `aria-invalid`, spelling/grammar state, or any other semantic accessibility assertion from `categoryCode`, title, explanation, replacement, confidence, provenance, or source text;
- category, priority, title, explanation, and actions remain available as plain text in the named diagnostics panel, while underlines are a visual supplement rather than the sole information channel.

This ADR narrows and supersedes only the conflicting lifecycle and decoration-accessibility clauses in ADR 0027, the 2026-08-12 design specification, and the original implementation plan. Their product/host/model authority, security, privacy, revision, packaging, and release decisions remain in force.

## Consequences

### Positive

- one lifecycle applies to local edits, remote edits, digest races, focus, action callbacks, and replacement application;
- no hidden semantic classifier is introduced into Inkspan;
- stale diagnostics fail closed without pretending position continuity proves meaning continuity;
- hosts receive a clear refresh responsibility;
- accessibility remains complete through explicit panel text and actions without unsupported semantic ARIA claims.

### Trade-offs

- even an unrelated document edit invalidates all active diagnostics in v1;
- hosts may perform more review refreshes;
- Inkspan does not preserve diagnostic continuity across edits until a future, separately governed evidence model exists.

These costs are accepted because deterministic invalidation is safer and easier to validate than a partially semantic remapping policy.

## Failure and recovery

- A document-changing transaction clears active decorations and marks the generation stale.
- A digest or selector result completing for an invalidated generation is discarded.
- Apply/ignore/dismiss/explain operations against a missing or stale generation return typed non-mutating results.
- The host may recover only by supplying a newly admitted diagnostic set for the current exact revision.
- No offline or model-unavailable fallback fabricates a diagnostic.

## Security and privacy impact

The decision prevents opaque host category strings from gaining semantic execution or accessibility authority. It also prevents stale model output from being moved onto changed content. No additional authored text, replacement text, prompt, model output, tenant identifier, provider credential, or document envelope enters telemetry or DOM attributes.

## Accessibility impact

The panel must expose a named region, count, ordered list, category, priority, title, explanation, affected-range navigation, and explicit Apply/Ignore/Dismiss/Explain controls. Information must remain available without color, hover, pointer input, animation, or generated CSS content. Asynchronous arrival must not steal focus. An assertive alert is reserved for an actual application conflict; ordinary actions use polite status messaging.

## Compatibility and migration

The decision is additive to hosts that do not enable writing diagnostics. Diagnostics remain noncanonical review state, so no document-envelope, persistence, collaboration, or database migration is required. Existing Task 1–4 implementation work already follows strict invalidation and, after the corresponding runtime correction, semantic-neutral decoration behavior. Downstream tasks must consume the same exact contract; predecessor checks and reviews do not transfer after any stack refresh.

A future public contract may add explicit accessibility semantics or evidence-backed diagnostic continuity only through a new versioned type and compatibility plan. Opaque v1 category strings do not acquire new meaning retrospectively.

## Verification

Acceptance requires deterministic tests proving:

- local and Yjs remote `docChanged` transactions invalidate the complete generation;
- no transaction mapping preserves diagnostics in v1;
- stale asynchronous work cannot install decorations or emit actions;
- decoration attributes contain no title, explanation, replacement, category text, model output, HTML, or derived semantic ARIA state;
- diagnostics with category codes such as `spelling`, `grammar`, `mechanics`, multilingual equivalents, or attacker-controlled lookalikes receive identical semantic-neutral decoration handling;
- the accessible panel exposes host strings as text and remains usable without visual-only cues;
- Inkspan produces no diagnostic when the host supplies none.

## Rollback or supersession

Rollback removes the optional diagnostic surface without altering canonical document envelopes, revisions, persistence records, collaboration data, or host storage. The host simply stops supplying diagnostics and the editor retains its ordinary deterministic behavior.

A future diagnostic-continuity design may supersede strict invalidation only with a versioned evidence model that proves target identity across changes, defines standalone/collaborative parity, contains privacy and accessibility semantics, and passes cross-engine and realistic semantic-integrity validation. A future semantic ARIA field likewise requires an explicit typed contract rather than inference from opaque strings.
