# Safe Rich Clipboard Ingestion Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a bounded, fail-closed, semantic rich-HTML clipboard sanitizer that is enabled consistently in standalone and collaborative Inkspan editors.

**Architecture:** A framework-independent `SafeClipboard` TipTap extension transforms `text/html` before ProseMirror parsing. The sanitizer parses into an inert template, iteratively reconstructs an allowlisted fragment, reuses the existing SafeLink URI policy, drops all resource-bearing images and active/hidden subtrees, and reports only redacted stable errors through the latest host callback.

**Tech Stack:** TypeScript 5.7, TipTap 2.27/ProseMirror, React 18/19, Vitest 3 with jsdom, Vite 6, existing Inkspan SafeLink and Base64Image policies.

## Global Constraints

- Default maximum source HTML: 1,048,576 UTF-8 bytes.
- Default maximum traversed nodes: 10,000.
- Default maximum source depth: 64.
- No new runtime dependency.
- No network, filesystem, model, provider, credential, storage, or database operation.
- Drop every HTML `<img>`; binary clipboard images continue through Base64Image.
- Preserve only the elements and attributes listed in the approved design.
- Convert only bold, italic/oblique, underline, and line-through inline styles to semantic elements.
- Use the existing `isSafeLinkHref()` policy; never repair or trim a link.
- Errors contain only stable codes and static bounded messages.
- Production statement, branch, function, and line coverage: 100%.
- Public module, type, class, method, function, and property documentation: 100%.
- The behavior targets release 0.6.0 but remains under `Unreleased` until exact-head acceptance.

---

### Task 1: Public sanitizer contract and red tests

**Files:**
- Create: `src/extensions/SafeClipboard.ts`
- Create: `src/extensions/SafeClipboard.test.ts`

**Interfaces:**
- Consumes: `isSafeLinkHref(href: unknown): href is string` from `src/extensions/SafeLink.ts`.
- Produces: `ClipboardConfig`, `ClipboardSanitizationErrorCode`, `ClipboardSanitizationError`, `sanitizeRichClipboardHtml()`, and `SafeClipboard`.

- [ ] **Step 1: Write failing validation and resource-limit tests**

Create tests that require:

```ts
expect(() => sanitizeRichClipboardHtml('<p>x</p>', { maxHtmlBytes: 0 }, document))
  .toThrowError(expect.objectContaining({ code: 'invalid_configuration' }));
expect(() => sanitizeRichClipboardHtml('x'.repeat(1_048_577), {}, document))
  .toThrowError(expect.objectContaining({ code: 'input_too_large' }));
```

Add breadth, depth, and missing-DOM cases with exact stable error codes.

- [ ] **Step 2: Run the focused tests and confirm red**

Run:

```bash
pnpm vitest run src/extensions/SafeClipboard.test.ts
```

Expected: failure because the module and exported contracts do not exist.

- [ ] **Step 3: Implement validated configuration and error types**

Use safe-integer validation and static messages:

```ts
export type ClipboardSanitizationErrorCode =
  | 'dom_unavailable'
  | 'input_too_large'
  | 'node_limit_exceeded'
  | 'depth_limit_exceeded'
  | 'invalid_configuration';
```

Never include source HTML, URLs, attribute values, or private exceptions.

- [ ] **Step 4: Implement iterative allowlist reconstruction**

Parse into `documentOverride.implementation.createHTMLDocument('').createElement('template')`, traverse `template.content` using an explicit stack, and append only newly created output nodes. Drop comments and dangerous/hidden subtrees. Unwrap unsupported ordinary elements.

- [ ] **Step 5: Implement semantic style conversion and safe attributes**

Convert the four documented style categories to semantic wrappers. Preserve only SafeLink `href` plus fixed `rel`, bounded ordered-list `start`, and bounded table-cell span attributes.

- [ ] **Step 6: Add realistic Word/Google Docs/security tests**

Fixtures must include:

```html
<p class="MsoNormal" style="font-weight:700">Word <span style="font-style:italic">text</span></p>
<div style="white-space:pre-wrap"><span style="text-decoration: underline line-through">Docs</span></div>
<script>steal()</script>
<img src="https://tracker.example/pixel">
<a href="javascript:alert(1)" onclick="steal()">unsafe</a>
```

Assert semantic text remains while script, image, unsafe link, class, style, event handler, and hidden data do not.

- [ ] **Step 7: Run focused sanitizer tests**

```bash
pnpm vitest run src/extensions/SafeClipboard.test.ts
```

Expected: all focused tests pass.

- [ ] **Step 8: Commit the sanitizer**

```bash
git add src/extensions/SafeClipboard.ts src/extensions/SafeClipboard.test.ts
git commit -m "feat(clipboard): sanitize rich HTML paste"
```

### Task 2: Shared editor integration and host callback

**Files:**
- Modify: `src/extensions/kit.ts`
- Modify: `src/extensions/kit.test.ts`
- Modify: `src/types.ts`
- Modify: `src/components/CwlEditor.tsx`
- Modify: `src/collaboration/CollaborativeCwlEditor.tsx`
- Test: `src/components/CwlEditor.test.tsx` or the repository's focused editor integration suite
- Test: `src/collaboration/CollaborativeCwlEditor.test.tsx`

**Interfaces:**
- Consumes: Task 1 `ClipboardConfig`, `ClipboardSanitizationError`, and `SafeClipboard`.
- Produces: `clipboard?: ClipboardConfig` and `onClipboardError?: (error: ClipboardSanitizationError) => void` on both editor surfaces.

- [ ] **Step 1: Write failing kit tests**

Require `buildExtensions()` to include exactly one `safeClipboard` extension by default and to forward explicit config/error callback options.

- [ ] **Step 2: Write failing React callback-liveness tests**

Render an editor, replace `onClipboardError` without recreating the editor, trigger the extension transform with oversized HTML, and assert only the latest callback receives one redacted `input_too_large` error.

Repeat for the collaborative surface with a host-owned Yjs document.

- [ ] **Step 3: Run the focused tests and confirm red**

```bash
pnpm vitest run src/extensions/kit.test.ts src/components/CwlEditor.test.tsx src/collaboration/CollaborativeCwlEditor.test.tsx
```

Expected: failures because the props and extension forwarding do not exist.

- [ ] **Step 4: Add public prop and config documentation**

Import the Task 1 types into `src/types.ts`, document the security defaults, and add `clipboard` and `onClipboardError` to `CwlEditorProps`. `CollaborativeCwlEditorProps` inherits the same contract.

- [ ] **Step 5: Add the extension to the shared kit**

Append `SafeClipboard.configure({ ... })` in `buildExtensions()` before host-provided `additionalExtensions`, forwarding validated config and the error callback.

- [ ] **Step 6: Wire latest callbacks without editor recreation**

Use `useLatestRef` and a stable `useCallback` in both React editors, matching the existing image-error pattern.

- [ ] **Step 7: Run focused integration tests**

```bash
pnpm vitest run src/extensions/kit.test.ts src/components/CwlEditor.test.tsx src/collaboration/CollaborativeCwlEditor.test.tsx
```

Expected: all focused tests pass.

- [ ] **Step 8: Commit integration**

```bash
git add src/extensions/kit.ts src/extensions/kit.test.ts src/types.ts src/components/CwlEditor.tsx src/collaboration/CollaborativeCwlEditor.tsx src/components/CwlEditor.test.tsx src/collaboration/CollaborativeCwlEditor.test.tsx
git commit -m "feat(clipboard): enforce shared paste policy"
```

### Task 3: Public exports, documentation, and release evidence

**Files:**
- Modify: `src/index.ts`
- Modify: `README.md`
- Modify: `CHANGELOG.md`
- Create: `docs/clipboard-security.md`
- Create: `docs/doctoring/safe-rich-clipboard.md`
- Modify: `ARCHITECTURE.md` if present; otherwise create it with the editor trust-boundary section
- Test: `src/exports.test.ts` or the repository's export-contract suite
- Test: `scripts/release-metadata.test.mjs` only when preparing 0.6.0, not in the feature PR

**Interfaces:**
- Consumes: Tasks 1 and 2 public contracts.
- Produces: buyer-facing API discovery, architecture ownership, APA 7 evidence, and `Unreleased` changelog scope.

- [ ] **Step 1: Write failing export and documentation contract tests**

Require root exports for sanitizer types/functions and README text that identifies safe Word/Google Docs paste, dropped HTML images, and the host error callback.

- [ ] **Step 2: Run export/documentation tests and confirm red**

```bash
pnpm vitest run src/exports.test.ts
pnpm run test:package-config
```

Expected: failures for missing public exports or documentation markers.

- [ ] **Step 3: Add public exports**

Export the sanitizer, extension, error class, error-code type, and config type from `src/index.ts` without adding a new package subpath.

- [ ] **Step 4: Write operator and architecture documentation**

Document allowed structure, dropped content, HTML-image behavior, limits, errors, standalone/collaboration equivalence, SSR behavior, host responsibilities, and rollback. Add the W3C Clipboard, OWASP, TipTap, and WHATWG sources in APA 7 form.

- [ ] **Step 5: Update `CHANGELOG.md` under `Unreleased`**

Record the buyer-visible feature, security boundary, realistic tests, and that the next minor release is 0.6.0 only after integrated acceptance.

- [ ] **Step 6: Run focused export/documentation tests**

```bash
pnpm vitest run src/exports.test.ts
pnpm run test:package-config
```

Expected: pass.

- [ ] **Step 7: Commit docs and exports**

```bash
git add src/index.ts README.md CHANGELOG.md ARCHITECTURE.md docs/clipboard-security.md docs/doctoring/safe-rich-clipboard.md src/exports.test.ts
git commit -m "docs(clipboard): publish safe paste contract"
```

### Task 4: Exact-head repository verification and pull request

**Files:**
- No new production files unless a test exposes a real defect.

**Interfaces:**
- Consumes: all previous tasks.
- Produces: one reviewable feature PR with exact-head evidence.

- [ ] **Step 1: Run the complete TypeScript gate**

```bash
pnpm install --frozen-lockfile
pnpm typecheck
pnpm coverage
pnpm build
pnpm verify:package
pnpm build:demo
```

Expected: every command succeeds and production statement, branch, function, and line coverage are 100%.

- [ ] **Step 2: Run Office gates**

```bash
cd office
python -m pip install --require-hashes --only-binary=:all: -r requirements-ci.txt
python -m pip check
python scripts/check_docstrings.py
pytest
python -m pip wheel . --no-deps --no-build-isolation --wheel-dir dist
```

Expected: Python 3.11 and 3.14 CI lanes later repeat the same 100% branch/docstring and package checks.

- [ ] **Step 3: Inspect package contents and dependency graph**

Confirm no new runtime dependency, no unexpected package artifact, and no React/TipTap duplication outside existing surfaces.

- [ ] **Step 4: Open one PR**

Title:

```text
feat: sanitize rich clipboard HTML
```

The body must list exact head, TDD evidence, realistic fixtures, 100% gates, security ownership, standalone/collaboration equivalence, and the 0.6.0 release boundary.

- [ ] **Step 5: Review, fix, and merge loop**

Inspect every current-head review thread and required check, fix only valid findings, rerun failed checks, resolve addressed threads, request exact-head independent review, enable auto-merge, and merge only with expected-head protection after all repository policy is satisfied.
