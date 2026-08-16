# Revision-Bound Writing Diagnostics Implementation Plan

> **For agentic workers:** Use the repository's test-driven, exact-head, single-writer workflow. Every task begins with a realistic failing regression, implements the smallest bounded production change, removes temporary branch-only workflows before integration, and regenerates all current-head evidence after ancestry changes.

**Goal:** Add a generic, provider-neutral Inkspan surface that validates, displays, navigates, applies, ignores, dismisses, explains, and invalidates host-supplied writing diagnostics without making semantic judgments itself.

**Architecture:** A React-free contract validates bounded hostile input. A deterministic inverse text-projection resolver maps revision-scoped W3C selectors to one immutable ProseMirror snapshot. A semantic-neutral extension renders verified ranges. One shared React controller fences async verification by generation and invalidates the complete set after every document change. A built-in accessible panel exposes explicit actions. Standalone and collaborative editors reuse the same types and lifecycle. Version 1 accepts plain-text replacements, applies one explicitly selected diagnostic at a time, and never repairs stale selectors.

**Technology:** TypeScript, React 18/19, TipTap/ProseMirror, Yjs, Web Crypto revision evidence, W3C `TextPositionSelector`, Vitest/jsdom, Playwright Chromium/Firefox/WebKit, Vite package subpaths, pnpm, and existing exact-head coverage/security/package/release gates.

## Global constraints

- Inkspan calls no model, provider, network service, database, storage service, credential broker, or host API.
- Inkspan never infers spelling, grammar, tone, clarity, pragmatics, technical quality, or actionability from text or opaque host fields.
- Keywords, regexes, phrase dictionaries, language names, domains, recipient counts, nearest-text search, quote search, and word positions are prohibited as semantic fallback or stale-selector repair.
- Host strings are untrusted plain text. Version 1 accepts no diagnostic HTML, command, JavaScript, arbitrary TipTap JSON, arbitrary transaction, or callback.
- `inkspan-prosemirror-text` version 1 is the sole v1 selector projection.
- Selector offsets are non-negative safe integers with `start <= end`; collapsed selectors remain navigable but create no inline range decoration.
- Every local or collaborative `docChanged` transaction invalidates the complete active generation. Version 1 never maps or preserves a diagnostic across changed content.
- One immutable editor snapshot supplies the current revision and every selector resolution for one generation.
- Generation, mounted-state, and editor-identity guards prevent stale promises from installing decorations, emitting actions, or moving focus.
- Diagnostics remain advisory and never block form submission, sending, persistence, export, or collaboration.
- Existing behavior remains compatible when diagnostics are absent.
- Owned production statement, branch, function, and line coverage remains exactly 100%, with beginner-readable public documentation.
- The feature stays under `Unreleased`; publication uses a separate release-only PR.

## Task 1: React-free diagnostic contract

**Files:** `src/writingDiagnostics.ts`, `src/writingDiagnostics.test.ts`, `src/writing-diagnostics/index.ts`, `src/index.ts`.

- [ ] Add RED tests for valid/empty sets, exact fields, duplicate IDs, hostile arrays/objects/proxies/accessors/prototypes/symbols, resource ceilings, priorities, confidence, revision, projection, selectors, provenance, and replacement types.
- [ ] Define `advisory | important | critical`, structured `CwlEditorDocumentRevision`, structured projection identity, selector, opaque category, bounded host prose, optional plain-text replacement/confidence, and privacy-minimized provenance.
- [ ] Define stable redacted error codes for contract, limit, revision, projection, selector, conflict, and lifecycle failures.
- [ ] Validate exact own enumerable data properties and return deeply detached frozen values.
- [ ] Preserve host order; do not sort or infer semantics.
- [ ] Export identical root and React-free subpath contracts.
- [ ] Run focused tests and typecheck to GREEN.

## Task 2: inverse canonical text-projection resolver

**Files:** `src/writingDiagnosticProjection.ts`, its tests, `src/textPositionSelectorEvidence.ts`, `src/text-position-selector/index.ts`.

- [ ] Add RED round-trip tests for paragraphs, headings, lists, tables, hard breaks, inline/block atoms, empty blocks, document boundaries, repeated text, astral/Korean/CJK/combining/emoji/bidirectional text, and collapsed ranges.
- [ ] Add negative tests for unsupported projection, unsafe/reversed/out-of-range offsets, grapheme splits, ambiguous structural boundaries, hostile metadata, and missing `Intl.Segmenter`.
- [ ] Build the exact `textBetween(0, size, '\n', '\uFFFC')` projection and one code-point-boundary-to-ProseMirror-position map.
- [ ] Reuse one grapheme-boundary implementation for forward and inverse paths.
- [ ] Fail closed rather than selecting nearest or similar text.
- [ ] Publish the deterministic resolver through the framework-neutral selector surface.

## Task 3: semantic-neutral ProseMirror decorations

**Files:** `src/extensions/WritingDiagnostics.ts`, its tests, `src/extensions/kit.ts`.

- [ ] Add RED tests for install/focus/clear metadata, monotonic generation, exact ranges, collapsed ranges, malformed metadata, duplicate IDs, resource ceilings, editor destruction, and local/remote document changes.
- [ ] Render non-empty ranges with only:

```text
class="cwl-writing-diagnostic cwl-writing-diagnostic--{priority}"
data-cwl-diagnostic-id="opaque-id"
```

- [ ] Reject all extra semantic fields and never derive spelling/grammar validity or other semantic ARIA state from host strings.
- [ ] Clear the complete generation before processing metadata on every `docChanged` transaction.
- [ ] Accept only already-validated structural ranges; perform no hashing or host callback.
- [ ] Install the extension exactly once for standalone and collaborative editor graphs.

## Task 4: revision-bound controller

**Files:** `src/components/useWritingDiagnosticsController.ts`, its tests, `src/types.ts`.

- [ ] Add RED tests for absent/invalid/verifying/active/stale states, editor and callback replacement, hostile prop mutation, revision/projection mismatch, selector rejection, doc changes during hashing, concurrent promises, unmount, and callback exceptions.
- [ ] Validate the complete set before reading editor state.
- [ ] Capture one immutable envelope, derive one revision, resolve all selectors against that same snapshot, and install atomically.
- [ ] Fence every async continuation with monotonic generation, mounted state, and editor identity.
- [ ] Invalidate both verifying and active generations immediately after any local/remote document change; do not map ranges.
- [ ] Expose privacy-minimized Focus/Ignore/Dismiss/Explain controller actions and typed reason codes.

## Task 5: accessible diagnostics panel

**Files:** `src/components/WritingDiagnosticsPanel.tsx`, its tests, `src/components/EditorFrame.tsx`, `src/styles.css`, print-style tests.

- [ ] Add RED accessibility tests for a named region, count, ordered items, category, priority, title, explanation, affected-range focus, previous/next navigation, Apply/Ignore/Dismiss/Explain, disabled Apply without replacement, polite status, and assertive conflict alert.
- [ ] Prove asynchronous arrival does not steal focus and explicit navigation uses roving focus.
- [ ] Render every host string as a React text node; never use raw HTML.
- [ ] Keep selected source text out of action names and attributes.
- [ ] Add forced-colors, high-contrast, reduced-motion, focus-visible, touch-target, zoom, and print behavior. Default print remains document-only; an explicit host option may include a bounded appendix.
- [ ] Add no undocumented global shortcut.

## Task 6: standalone editor actions

**Files:** `src/types.ts`, `src/components/CwlEditor.tsx`, `src/components/useEditorHandle.ts`, integration/accessibility/handle tests.

- [ ] Add RED tests for optional props, hostile/valid/stale sets, explicit actions, clear, read-only/disabled modes, form submission, undo, callback replacement, and unmount.
- [ ] Preserve the raw diagnostics prop by identity until bounded controller validation.
- [ ] Add additive props for diagnostics, action/error callbacks, label, and optional print appendix.
- [ ] Add imperative Focus/Ignore/Dismiss/Explain/Apply methods through the same controller used by the panel.
- [ ] Immediately before Apply, derive and compare the exact current revision again.
- [ ] Apply one plain-text replacement through one ordinary ProseMirror transaction, derive the resulting revision, emit the complete event, and invalidate the remaining generation.
- [ ] Return typed non-mutating outcomes for stale/conflict/lifecycle cases.
- [ ] Prove source words alone generate no diagnostics.

## Task 7: collaborative parity

**Files:** collaborative editor/index/tests and a two-client diagnostics suite.

- [ ] Add the same props/actions and accessible panel behavior through the shared controller and extension.
- [ ] Prove a remote Yjs insertion invalidates the complete local set before application.
- [ ] Prove remote change during pending hashing discards the stale continuation.
- [ ] Keep diagnostics, explanations, replacements, selected text, model provenance, and review state out of awareness payloads.
- [ ] Emit an action only from the client whose user invoked it.
- [ ] Preserve editor/provider/Yjs identity when diagnostics/callbacks change.

## Task 8: framework-neutral package subpath

**Files:** package manifest/lock, Vite subpath config, package/export/consumer/boundary tests.

- [ ] Publish `@contextualwisdomlab/cwl-editor/writing-diagnostics` as React-free ESM/CommonJS/types.
- [ ] Export contracts, limits, validation, errors, and deterministic selector-resolution primitives only.
- [ ] Prove no React, TipTap React, provider, model SDK, network, credential, filesystem, database, or CSS side-effect dependency leaks into the pure subpath.
- [ ] Install the packed tarball into isolated ESM/CommonJS/strict-TypeScript consumers.
- [ ] Keep UI and editor handles on interactive root/collaboration entrypoints.

## Task 9: browser, SSR, hostile-input, and no-fallback assurance

**Files:** browser specs/fixture, security tests, server-rendering tests, `docs/TEST_STRATEGY.md`.

- [ ] Test rendering, keyboard/touch navigation, focus, Apply, undo, strict invalidation, zoom, forced colors, and mobile targets on pinned Chromium/Firefox/WebKit.
- [ ] Prove SSR renders without browser globals, segmenter, model infrastructure, or semantic evaluation; hydration adds no duplicate IDs, focus theft, or mismatch.
- [ ] Test script/HTML strings, bidi controls, isolated surrogates, nulls, oversize, accessors, proxies, duplicate JSON members, and callback exceptions.
- [ ] Use multilingual semantic contrast fixtures; without host diagnostics the exact result is an empty diagnostic surface.
- [ ] Record browser lock, artifact identity, and the distinction between editor integrity evidence and model accuracy.

## Task 10: canonical documentation and traceability

**Files:** README, Architecture, PRD, TRD, API contract, threat model, operability, traceability, ADR 0028/0029/index, design, this plan, CHANGELOG, documentation-contract tests.

- [ ] Document host semantic authority versus Inkspan deterministic integrity.
- [ ] Synchronize public type examples, strict invalidation, semantic-neutral decorations, collapsed selectors, single-action application, standalone/collaboration parity, SSR, degraded operation, privacy, and rollback.
- [ ] Remove temporary errata after folding every rule into the canonical ADR/design/plan; leave no parallel instruction set.
- [ ] Document that confidence/priority/category are host labels, not editor truth or submission policy.
- [ ] Add threats for hostile diagnostics, stale async work, replacement injection, telemetry leakage, focus attacks, collaboration races, and authority confusion.
- [ ] Map requirements to modules, tests, browser/package evidence, and release gates.
- [ ] Keep ADRs Proposed until protected implementation and acceptance exist.
- [ ] Add machine contracts that reject semantic keyword fallback, category-derived semantic ARIA, cross-edit mapping, provider ownership, stale repair, batch mutation authority, and send gating.

## Task 11: exact-head integration acceptance

- [ ] Reconcile the complete stack onto the latest protected main without destructive history or lost concurrent changes.
- [ ] Remove every temporary branch-specific workflow and regenerate evidence on the resulting exact head.
- [ ] Run full tests, typecheck, exact 100% owned coverage, library/demo builds, packed consumers, cross-engine browsers, Office Python 3.11/3.14 package gates, security/SAST/dependency/SBOM/provenance/secret checks, and documentation contracts.
- [ ] Inspect all current human/CodeRabbit/GHAS/Dependabot/OpenCode/Noema/Strix feedback and resolve only addressed threads.
- [ ] Require zero valid unresolved findings and qualifying independent non-author approval on the unchanged head.
- [ ] Mark Ready and merge only through protected policy; then verify protected main contains expected files and no temporary artifacts.

## Task 12: release-only publication and host handoff

- [ ] Open a separate release-only PR after protected feature integration and current release-train closure.
- [ ] Promote ADR status only with protected implementation and current acceptance evidence.
- [ ] Update version, final CHANGELOG, package declarations, licenses, SBOM/provenance, compatibility, and rollback.
- [ ] Publish immutable npm artifacts from the exact reviewed release head and verify all subpaths from the registry artifact.
- [ ] Record immutable version, tarball digest, source commit, manifest, browser evidence, and rollback in the Naruon companion integration.
- [ ] Never integrate a mutable branch, source archive, copied fork, local path, or unreviewed package into a host runtime.
