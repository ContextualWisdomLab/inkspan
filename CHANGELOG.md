# Changelog

All notable changes to **Inkspan** (`@contextualwisdomlab/cwl-editor`) are documented in this file.

Historical release entries from **0.1.0 through 0.5.27** are preserved verbatim in [`docs/changelog/CHANGELOG-0.1.0-0.5.27.md`](docs/changelog/CHANGELOG-0.1.0-0.5.27.md). This active file remains intentionally bounded so current release evidence is easy to review during operations and acquisition diligence.

## [Unreleased]

### Security
- Added a fail-closed draft release asset inventory gate that requires exactly one npm tarball, one Office wheel, and `SHA256SUMS`, rejects stale or unexpected draft assets before immutable publication, and verifies every GitHub-reported `sha256:` asset digest against the transferred local file

### Accessibility
- Added programmatic toolbar shortcut discoverability with WAI-ARIA `aria-keyshortcuts` for the implemented bold, italic, link, undo, and redo commands, preserving the same native-button behavior, visible labels, roving focus model, and host-owned shortcut-conflict policy
- Completed redo shortcut metadata with `Control+Shift+Z Meta+Shift+Z Control+Y Meta+Y`, matching the configured Tiptap history and collaboration behavior and exposing both `Ctrl/Cmd+Shift+Z` and `Ctrl/Cmd+Y` alternatives without adding new key handling
- Corrected extension-scoped review evidence after exact-head repository review found the existing editor-surface `Ctrl/Cmd+K` link binding in `EditorFrame`; the link button now truthfully exposes `Control+K Meta+K` while the Tiptap Link extension itself remains documented as having no default shortcut
- Preserved buyer-facing README guidance within the same validated safe-link command boundary and moved the shortcut-specific behavior contract to the authoritative accessibility and doctoring records so it is not misattributed to Tiptap
- Added deterministic regression and documentation contracts plus APA 7th doctoring for exact `Control`/`Meta` shortcut alternatives, the descriptive-only accessibility boundary, repository-level shortcut verification, and omission of unsupported shortcut claims

### Documentation
- Added a repository-native security disclosure and vulnerability-handling policy with supported pre-1.0 release lines, private GitHub Security Advisory routing and safe public fallback, minimized evidence guidance, explicit Inkspan-versus-host ownership boundaries, no-SLA and non-conformance claim limits, deterministic documentation tests, and APA 7th doctoring grounded in current ISO/IEC 29147:2018, ISO/IEC 30111:2019, final NIST SP 800-218 SSDF 1.1, the draft-status boundary for SSDF 1.2, and GitHub primary documentation
- Added an authoritative standalone and modular MSA architecture contract with reviewable deployment, optimistic-concurrency, data-ownership, security, and acquisition-evidence diagrams and tables
- Added a beginner-readable naruon compose and ui.panel integration guide covering narrow client hydration, server-selected strong validators, accessible conflict handling, host-owned Yjs lifecycle, contextual-orchestrator boundaries, and local-versus-shareable evidence
- Added an opaque editing-context remount for the complete editor and autosave example, latest-generation asynchronous capture ordering, encoded document path segments, redacted recovery status, and lazy state-owned session identity to prevent cross-document state reuse
- Bounded the host save example with a fresh abort deadline, exposed authenticated conflict recovery through `session.resume(...)`, generated an instance-unique accessible heading relationship, and strengthened fenced-TSX ordering contracts
- Added stale-generation conflict recovery and operational save failure recovery through one reason-aware single-flight host workflow, so newer local edits cannot hide or duplicate recovery while retained work remains blocked; rejected or malformed resume attempts retain the same recovery surface until a valid resume succeeds or the editing context is disposed
- Added exact-head read-only CI with fixed Ubuntu 24.04 runners, immutable action pins, explicit contributor-head checkout, disabled persisted Git credentials, and a documented merge-result compatibility boundary
- Added deterministic documentation contract tests and APA 7th doctoring grounded in RFC 9110, WCAG 2.2, NIST SP 800-204, NIST SP 800-204D, OWASP ASVS 5.0.0, React, current Next.js App Router guidance, and GitHub Actions primary documentation

## [0.5.29] — 2026-08-05

### Added
- Added `createDocumentAutosaveSession()` to bind every single-flight save to the exact server-issued strong entity tag loaded or last committed by the host, without adding transport, persistence, credentials, tenancy, or provider coupling
- Added `isStrongHttpEntityTag()` for fail-closed RFC 9110 quoted opaque-tag validation without trimming or repair
- Added immutable durable save request, result, session, recovery, and document-free snapshot contracts to the framework-independent `autosave` package surface

### Changed
- Package version **0.5.29**
- Package discovery metadata identifies the server-validator-bound durable autosave session alongside the lower-level single-flight coordinator

### Reliability
- Successful durable writes advance the next `If-Match` base only from the host callback's validated server-selected replacement tag
- Conflict, malformed result, hostile reflection, promise-assimilation failure, and transport failure preserve the previous durable validator until explicit authenticated recovery supplies a new strong tag
- Retained work resumes only after `resume(nextStrongEntityTag)` installs the recovered durable base before the next callback begins
- Recovery validators are validated consistently before lifecycle inspection; a valid no-op resume cannot replace the current durable base, and an unexpectedly declined blocked transition restores the previous validator
- Malformed recovery validators raise the dedicated public `invalid_recovery_validator` code and redacted recovery message instead of being misclassified as malformed session-construction options
- `flush()` reacquires the current terminal queue state after asynchronous wrapper boundaries, following recovery or shutdown races until lifecycle fields and `durableStrongEntityTag` describe one coherent idle, blocked, or closed logical moment

### Security
- Initial and replacement durable validators reject weak, unquoted, whitespace-containing, list, wildcard, control-character, and out-of-range values before they can enter host transport
- Callback results are exact-shape validated through property descriptors; document bodies, validators, callback values, and private exceptions never enter public error messages
- Session snapshots remain frozen and document-free; entity tags are tenant-confidential equality metadata rather than authorization, signatures, tenant membership, or durable audit evidence

### Tests
- Added deterministic sequential and concurrently queued validator handoff, conflict recovery, lifecycle-independent recovery validation, malformed option, missing and symbol-keyed option, malformed callback result, hostile reflection, promise assimilation, transport failure, frozen request, shutdown, and snapshot tests under repository-wide 100% production statement and branch coverage gates
- Added explicit regression cases for control characters, out-of-range Unicode, list-form values, wildcards, no-op recovery, and recovered-validator installation before retained work starts
- Added deterministic recovery-before-wrapper and close-before-wrapper concurrency regressions that prevent temporally mixed public flush snapshots
- Extended isolated packed-artifact ESM, CommonJS, and strict TypeScript consumers to prove the durable session and strong-tag validator work without React, React DOM, TipTap, ProseMirror, or Yjs installed
- Added release evidence that binds the version, changelog, scope, ownership boundary, acceptance gates, and rollback policy for 0.5.29

### Documentation
- Added buyer-visible autosave onboarding, explicit `autosave` and `revision-evidence` distribution surfaces, and npm persistence discovery metadata
- Corrected the autosave onboarding so initial and replacement validators are checked before use and come from the durable host's server-issued strong `ETag` rather than local revision evidence; missing, weak, or malformed validators fail closed in the example
- Documented that host-owned save callbacks must apply their own timeout or abort signal because an unresolved callback intentionally retains the active single-flight operation; retry policy remains host-owned
- Added a deterministic repository contract test and APA 7th-style doctoring for README, npm-search, Node.js package-export discoverability, RFC 9110 validator ownership, and quoted opaque-tag syntax
- Added operator, doctoring, and release evidence for the durable autosave session, coherent recovery-time flush snapshots, host ownership boundaries, exact-head verification, and acquisition-review scope

## [0.5.28] — 2026-08-05

### Added
- Framework-independent `@contextualwisdomlab/cwl-editor/autosave` ESM, CommonJS, and TypeScript package subpath
- `createDocumentAutosaveQueue()` for provider-neutral single-flight ordering of immutable `CwlEditorDocumentRevisionEvidence`
- Frozen saved, unchanged, superseded, conflict, closed, lifecycle snapshot, and redacted error contracts
- Beginner-oriented operator guidance for durable base-revision tracking, authenticated atomic RFC 9110 `If-Match`, conflict recovery, shutdown, privacy, and ownership boundaries

### Changed
- Package version **0.5.28**
- Concurrent nonterminal `flush()` calls now share one pending promise, bounding internal waiter retention independently of polling frequency
- The package build now emits dedicated `dist/cwl-autosave.js`, `dist/cwl-autosave.cjs`, and `dist/autosave/index.d.ts` artifacts
- Historical changelog entries through 0.5.27 moved intact to the versioned archive linked above

### Reliability
- Exactly one host save callback can be active; a newer revision can replace only not-yet-started work and never cancels or overlaps an active durable write
- Same-revision active and pending callers share one outcome; an idle revision is `unchanged` only while the queue still knows it is durably current and no active or pending write can replace it
- A conflict, callback failure, or invalid callback result invalidates the unchanged shortcut across `resume()` until a later host callback reports a successful durable save
- Conflict and failure pause automatic progression until an explicit host recovery decision
- `flush()` resolves at idle, blocked, or closed state rather than hanging for an external conflict decision; `close()` rejects new work while allowing active host transport to finish
- Queue memory is bounded to one active request, one pending request, and one shared pending flush promise

### Security
- Evidence and callback outcomes are validated fail-closed without evaluating accessors; hostile reflection failures become bounded redacted errors
- The public autosave boundary traverses candidate document JSON iteratively before scheduling, rejecting mutable nested nodes, accessors, symbols, non-finite numbers, unsupported prototypes, aliases, cycles, sparse arrays, excessive nesting, and values beyond the active envelope resource ceiling
- Partially frozen look-alike evidence cannot enter the host callback and mutate after its strong revision was selected
- The queue includes no timer, network client, provider SDK, credential, tenant identifier, persistence adapter, React, TipTap, ProseMirror, or Yjs runtime dependency
- Revision tags remain tenant-confidential equality validators rather than authorization, signatures, tenant membership, or proof of durable persistence
- Hosts retain authentication, authorization, tenant isolation, transport, credentials, durable atomic base-revision comparison, migration, retention, audit storage, retry budgets, and conflict-resolution policy

### Performance
- Autosave coordination performs constant-space local scheduling and retains at most one pending full-document evidence value
- Matching active or pending revisions and concurrent flush callers avoid duplicate callback or internal waiter allocation
- Evidence inspection uses an iterative traversal bounded to the active envelope's 1,000,000-value and 128-level default ceilings, avoiding recursive call-stack growth on hostile inputs

### Tests
- Added deterministic single-flight, re-entrant enqueue, pending supersession, same-revision coalescing, durable-shortcut invalidation, last-saved ordering, blocked durable requeue, conflict pause/resume, callback failure recovery, invalid result, shutdown, frozen-value, hostile-reflection, bounded-flush-waiter, and repository-wide 100% production statement/branch coverage verification
- Added realistic adversarial evidence tests for partially frozen document nodes, getters, reflection failures, aliases, cycles, sparse and accessor arrays, unsupported prototypes, non-JSON primitives, excessive depth, and the maximum JSON-value boundary
- Added exact packed-artifact ESM, CommonJS, and strict TypeScript consumers in an isolated temporary package tree without React, React DOM, TipTap, ProseMirror, or Yjs installed; the packed ESM consumer also proves that mutable nested evidence is rejected before transport

### Documentation
- Added the autosave architecture and doctoring record with APA 7th references to RFC 9110, RFC 8785, Herlihy and Wing (1990), and ISO/IEC 25010:2023
- Added an operator guide covering correct durable-base `If-Match` usage, local versus durable ownership, SSR/worker compatibility, observability minimization, and CWL/naruon modular integration boundaries
