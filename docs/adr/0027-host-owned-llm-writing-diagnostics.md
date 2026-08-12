# ADR 0027: Host-owned, revision-bound LLM writing diagnostics

Status: Proposed

## Context

Inkspan already provides deterministic authoring, revision evidence, revision-scoped W3C `TextPositionSelector` evidence, guarded restore, and a host-owned model-assistance boundary. Host applications now need a Grammarly-like writing-guidance surface that can underline a passage, explain a problem, propose a replacement, let the author apply or ignore it, and keep every suggestion bound to the exact document revision from which it was produced.

The requested quality judgments include spelling, grammar, clarity, concision, discourse structure, workplace pragmatics, audience appropriateness, technical precision, actionability, and preservation of the author's intended request. These are contextual language judgments. Fixed keyword lists, regular-expression phrase detectors, domain-suffix lists, hand-written “aggressive phrase” tables, and positional repair rules cannot establish those meanings and create brittle false positives and false negatives across paraphrases, quotations, languages, and recipient contexts.

Inkspan must remain a modular editor. It must not gain email semantics, tenant policy, model credentials, network transport, an LLM provider dependency, or authority to decide whether a sentence is appropriate. At the same time, hosts should not have to scrape ProseMirror DOM nodes or maintain a private editor fork to display revision-safe diagnostics.

## Alternatives considered

- **Host-specific DOM overlays over Inkspan.** Rejected because DOM offsets are not a supported document contract, become stale after ProseMirror transactions, fragment keyboard and screen-reader behavior, and force every host to rebuild decorations, navigation, application, conflict handling, and undo semantics.
- **A deterministic keyword or regex checker inside Inkspan.** Rejected because lexical triggers are not evidence of grammar, intent, tone, pragmatics, or technical correctness. Deterministic code may validate data shape and document coordinates, but it may not manufacture semantic judgments.
- **Inkspan invokes an LLM directly.** Rejected because the editor would acquire provider, credential, network, privacy, retention, availability, model-routing, and tenant-policy responsibilities that belong to the host.
- **The host sends whole-document rewrites and calls `setValue`.** Rejected because whole-document replacement obscures individual reasons, weakens author control, destroys revision-local review evidence, and makes accidental intent changes harder to detect.
- **Host-owned LLM judgments rendered through a generic Inkspan diagnostic contract.** Selected because it preserves Inkspan's provider-neutral deterministic core while giving every host one revision-safe, accessible writing-assistance surface.

## Decision

Inkspan will expose a generic, additive writing-diagnostic presentation and application contract. The host supplies already-produced diagnostic proposals. Inkspan validates, anchors, renders, navigates, applies, ignores, and reports actions on those proposals, but does not decide whether the prose is correct or appropriate.

A diagnostic must include, at minimum:

- a bounded opaque `diagnostic_id`;
- the exact Inkspan strong document revision used by the host's review operation;
- the declared text-projection identity and version;
- a revision-scoped W3C `TextPositionSelector` with inclusive `start` and exclusive `end` Unicode-code-point offsets;
- a bounded host-defined `category_code` and display-safe title;
- an explanation;
- an optional proposed replacement;
- an optional bounded confidence value;
- provider/workflow provenance identifiers that contain no source text or credential;
- a host policy or judge-policy version identifying how the proposal was admitted.

Inkspan may perform only deterministic validation and document operations:

- schema, type, enum, length, count, duplicate-id, and resource-bound validation;
- projection-version and strong-revision equality checks;
- Unicode-code-point and grapheme-boundary checks;
- selector range checks against the exact projected text;
- safe text/markup handling under the existing editor security policy;
- decoration mapping through local ProseMirror transactions when that mapping remains valid;
- stale-result invalidation when the declared revision or projection no longer matches;
- overlap/conflict detection between proposed replacements;
- one-action-at-a-time replacement, ordinary editor undo, and action callbacks.

Inkspan must not infer a diagnostic from keywords, regexes, phrase lists, sender domains, recipient counts, language names, or word position. Such mechanisms may validate identifiers or transport contracts, but they may not be used as a semantic fallback. If the host's model path is unavailable or returns no admitted diagnostics, Inkspan displays no fabricated judgment.

Applying a diagnostic is an explicit author action. A replacement is applied only if the current document still matches the diagnostic's expected revision or if Inkspan can prove a valid transaction-local mapping under the published lifecycle contract. A stale or ambiguous diagnostic never mutates the document. It returns a typed conflict or invalidation result so the host can request a fresh review.

Diagnostics are advisory. Inkspan does not block form submission, email sending, persistence, or export merely because diagnostics remain. A host may implement a separate product policy, but that policy is outside the editor package and cannot be inferred from Inkspan diagnostic priority or confidence.

## Ownership boundary

Inkspan owns:

- document state and serialization;
- revision and selector evidence;
- diagnostic schema validation;
- decorations and accessible suggestion navigation;
- explicit apply/ignore/dismiss actions;
- stale-result and overlap conflict handling;
- ordinary document undo and focus restoration;
- privacy-minimized action callbacks.

The host owns:

- model selection and orchestration;
- prompts, rubrics, examples, and language policy;
- source email, thread, recipient, role, and organization context;
- semantic categories, confidence calibration, acceptance policy, and abstention;
- provider credentials and data-processing approval;
- diagnostic persistence and retention;
- feedback collection, evaluation, monitoring, and human escalation;
- any send, save, or compliance gate.

## Consequences

A host can provide inline writing guidance without forking the editor. Inkspan remains usable offline and when every model provider is unavailable. The public contract becomes broader and therefore requires packed-package, standalone, collaborative, SSR, accessibility, and cross-engine evidence. Hosts must operate a real review service and cannot treat the editor as an evaluator.

The decision intentionally separates semantic authority from deterministic integrity. A model or calibrated judge may be wrong about the prose; Inkspan can still guarantee that the proposal was not silently moved to an unrelated span or applied to a different revision.

## Failure and recovery

- Missing, malformed, oversized, duplicate, unsupported-projection, or out-of-range diagnostics are rejected without document mutation.
- A provider timeout, quota error, malformed model result, or host policy abstention is represented by absence or a host-owned status outside the diagnostic list. Inkspan authoring remains available.
- A changed document invalidates stale diagnostics. Inkspan never “repairs” them by searching for keywords or selecting the nearest matching sentence.
- A safely mapped local transaction may preserve a diagnostic only when the mapping contract proves the selected range still denotes the intended content. Ambiguity invalidates it.
- Overlapping replacements are applied separately and revalidated after every mutation. “Apply all” is permitted only for an explicitly validated non-overlapping batch under one current revision.
- A collaborative remote edit follows the same invalidation rule; raw local positions are not durable Yjs anchors.

## Security and privacy impact

Diagnostics and replacements are untrusted host-controlled input. They pass through the same safe-link, inline-image, clipboard, schema, and transaction boundaries as other editor input. A diagnostic must not contain model credentials, raw provider request/response bodies, tenant identifiers not needed by the component, or hidden executable markup.

The public diagnostic contract does not require copying the selected source text. Position selectors remain revision-scoped and privacy-minimized. Hosts that add quote selectors, store explanations, or transmit the document to a model own authorization, encryption, provider data-use terms, retention, audit, and regional-processing controls.

Generic telemetry may record bounded category, action, conflict reason, latency bucket, and policy version. It must not record authored source text, suggested replacement text, full explanations, prompts, raw model output, or document envelopes by default.

## Accessibility

Diagnostics must be available without relying on color or hover. The eventual implementation must provide:

- a keyboard-reachable diagnostics summary;
- previous/next diagnostic navigation;
- an accessible name for category and affected passage;
- predictable focus movement between editor range and suggestion card;
- explicit Apply, Ignore, Dismiss, and Explain actions;
- polite status announcements after application or invalidation;
- no focus theft while new asynchronous diagnostics arrive;
- equivalent behavior in standalone and collaborative editors.

Underlines are a visual supplement, not the sole information channel.

## Compatibility and migration

The feature is additive. Existing hosts that do not pass diagnostics retain identical editor, serialization, form, persistence, and collaboration behavior. The diagnostic contract must remain optional and provider-neutral. It may be released only in a version whose package declarations, ESM/CJS outputs, React peer ranges, styles, and consumer verification expose the same contract.

No canonical document-envelope schema change is required. Diagnostics are review state, not canonical document content. Rollback removes the diagnostic props, decorations, and action surface without document migration.

## Verification

Acceptance requires tests proving:

- strict resource-bounded schema validation and duplicate rejection;
- Unicode astral characters, Korean/CJK text, combining marks, emoji, bidirectional text, and grapheme-boundary behavior;
- exact revision/projection binding;
- stale-result rejection without mutation;
- transaction mapping only when meaning-preserving range identity is provable;
- overlapping replacement conflict behavior;
- single and bounded batch application plus undo;
- safe rendering of hostile titles, explanations, and replacements;
- keyboard, focus, live-region, and screen-reader semantics;
- standalone/collaborative parity and remote-edit invalidation;
- SSR-safe initial shell and hydration;
- packed ESM/CommonJS/types/CSS consumer compatibility;
- no model SDK, credential, environment, database, or network dependency in the Inkspan package;
- no source text or replacement text in default telemetry;
- exact 100% production statement, branch, function, and line coverage and complete public API documentation.

Contract tests must also prohibit semantic keyword fallback: adversarial fixtures with identical keywords but different meanings, and paraphrases with different words but the same issue, must prove that Inkspan itself produces no judgment. It renders only host-supplied diagnostics.

## Research and standards traceability

This decision uses the W3C Web Annotation Data Model's Unicode-code-point `TextPositionSelector` semantics together with Inkspan's stronger revision binding. It treats LLM judgments as fallible measurement outputs rather than deterministic truth, consistent with published findings on position, verbosity, self-preference, artifact, multilingual, and consistency biases in LLM evaluators. The accompanying design and doctoring records contain APA 7th citations and the host-side calibration implications.

## Rollback or supersession

Rollback removes the optional diagnostic surface while preserving canonical documents, revision evidence, selection evidence, and deterministic authoring. Supersession requires a new ADR if Inkspan is ever proposed to own model invocation, semantic classification, persistence authority, or submission policy. Such a change must provide explicit provider neutrality, privacy, offline/degraded operation, accessibility, compatibility, migration, and rollback evidence.