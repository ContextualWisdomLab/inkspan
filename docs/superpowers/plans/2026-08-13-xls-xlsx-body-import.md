# XLS/XLSX Body Import Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let users insert visible worksheet content from local `.xls` and `.xlsx` files into the current Inkspan editor selection as editable headings and tables.

**Architecture:** Keep binary parsing in a framework-neutral `spreadsheet` package boundary and lazy-load one pinned SheetJS-compatible parser only after a user selects a file. Convert parser output into bounded, inert TipTap JSON before one editor transaction; the toolbar owns file selection and accessible progress text, while hosts continue to own transport, authorization, persistence, and retention.

**Tech Stack:** TypeScript 5.9, TipTap/ProseMirror JSON, React 18/19, Vitest, Testing Library, Vite library builds, `@lokalise/xlsx` 0.20.3 as the integrity-pinned SheetJS 0.20.3 mirror.

## Global Constraints

- Branch from exact protected `main@e8109ec2a17de8bd6594487aa12c8c8a93cb2c03`; do not advance protected `main` while release issue #118 owns the `v0.6.0` publication identity.
- Work only on `agent/318-spreadsheet-body-import`; do not overlap the active `CwlEditor.tsx` writer or Python Office renderer writers.
- Parse files locally in browser memory; add no upload, network fetch, credential, tenant, persistence, model, macro, formula-calculation, or durable-audit authority.
- Accept XLS and XLSX container bytes, but insert only visible worksheet names and displayed/cached cell values as inert text.
- Apply source, worksheet, row, column, cell, per-cell text, and total text ceilings before proportional editor materialization.
- Emit stable payload-redacted errors and never reflect file names, worksheet names, formulas, cell contents, parser exceptions, or binary bytes in ordinary failure messages.
- Preserve exact repository gates: TypeScript, 100% owned-production statement/branch/function/line coverage, package builds and consumers, demo, Chromium/Firefox/WebKit, Office Python 3.11-3.14, security scan, and SAST.
- Keep the pull request Draft and unmerged until the release freeze and every exact-current-head gate/review condition are resolved.

---

### Task 1: Establish the executable RED contract

**Files:**
- Create: `src/spreadsheet/spreadsheetImport.ts`
- Create: `src/spreadsheet/spreadsheetImport.test.ts`
- Create: `.github/workflows/agent-workspace.yml` (temporary, read-only, removed before handoff)

**Interfaces:**
- Produces: `SpreadsheetWorkbookData`, `SpreadsheetImportResult`, `SpreadsheetImportError`, and `spreadsheetWorkbookToDocumentJson(workbook)`.

- [ ] **Step 1: Write one product-boundary failing test**

```ts
const result = spreadsheetWorkbookToDocumentJson({
  worksheets: [
    { name: 'Summary', hidden: false, rows: [['Name', 'Value'], ['매출', '42']] },
    { name: 'Private', hidden: true, rows: [['secret']] },
  ],
});
expect(result.content.map((node) => node.type)).toEqual([
  'heading',
  'table',
  'paragraph',
]);
```

- [ ] **Step 2: Commit a compiling placeholder that throws at the product boundary**

```ts
export function spreadsheetWorkbookToDocumentJson(
  _workbook: SpreadsheetWorkbookData,
): SpreadsheetImportResult {
  throw new SpreadsheetImportError(
    'UNSUPPORTED_OR_CORRUPT',
    'Spreadsheet import is not implemented.',
  );
}
```

- [ ] **Step 3: Open a Draft PR and verify hosted RED**

Run: canonical GitHub `CI` against the exact contributor head.

Expected: dependency setup and TypeScript succeed; the dedicated spreadsheet test fails because conversion is not implemented. Setup, infrastructure, or module-resolution failure is not qualifying RED.

### Task 2: Implement bounded binary parsing and TipTap conversion

**Files:**
- Create: `src/spreadsheet/sheetJsAdapter.ts`
- Modify: `src/spreadsheet/spreadsheetImport.ts`
- Expand: `src/spreadsheet/spreadsheetImport.test.ts`
- Create: `src/spreadsheet/sheetJsAdapter.test.ts`
- Modify: `package.json`
- Modify: `pnpm-lock.yaml`

**Interfaces:**
- Produces: `DEFAULT_SPREADSHEET_IMPORT_LIMITS`, `SpreadsheetImportLimits`, `SpreadsheetImportErrorCode`, `spreadsheetFileToDocumentJson(source, limits?)`, and parser-neutral workbook conversion.
- Consumes: `@lokalise/xlsx@0.20.3` through a dynamic import in `sheetJsAdapter.ts`.

- [ ] **Step 1: Add failing tests for every public limit and error category**

Cover source size before `arrayBuffer()`, visible worksheet count, decoded range rows/columns, rectangular cell count, per-cell and total text, malformed workbook structures, hidden/empty sheets, and payload-redacted failures.

- [ ] **Step 2: Add real XLSX and BIFF8 XLS round trips**

Create in-memory workbooks with Unicode, multiline values, dates, booleans, formulas with cached display values, hidden sheets, and empty sheets; write both `bookType: 'xlsx'` and `bookType: 'biff8'`, then import those exact bytes.

- [ ] **Step 3: Pin the parser and immutable lock**

Add exact dependency `@lokalise/xlsx: 0.20.3` and lock integrity `sha512-9+Wn7Hq2fHoaWJqhWXZXhUF6wNLk6Y5SL/QLLFuv6ChWWYi0lND7EwKeR6Hg8dXgyIc7Pkc0CaDXM+5z2zzi6Q==`.

- [ ] **Step 4: Implement bounded parsing**

Use `Blob.size` preflight, one `arrayBuffer()` read, lazy `import('@lokalise/xlsx')`, `read(..., { type: 'array', cellFormula: false, cellHTML: false, cellNF: false, bookVBA: false })`, visible-sheet metadata, decoded-range preflight, and formatted cell text. Do not evaluate formulas or preserve executable links/macros/objects.

- [ ] **Step 5: Build deterministic TipTap JSON**

For each visible non-empty worksheet, emit a level-3 heading, one rectangular table of ordinary `tableCell` nodes, and an empty trailing paragraph. Normalize CRLF to LF and represent internal newlines with `hardBreak` nodes.

- [ ] **Step 6: Run focused tests and exact coverage**

Run: `pnpm vitest run src/spreadsheet/spreadsheetImport.test.ts src/spreadsheet/sheetJsAdapter.test.ts`

Run: `pnpm coverage`

Expected: all tests pass; statements, branches, functions, and lines remain exactly 100% for owned production.

### Task 3: Add accessible toolbar insertion

**Files:**
- Modify: `src/components/Toolbar.tsx`
- Modify: `src/components/Toolbar.test.tsx`

**Interfaces:**
- Consumes: `spreadsheetFileToDocumentJson(file)`.
- Produces: a keyboard-reachable `Insert XLS/XLSX spreadsheet` control, hidden local file input, one atomic insertion at the current selection, and polite status text.

- [ ] **Step 1: Write failing interaction tests**

Cover accepted MIME/extensions, insertion between existing paragraphs, normal undo, normal transaction/change behavior, same-file reselection, busy disablement, success count, stable failure status, no-file events, and unchanged roving-toolbar navigation.

- [ ] **Step 2: Implement the file picker**

Add a dedicated input accepting `.xls,.xlsx,application/vnd.ms-excel,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet`. Clear its value before processing so selecting the same file again emits another change.

- [ ] **Step 3: Insert one validated JSON batch**

Call `editor.chain().focus().insertContent(result.content).run()` exactly once after parsing succeeds. On parse or transaction failure, leave the document unchanged and announce a stable non-content-bearing error.

- [ ] **Step 4: Preserve toolbar accessibility**

Keep one roving tab stop, arrow/Home/End behavior, native disabled semantics while parsing, and a visually unobtrusive `role="status" aria-live="polite"` region.

### Task 4: Publish a framework-neutral spreadsheet subpath and canonical documentation

**Files:**
- Create: `src/spreadsheet/index.ts`
- Create: `vite.spreadsheet.config.ts`
- Modify: `vite.config.ts`
- Modify: `src/index.ts`
- Modify: `package.json`
- Modify: package verification tests/scripts as required
- Create: `docs/adr/0027-bounded-local-spreadsheet-body-import.md`
- Modify: `docs/adr/README.md`
- Modify: `README.md`
- Modify: `CHANGELOG.md`
- Modify: `docs/CONTRACTS.md`
- Modify: `docs/THREAT_MODEL.md`
- Modify: `docs/TEST_STRATEGY.md`
- Modify: `docs/TRACEABILITY.md`
- Modify: `docs/accessibility.md`
- Add: machine-checkable documentation contract test

**Interfaces:**
- Produces: package export `@contextualwisdomlab/cwl-editor/spreadsheet` with ESM, CommonJS, and declarations, while keeping React/TipTap runtime code outside that subpath.

- [ ] **Step 1: Add package-consumer RED tests**

Require ESM, CommonJS, and strict NodeNext TypeScript consumers to resolve the spreadsheet subpath and its declared public types from the packed tarball.

- [ ] **Step 2: Add dedicated Vite build**

Build `src/spreadsheet/index.ts` as `cwl-spreadsheet.js` and `cwl-spreadsheet.cjs`; externalize the direct parser dependency so it remains lazy and package-managed rather than copied into ordinary editor startup.

- [ ] **Step 3: Record ADR 0027**

Document context, decision, alternatives (server conversion, CSV-only, paste-only, static parser bundling), parser provenance, formula/macro non-execution, resource bounds, diagnostic privacy, accessibility, host authority, rollback, and release-freeze integration.

- [ ] **Step 4: Reconcile canonical documentation**

Update product contracts, threat model, test strategy, traceability, accessibility, README, and Unreleased changelog without claiming Draft behavior is protected or shipped.

### Task 5: Remove temporary tooling and acquire exact-head evidence

**Files:**
- Delete: `.github/workflows/agent-workspace.yml`
- Update: Draft PR body with exact immutable evidence and limitations

- [ ] **Step 1: Run local complete verification**

Run: `pnpm typecheck && pnpm coverage && pnpm build && pnpm verify:package && pnpm build:demo`

Expected: every command succeeds with exact 100% owned-production coverage.

- [ ] **Step 2: Verify repository hygiene**

Run: `git diff --check`; confirm no temporary workflow, generated coverage, unpacked artifact, secret, credential, or unrelated writer-owned path remains.

- [ ] **Step 3: Acquire hosted exact-head gates**

Require terminal-success CI, Security Scan, and SAST on the unchanged contributor head, including browser and Office matrices. Treat queued, cancelled, predecessor-head, synthetic-only, status-only, and model-only signals as non-passing.

- [ ] **Step 4: Keep the PR Draft and unmerged**

Re-fetch live protected `main`, branch head, reviews, unresolved threads, and issue #118. Do not merge, publish, tag, or move protected release identity while #118 remains open.
