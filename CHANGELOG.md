# Changelog

All notable changes to **Inkspan** (`@contextualwisdomlab/cwl-editor`) are documented in this file.

Historical release entries from **0.1.0 through 0.5.27** are preserved verbatim in [`docs/changelog/CHANGELOG-0.1.0-0.5.27.md`](docs/changelog/CHANGELOG-0.1.0-0.5.27.md). This active file remains intentionally bounded so current release evidence is easy to review during operations and acquisition diligence.

## [Unreleased]


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
- Same-revision active and pending callers share one outcome; an already durable revision is `unchanged` only while no active or pending write can replace it
- A previously durable revision is retained for another save when a different active or pending write, or an ambiguous callback failure, can make the durable state uncertain or supersede it
- Conflict, callback failure, and invalid callback results pause automatic progression until an explicit host recovery decision
- `flush()` resolves at idle, blocked, or closed state rather than hanging for an external conflict decision; `close()` rejects new work while allowing active host transport to finish
- Queue memory is bounded to one active request, one pending request, and one shared pending flush promise

### Security
- Evidence and callback outcomes are validated fail-closed without evaluating accessors; hostile reflection failures become bounded redacted errors
- The queue includes no timer, network client, provider SDK, credential, tenant identifier, persistence adapter, React, TipTap, ProseMirror, or Yjs runtime dependency
- Revision tags remain tenant-confidential equality validators rather than authorization, signatures, tenant membership, or proof of durable persistence
- Hosts retain authentication, authorization, tenant isolation, transport, credentials, durable atomic base-revision comparison, migration, retention, audit storage, retry budgets, and conflict-resolution policy

### Performance
- Autosave coordination performs constant-space local scheduling and retains at most one pending full-document evidence value
- Matching active or pending revisions and concurrent flush callers avoid duplicate callback or promise allocation

### Tests
- Added deterministic single-flight, re-entrant enqueue, pending supersession, same-revision coalescing, quiescent unchanged, last-saved ordering, blocked durable requeue, conflict pause/resume, callback failure recovery, invalid result, shutdown, frozen-value, hostile-reflection, bounded-flush-waiter, and repository-wide 100% production statement/branch coverage verification
- Added exact packed-artifact ESM, CommonJS, and strict TypeScript consumers in an isolated temporary package tree without React, React DOM, TipTap, ProseMirror, or Yjs installed

### Documentation
- Added the autosave architecture and doctoring record with APA 7th references to RFC 9110, RFC 8785, Herlihy and Wing (1990), and ISO/IEC 25010:2023
- Added an operator guide covering correct durable-base `If-Match` usage, local versus durable ownership, SSR/worker compatibility, observability minimization, and CWL/naruon modular integration boundaries
