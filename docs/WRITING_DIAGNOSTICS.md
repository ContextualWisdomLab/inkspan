# Writing diagnostics

Status: Active PR / Proposed

Writing diagnostics are a host-supplied, revision-bound review surface for local Inkspan authoring. This document describes the active writing-diagnostics stack only; it is not protected-main authority until the owning stack integrates under then-live governance. The same deterministic boundary covers collaborative editing and remains safe for server rendering without acquiring host authority.

## Authority model

### Host semantic authority

The host decides whether to request diagnostics, which provider or deterministic service to use, what text may leave the host boundary, and which proposed observations are admissible for presentation. The host owns model/provider selection, credentials, authorization, tenant isolation, redaction, retention, prompt and response logging, external-data-use policy, semantic policy, audit, and any human-review requirement.

Confidence, priority, and category are host labels, not editor truth or submission policy. Model or service output is untrusted proposal data. Diagnostics never block submission, sending, persistence, export, or collaboration.

### Inkspan deterministic integrity

Inkspan validates the bounded diagnostic envelope, binds accepted diagnostics to the document revision supplied by the host, projects deterministic text positions, renders inert proposal data, and applies only explicitly selected deterministic editor actions after rechecking the current revision. The framework-neutral package surface is `@contextualwisdomlab/cwl-editor/writing-diagnostics`.

Inkspan performs no grammar, tone, clarity, pragmatics, technical-quality, actionability, sender, recipient, language, or policy inference. No keyword, regex, phrase-list, language-name, sender-domain, recipient-count, nearest-text, quote-search, or word-position fallback is permitted.

## Revision and invalidation contract

Every local or collaborative transaction with docChanged === true invalidates the complete active diagnostic generation. This intentionally favors stale-proposal rejection over attempting semantic re-anchoring. Hosts may request a new generation against the new revision.

Focus is allowed only after the controller verifies that the diagnostic belongs to the current revision and resolves its already-validated text-position range. If the editor is unavailable or the revision no longer matches, the action fails closed rather than guessing another range.

Version 1 applies exactly one explicitly selected diagnostic at a time. Focus, Apply, Ignore, Dismiss, and Explain are discrete author actions; none grants semantic or authorization authority to Inkspan. Apply mutates only the selected accepted proposal through the existing editor transaction boundary. Ignore and Dismiss affect local diagnostic presentation state, not source-of-truth document semantics. Explain may expose host-supplied explanatory proposal data but does not create a model call inside Inkspan.

## Hostile input and privacy

Diagnostic objects, strings, HTML-like content, getters, Proxies, and callback failures are untrusted. Contract validation is bounded and fail-closed; public errors are payload-redacted. Authored text, provider messages, file names, URLs, credentials, and private thrown values are not reflected into ordinary public diagnostics errors.

Browser presentation uses text-safe rendering rather than granting diagnostic content executable markup authority. Rejected, aborted, malformed, stale, or unavailable diagnostic responses do not trigger lexical or positional fallback behavior.

The privacy boundary is deliberately narrow: Inkspan needs only the accepted bounded proposal fields required to render and deterministically act on a diagnostic. The host remains responsible for deciding whether text can be sent to any external service and for downstream retention, logging, tenant, and access-control policy.

## Collaborative editing

Collaborative editing does not change semantic ownership. Yjs/provider transport, room authorization, awareness privacy, lifecycle, durable persistence, and audit remain host-owned. A collaborative document transaction that changes the document invalidates the current generation exactly like a local document transaction. Remote presence or awareness metadata is never diagnostic authorization evidence.

## Server rendering and packaging

The framework-neutral validation/projection package must remain importable without React UI, browser DOM, Yjs, a model SDK, credentials, network access, persistence, naruon, or contextual-orchestrator. Server rendering must not initialize provider, collaboration, model, or browser authority merely because the package is imported. Browser-only interaction begins only in the explicit editor/UI layer.

Packed-package verification is expected to exercise ESM, CommonJS, strict TypeScript, server-rendering-safe imports, and authority scans for the public subpath.

## Accessibility and interaction

The presentation layer must keep diagnostics keyboard reachable, preserve visible focus, tolerate 200% scaling and forced-colors behavior, and expose status changes without using visual styling as the only state signal. Touch interaction is detected by capability rather than viewport width. Browser assurance should cover the supported Chromium, Firefox, WebKit, and mobile interaction paths before integration claims are made.

## Failure handling and rollback

Malformed or hostile diagnostics fail closed without manufacturing a substitute proposal. A rejected host request, aborted route, unavailable editor, stale revision, failed deterministic action, or callback exception must not grant additional authority or silently mutate the document.

Rollback for an applied diagnostic uses the editor's ordinary deterministic undo/revision semantics; Inkspan does not maintain a parallel semantic history. Hosts own durable recovery, persistence rollback, audit reconciliation, and regeneration policy. If package or browser assurance regresses, the safe rollback is to remove or disable the active-PR diagnostics integration while preserving standalone authoring and the framework-neutral package boundary.

## Claim boundary

This guide is canonical for the active diagnostics stack only when its owning branch is the current source. Protected `main` remains shipped truth. Tests, PR prose, browser runs, model verdicts, and status checks are evidence for an exact source generation; they do not by themselves promote this active-PR behavior to protected-main authority.
