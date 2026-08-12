# Revision-Bound Writing Diagnostics Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a generic, provider-neutral Inkspan surface that validates, displays, navigates, applies, ignores, dismisses, and invalidates host-supplied writing diagnostics without making any semantic judgment itself.

**Architecture:** A React-free `writing-diagnostics` contract validates bounded host input and resolves revision-scoped W3C text selectors against Inkspan's canonical text projection. A ProseMirror extension renders verified ranges and clears them on every document-changing transaction. A shared React controller binds asynchronous revision verification to one editor generation, while a built-in accessible panel exposes explicit actions. Standalone and collaborative editors reuse the same contract, controller, extension, and action result types. Version 1 accepts plain-text replacements only and never searches for similar text after a revision mismatch.

**Tech Stack:** TypeScript, React 18/19, TipTap/ProseMirror, Yjs collaboration, Web Crypto revision evidence, W3C `TextPositionSelector`, Vitest with jsdom, Playwright across Chromium/Firefox/WebKit, Vite package subpath builds, pnpm, and the existing exact-head coverage/package/release gates.

## Global Constraints

- Inkspan does not call an LLM, provider, network service, database, storage service, or host API.
- Inkspan never infers grammar, spelling, tone, clarity, pragmatics, technical quality, or actionability from text.
- Keywords, regular expressions, phrase dictionaries, sender domains, language names, recipient counts, nearest-text search, and word positions are prohibited as semantic fallback or stale-selector repair.
- Version 1 replacements are plain text. HTML, commands, editor JSON, JavaScript, and arbitrary ProseMirror transactions are not accepted from a diagnostic.
- The canonical selector projection remains `inkspan-prosemirror-text` version `1`; a new projection requires a separate ADR and compatibility plan.
- Any document-changing local or collaborative transaction invalidates every active diagnostic before it can be applied. Version 1 does not retain or remap a diagnostic across a changed document.
- A diagnostic is actionable only after its declared strong revision, projection identity, selector, and grapheme boundaries have been verified against one exact editor snapshot.
- Asynchronous revision checks use generation tokens and never publish results for a replaced editor, destroyed editor, newer diagnostic set, or changed document.
- Default hard limits:
  - 256 diagnostics per editor snapshot;
  - 256 characters per `diagnosticId`;
  - 128 characters per `categoryCode` and provenance identifier;
  - 256 characters per title;
  - 4,000 characters per explanation;
  - 20,000 characters per replacement;
  - confidence in the closed interval `[0, 1]`.
- Action callbacks and default telemetry-safe result objects contain opaque identifiers, revisions, category, action, bounded reason codes, and timing state only. They do not contain selected source text, replacement text, explanation, prompt, model output, document envelope, credential, or tenant identifier.
- Diagnostics remain advisory. Inkspan does not block form submission, persistence, export, or sending.
- Existing editor behavior is byte-for-byte and interaction-compatible when `writingDiagnostics` is absent.
- Production statement, branch, function, and line coverage remains exactly 100%.
- Public APIs and every shipped module/class/function receive beginner-readable documentation.
- Feature work remains under `Unreleased`; a separate exact-head release-only PR publishes the next compatible minor version after all acceptance gates pass.

---

## Task 1: Define the React-Free Diagnostic Contract

**Files:**
- Create: `src/writingDiagnostics.ts`
- Create: `src/writingDiagnostics.test.ts`
- Create: `src/writing-diagnostics/index.ts`
- Modify: `src/index.ts`

- [ ] Write failing tests for valid diagnostics, empty arrays, duplicate IDs, unexpected fields, inherited fields, accessors, symbols, proxy exceptions, oversized arrays/strings, invalid confidence, unsupported priority, malformed revision, unsupported projection, invalid selector order, and non-string replacement values.
- [ ] Define the public v1 types:

```ts
export type CwlWritingDiagnosticPriority =
  | 'advisory'
  | 'important'
  | 'critical';

export interface CwlWritingDiagnostic {
  readonly diagnosticId: string;
  readonly documentRevision: CwlEditorDocumentRevision;
  readonly textProjection: CwlEditorTextProjectionIdentity;
  readonly selector: CwlEditorTextPositionSelector;
  readonly categoryCode: string;
  readonly priority: CwlWritingDiagnosticPriority;
  readonly title: string;
  readonly explanation: string;
  readonly suggestedReplacement?: string;
  readonly confidence?: number;
  readonly provenance: Readonly<{
    workflowId: string;
    workflowVersion: string;
    judgePolicyVersion: string;
    orchestrationMode?: string;
  }>;
}
```

- [ ] Define stable, redacted error codes and `WritingDiagnosticError` for contract, limit, revision, projection, selector, conflict, and lifecycle failures.
- [ ] Define frozen default limits and a strict `validateWritingDiagnostics(input, limits?)` function that returns a deeply detached, deeply frozen tuple.
- [ ] Validate only own data properties. Catch hostile object/proxy behavior and return a stable error without reflecting source values.
- [ ] Reject duplicate diagnostic IDs and reject any object whose exact field set differs from the v1 schema.
- [ ] Preserve diagnostic order from the host; do not sort by confidence, category, wording, or source position inside the validator.
- [ ] Export only the React-free contract, validator, constants, limits, and error types from `src/writing-diagnostics/index.ts`.
- [ ] Re-export the same contract from the root package for interactive consumers.
- [ ] Run:

```bash
pnpm exec vitest run src/writingDiagnostics.test.ts
pnpm typecheck
```

- [ ] Commit:

```bash
git add src/writingDiagnostics.ts src/writingDiagnostics.test.ts src/writing-diagnostics/index.ts src/index.ts
git commit -m "feat(diagnostics): add strict writing diagnostic contract"
```

## Task 2: Add an Inverse Canonical Text-Projection Resolver

**Files:**
- Create: `src/writingDiagnosticProjection.ts`
- Create: `src/writingDiagnosticProjection.test.ts`
- Modify: `src/textPositionSelectorEvidence.ts`
- Modify: `src/text-position-selector/index.ts`

- [ ] Write failing tests that resolve selectors over paragraphs, headings, lists, tables, hard breaks, inline text, non-text leaf nodes, astral characters, Korean/CJK text, combining marks, emoji sequences, bidirectional text, empty blocks, and document boundaries.
- [ ] Add negative tests for unsupported projection versions, negative/non-integral offsets, reversed ranges, out-of-range offsets, grapheme-splitting boundaries, ambiguous projection boundaries, and runtimes without `Intl.Segmenter`.
- [ ] Implement a single-pass `buildTextProjectionMap(documentNode)` that emits the exact same text as `documentNode.textBetween(0, documentNode.content.size, '\n', '\uFFFC')` plus a boundary map between Unicode-code-point offsets and ProseMirror positions.
- [ ] Assert in tests that the independently built projection is exactly equal to the existing canonical projection for every fixture and generated document.
- [ ] Add:

```ts
export function resolveTextPositionSelector(
  documentNode: ProseMirrorNode,
  selector: CwlEditorTextPositionSelector,
  textProjection: CwlEditorTextProjectionIdentity,
): Readonly<{ from: number; to: number }>;
```

- [ ] Fail closed when a code-point boundary cannot map to one unambiguous ProseMirror position; never pick the nearest sentence, matching word, or repeated substring.
- [ ] Reuse one shared grapheme-boundary implementation for selector creation and resolution so forward and inverse paths cannot diverge.
- [ ] Add property tests that create a valid structural selection, convert it with `createTextPositionSelector()`, resolve it back, and recover the exact original range.
- [ ] Run:

```bash
pnpm exec vitest run src/textPositionSelectorEvidence.test.ts src/writingDiagnosticProjection.test.ts
pnpm typecheck
```

- [ ] Commit:

```bash
git add src/textPositionSelectorEvidence.ts src/text-position-selector/index.ts src/writingDiagnosticProjection.ts src/writingDiagnosticProjection.test.ts
git commit -m "feat(diagnostics): resolve revision-scoped text selectors"
```

## Task 3: Build the ProseMirror Decoration and Invalidation Extension

**Files:**
- Create: `src/extensions/WritingDiagnostics.ts`
- Create: `src/extensions/WritingDiagnostics.test.ts`
- Modify: `src/extensions/kit.ts`

- [ ] Write failing extension-state tests for installing a verified diagnostic set, inline decoration attributes, collapsed/empty ranges, duplicate install generations, clear commands, editor destruction, and document-changing transactions.
- [ ] Define one plugin key and typed transaction metadata for `install`, `focus`, and `clear` operations.
- [ ] Render verified non-empty ranges with safe static attributes only:

```text
class="cwl-writing-diagnostic cwl-writing-diagnostic--{priority}"
data-cwl-diagnostic-id="opaque-id"
aria-invalid="spelling" only when the host category explicitly maps to mechanics
```

- [ ] Do not inject title, explanation, replacement, category text, model output, or HTML into decoration attributes.
- [ ] Clear all decorations and focused-diagnostic state on every `transaction.docChanged`, including Yjs remote transactions.
- [ ] Do not map a diagnostic through a changed document in version 1.
- [ ] Expose typed helper commands that accept already-validated, already-resolved ranges; the extension itself must not hash documents or call host code.
- [ ] Add the extension exactly once through `buildExtensions()` for standalone and collaborative editor graphs.
- [ ] Prove by source and runtime tests that an editor with no diagnostics has no added visual output, action surface, or document mutation.
- [ ] Run:

```bash
pnpm exec vitest run src/extensions/WritingDiagnostics.test.ts src/extensions/kit.test.ts
pnpm typecheck
```

- [ ] Commit:

```bash
git add src/extensions/WritingDiagnostics.ts src/extensions/WritingDiagnostics.test.ts src/extensions/kit.ts
git commit -m "feat(diagnostics): add fail-closed editor decorations"
```

## Task 4: Implement the Revision-Bound Controller State Machine

**Files:**
- Create: `src/components/useWritingDiagnosticsController.ts`
- Create: `src/components/useWritingDiagnosticsController.test.tsx`
- Modify: `src/types.ts`

- [ ] Write failing hook tests for initial verification, replacement diagnostic props, same-array identity with mutated hostile members, editor replacement, editor destruction, revision mismatch, projection mismatch, verification rejection, document change during hashing, overlapping asynchronous requests, and callback replacement without editor recreation.
- [ ] Define controller states:

```text
absent -> verifying -> active
                 -> invalid
active -> applying -> applied
active -> ignored | dismissed | explanation_requested
active -> stale on any document change
```

- [ ] Add public action/result types with stable reason codes and no authored text:

```ts
export type CwlWritingDiagnosticAction =
  | 'applied'
  | 'ignored'
  | 'dismissed'
  | 'requested_explanation'
  | 'stale'
  | 'conflict';
```

- [ ] Validate diagnostics before reading the editor.
- [ ] Capture one immutable document envelope and derive one strong revision from that same snapshot before resolving any selector.
- [ ] Compare the declared revision and projection exactly; no normalization or compatibility guess is permitted.
- [ ] Resolve all ranges against the same immutable snapshot and reject the complete set atomically if structural validation fails.
- [ ] Treat overlapping diagnostics as displayable but prevent overlapping replacements from being batch-applied. Version 1 exposes single application only.
- [ ] Subscribe to editor transactions and immediately invalidate the active generation before scheduling any new verification.
- [ ] Use monotonic generation IDs and mounted/editor identity guards so older promises cannot install decorations, emit actions, or change focus.
- [ ] Contain host callback exceptions and keep editor state deterministic.
- [ ] Run:

```bash
pnpm exec vitest run src/components/useWritingDiagnosticsController.test.tsx
pnpm typecheck
```

- [ ] Commit:

```bash
git add src/components/useWritingDiagnosticsController.ts src/components/useWritingDiagnosticsController.test.tsx src/types.ts
git commit -m "feat(diagnostics): bind diagnostics to exact editor revisions"
```

## Task 5: Add Accessible Diagnostic Navigation and Action UI

**Files:**
- Create: `src/components/WritingDiagnosticsPanel.tsx`
- Create: `src/components/WritingDiagnosticsPanel.test.tsx`
- Modify: `src/components/EditorFrame.tsx`
- Modify: `src/styles.css`

- [ ] Write failing accessibility tests for a named region, count summary, ordered diagnostic list, category/priority/title/explanation, affected-range focus, previous/next navigation, Apply/Ignore/Dismiss/Explain actions, live status, and disabled application when no replacement exists.
- [ ] Add tests proving that asynchronous diagnostic arrival does not move focus and that explicit navigation returns focus predictably between the editor range and panel card.
- [ ] Add tests proving information remains available without color, hover, pointer input, animation, or generated CSS content.
- [ ] Render host strings as React text nodes only. Never use `dangerouslySetInnerHTML`.
- [ ] Give every action an explicit accessible name that includes the diagnostic title but does not copy the selected source passage into an attribute.
- [ ] Use buttons for previous/next navigation and roving focus within the list; do not add undocumented global shortcuts in version 1.
- [ ] Add one polite live region for completed actions and one assertive alert only for an application conflict.
- [ ] Add priority-specific underline styles plus forced-colors, high-contrast, reduced-motion, print, touch-target, and focus-visible rules.
- [ ] In print, omit action buttons and include a compact diagnostic appendix only when the host explicitly enables `printWritingDiagnostics`; default print output remains document-only.
- [ ] Add `writingDiagnosticsPanel?: ReactNode` support to `EditorFrame` only as an internally constructed trusted component slot; hosts do not inject raw diagnostic markup.
- [ ] Run:

```bash
pnpm exec vitest run src/components/WritingDiagnosticsPanel.test.tsx src/components/EditorFrame.test.tsx src/printStyles.test.ts
pnpm typecheck
```

- [ ] Commit:

```bash
git add src/components/WritingDiagnosticsPanel.tsx src/components/WritingDiagnosticsPanel.test.tsx src/components/EditorFrame.tsx src/styles.css
git commit -m "feat(diagnostics): add accessible writing guidance UI"
```

## Task 6: Integrate Standalone Editor Props and Imperative Actions

**Files:**
- Modify: `src/types.ts`
- Modify: `src/components/CwlEditor.tsx`
- Modify: `src/components/useEditorHandle.ts`
- Modify: `src/components/CwlEditor.test.tsx`
- Modify: `src/components/CwlEditor.accessibility.test.tsx`
- Modify: `src/components/useEditorHandle.test.tsx`
- Create: `src/components/CwlEditor.writingDiagnostics.test.tsx`

- [ ] Write failing integration tests for omitted props, valid diagnostics, invalid diagnostics, stale revisions, editor updates, Apply/Ignore/Dismiss/Explain, clear, undo, host callback replacement, read-only mode, disabled editor, form submission, and unmount.
- [ ] Add optional props:

```ts
writingDiagnostics?: readonly CwlWritingDiagnostic[];
onWritingDiagnosticAction?: (event: CwlWritingDiagnosticActionEvent) => void;
onWritingDiagnosticsError?: (error: WritingDiagnosticError) => void;
writingDiagnosticsLabel?: string;
printWritingDiagnostics?: boolean;
```

- [ ] Preserve the original diagnostics array by identity until the controller performs bounded validation; editor construction must not deeply inspect hostile values.
- [ ] Add imperative methods for focus, ignore, dismiss, explanation request, and asynchronous apply. Every method returns a typed result instead of throwing for ordinary stale/conflict outcomes.
- [ ] Apply one plain-text replacement through an ordinary ProseMirror transaction only after a second exact-current-revision check immediately before mutation.
- [ ] Compute and return the resulting strong revision from the applied post-transaction document, and emit the host callback only after the result is complete.
- [ ] Ensure the transaction enters the normal undo history and does not bypass clipboard, link, image, schema, or document-envelope policy.
- [ ] Immediately invalidate every remaining diagnostic after a successful apply.
- [ ] Keep editing, form submission, conversion, save, and export available when diagnostics are invalid, unavailable, stale, ignored, or unhandled.
- [ ] Prove a document containing words such as `rude`, `incorrect`, `urgent`, or their multilingual equivalents produces zero diagnostics unless the host supplies them.
- [ ] Run:

```bash
pnpm exec vitest run src/components/CwlEditor.writingDiagnostics.test.tsx src/components/CwlEditor.accessibility.test.tsx src/components/useEditorHandle.test.tsx
pnpm typecheck
```

- [ ] Commit:

```bash
git add src/types.ts src/components/CwlEditor.tsx src/components/useEditorHandle.ts src/components/CwlEditor.test.tsx src/components/CwlEditor.accessibility.test.tsx src/components/useEditorHandle.test.tsx src/components/CwlEditor.writingDiagnostics.test.tsx
git commit -m "feat(diagnostics): integrate revision-safe editor actions"
```

## Task 7: Establish Collaborative Editor Parity

**Files:**
- Modify: `src/collaboration/CollaborativeCwlEditor.tsx`
- Modify: `src/collaboration/index.ts`
- Modify: `src/collaboration/index.test.ts`
- Modify: `src/collaboration/CollaborativeCwlEditor.test.tsx`
- Modify: `src/collaboration/CollaborativeCwlEditor.accessibility.test.tsx`
- Create: `src/collaboration/CollaborativeCwlEditor.writingDiagnostics.test.tsx`

- [ ] Write failing tests for the same public props/actions as standalone Inkspan.
- [ ] Add a two-client Yjs test proving a remote insertion invalidates the local client's complete diagnostic set before any application can occur.
- [ ] Add a race test in which remote content changes while the local revision digest is pending; the older digest must not install decorations.
- [ ] Reuse `useWritingDiagnosticsController`; do not create a second collaborative-specific semantic or lifecycle implementation.
- [ ] Ensure awareness payloads never contain diagnostics, explanations, replacements, selected text, model provenance, or review state.
- [ ] Ensure remote action callbacks are not fabricated: only the client whose user explicitly invoked an action emits that action.
- [ ] Prove editor/provider/Yjs identity remains stable when diagnostics or callbacks change.
- [ ] Run:

```bash
pnpm exec vitest run src/collaboration/CollaborativeCwlEditor.writingDiagnostics.test.tsx src/collaboration/CollaborativeCwlEditor.accessibility.test.tsx src/collaboration/index.test.ts
pnpm typecheck
```

- [ ] Commit:

```bash
git add src/collaboration/CollaborativeCwlEditor.tsx src/collaboration/index.ts src/collaboration/index.test.ts src/collaboration/CollaborativeCwlEditor.test.tsx src/collaboration/CollaborativeCwlEditor.accessibility.test.tsx src/collaboration/CollaborativeCwlEditor.writingDiagnostics.test.tsx
git commit -m "feat(diagnostics): guarantee collaborative parity"
```

## Task 8: Publish a Framework-Neutral Package Subpath

**Files:**
- Modify: `package.json`
- Modify: `pnpm-lock.yaml`
- Create: `vite.writing-diagnostics.config.ts`
- Modify: `scripts/verify-package.mjs`
- Modify: `src/packageExports.test.ts`
- Modify: `src/packageConsumer.test.ts`
- Create: `src/writing-diagnostics/packageBoundary.test.ts`

- [ ] Add `@contextualwisdomlab/cwl-editor/writing-diagnostics` as a React-free ESM/CommonJS/type subpath.
- [ ] Keep UI components and editor handles on the root and collaboration entrypoints; the subpath exports only types, limits, validation, errors, and selector-resolution primitives that do not require React.
- [ ] Add a dedicated Vite build configuration and package export map entries.
- [ ] Add dependency-graph tests proving the subpath has no React, TipTap React, Yjs provider, model SDK, network, credential, filesystem, or database import.
- [ ] Extend package verification to install the packed tarball in isolated strict TypeScript ESM and CommonJS consumers and compile a complete diagnostic fixture.
- [ ] Verify CSS remains opt-in through the existing `styles.css` export and the pure subpath has no CSS side effect.
- [ ] Run:

```bash
pnpm build
pnpm verify:package
pnpm exec vitest run src/packageExports.test.ts src/packageConsumer.test.ts src/writing-diagnostics/packageBoundary.test.ts
```

- [ ] Commit:

```bash
git add package.json pnpm-lock.yaml vite.writing-diagnostics.config.ts scripts/verify-package.mjs src/packageExports.test.ts src/packageConsumer.test.ts src/writing-diagnostics/packageBoundary.test.ts
git commit -m "build(diagnostics): publish framework-neutral contracts"
```

## Task 9: Add Browser, SSR, Hostile-Input, and No-Fallback Assurance

**Files:**
- Create: `tests/browser/specs/writing-diagnostics.browser.spec.ts`
- Modify: `tests/browser/fixture/index.html`
- Create: `src/components/writingDiagnosticsSecurity.test.tsx`
- Modify: `src/components/editorServerRendering.test.tsx`
- Modify: `docs/TEST_STRATEGY.md`

- [ ] Add Playwright scenarios in Chromium, Firefox, and WebKit for rendering, keyboard navigation, range focus, apply, undo, stale invalidation, zoom, forced-colors, and mobile/touch action targets.
- [ ] Add SSR tests proving a deterministic initial shell renders without `window`, `document`, `Intl.Segmenter`, model infrastructure, or diagnostics evaluation.
- [ ] Add hydration tests proving diagnostics verify after the client editor is ready without duplicate IDs, focus theft, or markup mismatch.
- [ ] Add hostile-input tests for HTML/script strings, bidi controls, isolated surrogates, nulls, oversized values, accessors, proxies, duplicate keys after JSON parsing, and callback exceptions.
- [ ] Add semantic contrast fixtures proving Inkspan itself has no keyword behavior:
  - identical words in a quotation and direct statement;
  - the same issue expressed through unrelated paraphrases;
  - product names, code, URLs, and paths resembling spelling errors;
  - Korean, English, mixed-language, and CJK documents.
- [ ] The expected Inkspan result for every contrast fixture without host diagnostics is an empty diagnostic surface.
- [ ] Document that these tests establish editor integrity and rendering parity, not the accuracy of any LLM or host rubric.
- [ ] Run the repository-pinned browser workflow command used by CI and record the exact browser package lock and artifact receipt.
- [ ] Commit:

```bash
git add tests/browser/specs/writing-diagnostics.browser.spec.ts tests/browser/fixture/index.html src/components/writingDiagnosticsSecurity.test.tsx src/components/editorServerRendering.test.tsx docs/TEST_STRATEGY.md
git commit -m "test(diagnostics): prove browser and no-fallback assurance"
```

## Task 10: Reconcile Canonical Documentation and Traceability

**Files:**
- Modify: `README.md`
- Modify: `ARCHITECTURE.md`
- Modify: `docs/PRD.md`
- Modify: `docs/TRD.md`
- Modify: `docs/API_CONTRACT.md`
- Modify: `docs/THREAT_MODEL.md`
- Modify: `docs/OPERABILITY.md`
- Modify: `docs/TRACEABILITY.md`
- Modify: `docs/adr/0027-host-owned-llm-writing-diagnostics.md`
- Modify: `docs/adr/README.md`
- Modify: `CHANGELOG.md`
- Modify: `src/documentationContracts.test.ts`

- [ ] Add public examples for host-supplied diagnostics, exact revision capture, action callbacks, stale refresh, standalone and collaborative editors, SSR, and no-model degraded operation.
- [ ] Document the distinction between semantic authority and deterministic integrity.
- [ ] Document that `confidence` and `priority` are host evidence labels, not editor truth or submission policy.
- [ ] Add a threat-model section for prompt/model output as untrusted data, hostile diagnostic objects, stale selectors, replacement injection, overlap conflicts, telemetry leakage, focus attacks, and collaboration races.
- [ ] Add an operability section for review-unavailable state, invalid diagnostics, refresh ownership, callback failure, feature rollback, and no-network/offline behavior.
- [ ] Update traceability from ADR requirement to source module, test, browser evidence, package evidence, and release gate.
- [ ] Keep ADR 0027 `Proposed` until protected `main` contains the implementation and exact-head acceptance evidence; promote it in the release reconciliation PR, not prematurely.
- [ ] Record the feature under `Unreleased` without claiming Naruon integration, LLM quality, language validation, or publication.
- [ ] Add documentation contract tests that fail if keyword fallback, provider ownership, stale-repair, or send-gating claims reappear.
- [ ] Run:

```bash
pnpm exec vitest run src/documentationContracts.test.ts
pnpm typecheck
```

- [ ] Commit:

```bash
git add README.md ARCHITECTURE.md docs/PRD.md docs/TRD.md docs/API_CONTRACT.md docs/THREAT_MODEL.md docs/OPERABILITY.md docs/TRACEABILITY.md docs/adr/0027-host-owned-llm-writing-diagnostics.md docs/adr/README.md CHANGELOG.md src/documentationContracts.test.ts
git commit -m "docs(diagnostics): reconcile product and assurance contracts"
```

## Task 11: Exact-Head Acceptance and Merge

- [ ] Rebase or merge the latest protected `main` without discarding valid concurrent changes.
- [ ] Run the complete repository test suite.
- [ ] Run `pnpm typecheck`.
- [ ] Run `pnpm coverage` and prove 100% production statement, branch, function, and line coverage.
- [ ] Run deterministic demo/library builds.
- [ ] Run `pnpm verify:package` against the packed tarball outside the source tree.
- [ ] Run cross-engine browser evidence through the repository-pinned Playwright lane.
- [ ] Run Office Python 3.11 and 3.14 test, docstring, branch coverage, wheel, schema, and license gates.
- [ ] Run SAST, dependency, supply-chain, SBOM, provenance, and secret checks on the exact final head.
- [ ] Review every current-head CodeRabbit, GitHub Advanced Security, Dependabot, OpenCode, Noema, Strix, human, and other applicable finding.
- [ ] Resolve every valid review thread and rerun affected tests.
- [ ] Confirm zero unresolved valid review threads.
- [ ] Obtain a qualifying non-author current-head approval.
- [ ] Move the PR from Draft to Ready only after implementation, direct validation, and documentation gates are complete.
- [ ] Merge without bypass only after all protected exact-head checks and approval rules pass.
- [ ] Refetch protected `main` and verify the merge commit contains the expected files and no unrelated branch artifacts.

## Task 12: Release-Only Publication and Naruon Handoff

- [ ] Open a separate release-only PR for the next compatible minor version after the feature merge.
- [ ] Promote ADR 0027 to `Accepted` only with protected-main implementation and exact-head evidence.
- [ ] Update version metadata, final CHANGELOG release section, package declarations, license inventory, SBOM, provenance, and rollback evidence.
- [ ] Publish immutable npm artifacts only from the exact reviewed release head.
- [ ] Verify ESM, CommonJS, types, CSS, root, collaboration, and `writing-diagnostics` subpaths from the published package.
- [ ] Record the immutable version, tarball integrity, source commit, package manifest, and compatibility matrix in the Naruon companion PR.
- [ ] Do not merge Naruon's runtime integration against a mutable Inkspan branch, source archive, local path, or unreviewed package.
- [ ] Retain a documented rollback path that removes diagnostic props and UI without document migration or canonical-envelope changes.
