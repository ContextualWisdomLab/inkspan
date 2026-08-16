# ADR 0028: Host-owned, revision-bound writing diagnostics

Status: Proposed

## Context

Inkspan already provides deterministic authoring, revision evidence, revision-scoped W3C `TextPositionSelector` evidence, guarded restore, and a host-owned model-assistance boundary. Host applications need a Grammarly-like writing-guidance surface that can mark a passage, explain a concern, propose a replacement, let the author act explicitly, and keep every proposal bound to the exact document revision reviewed by the host.

Spelling, grammar, clarity, concision, discourse structure, workplace pragmatics, audience appropriateness, technical precision, actionability, and preservation of author intent are contextual language judgments. Fixed keyword lists, regular-expression phrase detectors, domain-suffix lists, hand-written phrase tables, opaque category names, and positional repair rules cannot establish those meanings across paraphrases, quotations, languages, and recipient contexts.

Inkspan must remain a modular editor. It must not gain email semantics, tenant policy, model credentials, network transport, an LLM provider dependency, persistence authority, or authority to decide whether prose is appropriate. Hosts likewise should not have to scrape ProseMirror DOM nodes or maintain private editor forks to display revision-safe guidance.

## Alternatives considered

- **Host-specific DOM overlays.** Rejected because DOM offsets are not a supported document contract, become stale after transactions, fragment keyboard/screen-reader behavior, and force each host to rebuild navigation, application, conflict handling, and undo semantics.
- **A deterministic keyword or regex checker inside Inkspan.** Rejected because lexical triggers are not evidence of grammar, intent, tone, pragmatics, or technical correctness. Deterministic code may validate shape and coordinates but may not manufacture semantic judgments.
- **Inkspan invokes an LLM directly.** Rejected because the editor would acquire provider, credential, network, privacy, retention, availability, routing, and tenant-policy responsibilities that belong to the host.
- **The host sends whole-document rewrites.** Rejected because replacement obscures individual reasons, weakens author control, destroys revision-local evidence, and makes unintended meaning changes harder to detect.
- **Preserve diagnostics by mapping ranges across edits.** Rejected for v1 because structural position continuity does not prove that a host semantic judgment remains current after content changes.
- **Host-owned judgments through a generic Inkspan diagnostic contract.** Selected because it preserves Inkspan's provider-neutral deterministic core while giving every host one revision-safe, accessible presentation and action surface.

## Decision

Inkspan will expose an additive writing-diagnostic contract. The host supplies already-produced proposals. Inkspan validates, revision-binds, resolves, renders, navigates, applies one selected replacement, ignores, dismisses, requests an explanation, and reports privacy-minimized action evidence. Inkspan does not decide whether prose is correct or appropriate.

A v1 diagnostic includes:

- a bounded opaque `diagnosticId`;
- an exact `CwlEditorDocumentRevision` for the reviewed immutable snapshot;
- an exact `CwlEditorTextProjectionIdentity`;
- a W3C `TextPositionSelector` using inclusive `start` and exclusive `end` Unicode-code-point offsets;
- an opaque bounded `categoryCode`;
- one of `advisory`, `important`, or `critical` presentation priority;
- a plain-text title and explanation;
- an optional plain-text replacement;
- optional finite confidence in `[0, 1]`; and
- privacy-minimized workflow/judge-policy provenance identifiers with no source text, credential, or raw model output.

Selector values are non-negative safe integers with `start <= end`. Collapsed selectors are valid evidence and remain navigable, but create no inline range decoration.

Inkspan performs only deterministic validation and editor operations:

- exact schema/type/enum/length/count/duplicate/resource validation;
- rejection of accessors, prototypes, symbols, extra fields, sparse arrays, and hostile reflection;
- projection-version and strong-revision checks;
- Unicode-code-point and grapheme-boundary checks;
- exact selector resolution against one immutable projected snapshot;
- safe plain-text rendering and replacement handling;
- stale-generation rejection;
- one-action-at-a-time replacement, ordinary undo, and privacy-minimized action callbacks.

Every local or collaborative transaction with docChanged === true invalidates the complete active diagnostic generation.

No diagnostic is preserved, mapped, remapped, repaired, or re-admitted through ProseMirror mapping, Yjs relative positions, nearest-text search, quote search, keyword search, or semantic guessing. A host that wants current guidance after an edit supplies a new set bound to a newly derived exact revision.

Version 1 applies exactly one explicitly selected diagnostic at a time. Immediately before mutation, Inkspan derives and compares the exact current revision again. A stale, missing, invalid, or ambiguous proposal never mutates the document. Successful application uses one ordinary ProseMirror transaction, normal undo history, a resulting revision derived from the post-transaction document, and complete invalidation of the remaining generation.

Inkspan does not derive aria-invalid or any other semantic accessibility state from opaque host strings. Inline decorations contain static Inkspan classes, priority styling, and an opaque identifier only. Category, priority, title, explanation, and actions are available as text and native controls in the named diagnostics panel.

Diagnostics are advisory. Inkspan does not block form submission, sending, persistence, export, or collaboration merely because diagnostics remain. A host may implement separate product policy outside the editor package.

## Ownership boundary

Inkspan owns:

- deterministic document state and serialization;
- revision/projection/selector validation;
- strict diagnostic schema and resource validation;
- semantic-neutral decorations and accessible diagnostic navigation;
- explicit Focus, Apply, Ignore, Dismiss, and Explain actions;
- strict stale-generation invalidation;
- ordinary document transactions, undo, and predictable focus behavior;
- privacy-minimized action events and redacted errors.

The host owns:

- model selection, orchestration, prompts, rubrics, examples, and language policy;
- source email/thread/recipient/role/organization context;
- semantic categories, confidence calibration, acceptance policy, and abstention;
- provider credentials and data-processing approval;
- diagnostic persistence, retention, evaluation, monitoring, and escalation;
- any send, save, compliance, or submission gate.

## Consequences

A host can provide inline writing guidance without forking the editor. Inkspan remains usable offline and when every model provider is unavailable. The public contract becomes broader and requires packed-package, standalone, collaborative, SSR, accessibility, concurrency, hostile-input, and cross-engine evidence.

The design separates semantic authority from deterministic integrity. A host model may be wrong about prose; Inkspan can still prove that the proposal was admitted for one exact snapshot, was not moved onto changed content, and was not applied after the document changed.

Strict invalidation may require more host refreshes, including after unrelated edits. This cost is accepted because v1 cannot prove semantic continuity through structural mapping.

## Failure and recovery

- Missing, malformed, oversized, duplicate, unsupported-projection, or invalid-selector input is rejected without document mutation.
- Provider timeout, quota failure, malformed model result, or policy abstention remains host-owned absence/status; Inkspan authoring stays available.
- Any local or remote document change invalidates the complete generation before further action authority exists.
- Async digest/selector work from an invalidated generation is discarded.
- Apply/Ignore/Dismiss/Explain against a missing or stale generation returns typed non-mutating evidence.
- Host callback exceptions are contained and cannot corrupt editor state.
- Recovery is a newly supplied diagnostic set for the current exact revision. Inkspan never fabricates a fallback judgment.

## Security and privacy impact

Diagnostics and replacements are untrusted host-controlled input. The exact data-property boundary rejects executable or ambiguous object shapes. Host strings render as text; v1 accepts no HTML, JavaScript, command, arbitrary TipTap JSON, arbitrary transaction, or embedded host callback.

The contract does not require copying selected source text. Revision and selector evidence is privacy-minimized. Hosts transmitting documents to a model own authorization, encryption, provider data-use terms, retention, audit, regional processing, and consent.

Default action events may contain only opaque identifier, exact revision evidence, opaque category, generation, action, and bounded reason code. They do not contain authored source text, replacement text, explanation, prompt, raw model output, document envelope, credential, email recipient, or tenant identifier.

Opaque values that happen to contain words such as `spelling`, `grammar`, `mechanics`, `rude`, `incorrect`, or multilingual equivalents gain no semantic behavior or ARIA authority.

## Accessibility

Diagnostics are available without relying on color, hover, pointer input, animation, or generated CSS content. The built-in panel provides:

- a named region, count, and ordered list;
- category, priority, title, and explanation as text;
- previous/next navigation and explicit affected-range focus;
- native Apply, Ignore, Dismiss, and Explain actions;
- disabled Apply when no replacement exists;
- polite status after ordinary actions;
- an assertive alert only for an actual application conflict;
- stable focus when async diagnostics arrive; and
- standalone/collaborative parity.

Underlines are a visual supplement, not the semantic accessibility surface.

## Compatibility and migration

The feature is additive. Hosts that omit diagnostics retain identical editor, serialization, form, persistence, export, and collaboration behavior. The diagnostic contract remains optional and provider-neutral.

No canonical document-envelope or database migration is required because diagnostics are noncanonical review state. A future explicit semantic accessibility field or cross-edit continuity model requires a new versioned type, compatibility plan, and ADR; v1 opaque fields gain no retrospective meaning.

The feature may be released only when root and framework-neutral subpaths, ESM/CommonJS/types/CSS, React peer compatibility, package consumers, SSR, browser evidence, and rollback contracts agree.

## Verification

Acceptance requires tests proving:

- strict exact-field/resource validation, duplicate rejection, and hostile-reflection containment;
- Unicode astral, Korean/CJK, combining, emoji, bidirectional, grapheme, empty, and collapsed selector behavior;
- exact revision/projection binding and one-snapshot selector resolution;
- local and Yjs remote `docChanged` invalidation;
- no transaction mapping, nearest-text, quote, keyword, or semantic repair;
- no semantic ARIA derivation from opaque host fields;
- one selected replacement only, exact pre-mutation recheck, ordinary undo, and resulting revision;
- safe text rendering of hostile titles, explanations, categories, identifiers, and replacements;
- keyboard/focus/status/alert/non-color accessibility;
- standalone/collaborative parity and no awareness publication;
- SSR/hydration and packed ESM/CommonJS/types/CSS compatibility;
- no model SDK, credential, environment, database, filesystem, or network dependency in the package;
- no authored/model text in default action evidence or telemetry;
- exact 100% owned production statement, branch, function, and line coverage plus complete public documentation.

Contrast fixtures with identical keywords but different meanings, and paraphrases with different words but the same issue, must prove that Inkspan produces zero diagnostics unless the host supplies them.

## Research and standards traceability

The decision uses W3C Web Annotation Data Model Unicode-code-point `TextPositionSelector` semantics together with stronger exact revision binding. It uses ProseMirror/TipTap immutable state and transaction contracts, RFC 9110 strong entity-tag semantics, and the existing Inkspan deterministic-versus-model-assisted authoring boundary. LLM judgments remain fallible host evidence rather than editor truth; the companion doctoring record contains APA 7 references and calibration implications.

## Rollback or supersession

Rollback removes optional diagnostic props, controller state, decorations, panel, styles, and action APIs while preserving canonical documents, revisions, persistence, and collaboration data.

Supersession requires a new ADR if Inkspan is proposed to own model invocation, semantic classification, persistence authority, submission policy, semantic ARIA inference, cross-edit diagnostic continuity, or batch application. Such a change must provide provider neutrality, privacy, offline/degraded operation, accessibility, compatibility, migration, recovery, and rollback evidence.
