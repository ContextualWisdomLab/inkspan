# Atomic Conflict Evidence Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Return the exact frozen envelope paired with every non-null revision in revision-guarded restore results, eliminating the host-side post-conflict snapshot race.

**Architecture:** Extend the existing result union additively with `previousEnvelope` and `currentEnvelope`. Encode stable conflict evidence and moved/destroyed null evidence as distinct TypeScript union variants. Reuse the `currentEnvelope` already created before SHA-256 hashing; do not introduce another clone, serialization, digest, transport adapter, or persistence dependency.

**Tech Stack:** TypeScript 5.9, TipTap/ProseMirror, React 18/19 declarations, Vitest 3, V8 coverage, pnpm 11, Vite, Yjs, Node.js 22, Python 3.11/3.14 Office verification.

## Global Constraints

- Preserve all Inkspan 0.5.23 result properties and invocation signatures.
- Every non-null revision must be paired with the envelope used to compute it.
- Moved or destroyed editor conflicts must return both evidence properties as `null`.
- Do not inspect the incoming source on revision mismatch, document movement, or editor destruction.
- Do not add a second document clone, canonical serialization, digest, or ProseMirror reconstruction.
- Keep result objects shallow-frozen and preserve existing deep-frozen envelope/revision contracts.
- Maintain repository-wide 100% production statement, branch, function, and line coverage.
- Maintain Office Python 100% branch and shipped-symbol docstring coverage on Python 3.11 and 3.14.
- Add no database, credential, environment-variable, network-provider, persistence-adapter, or naruon-specific runtime dependency.
- Release as Inkspan 0.5.24 with `CHANGELOG.md` updated.

---

### Task 1: Specify conflict evidence with failing behavior tests

**Files:**
- Create: `src/documentEnvelopeIfMatch.evidence.test.tsx`
- Modify: `src/documentEnvelopeIfMatch.lifecycle.test.tsx`
- Modify: `src/documentEnvelopeIfMatch.reentrancy.test.tsx`

**Interfaces:**
- Consumes: `restoreDocumentEnvelopeIfMatch()`, `createDocumentEnvelopeRevision()`, `CwlEditorHandle`.
- Produces: failing assertions for `previousEnvelope` and `currentEnvelope` on every result class.

- [ ] **Step 1: Add a focused stable-mismatch evidence test**

Create `src/documentEnvelopeIfMatch.evidence.test.tsx` with a real mounted editor and deterministic digest provider. The stable mismatch case must assert:

```ts
expect(result).toEqual({
  status: 'conflict',
  currentRevision,
  currentEnvelope,
});
expect(Object.isFrozen(result)).toBe(true);
expect(Object.isFrozen(result.currentEnvelope)).toBe(true);
```

Use a hostile incoming source whose getter throws, proving mismatch returns evidence without source inspection.

- [ ] **Step 2: Add a successful-restore previous-envelope test**

In the same file, capture the current envelope and revision, restore a different valid envelope, and assert:

```ts
expect(result).toEqual({
  status: 'restored',
  previousRevision,
  previousEnvelope,
  envelope: incomingEnvelope,
});
```

The equality assertion and revision re-derivation prove the evidence describes the same document. Implementation review plus provider-call coverage verify that the implementation returns its already-created internal envelope rather than performing a second digest or editor read.

- [ ] **Step 3: Tighten null-evidence lifecycle assertions**

Change destroyed-editor conflict expectations in `src/documentEnvelopeIfMatch.lifecycle.test.tsx` to:

```ts
{
  status: 'conflict',
  currentRevision: null,
  currentEnvelope: null,
}
```

- [ ] **Step 4: Tighten null-evidence reentrancy assertions**

Change the source-reflection reentrancy expectation in `src/documentEnvelopeIfMatch.reentrancy.test.tsx` to the same null-evidence conflict shape.

- [ ] **Step 5: Verify RED**

Run:

```bash
pnpm vitest run \
  src/documentEnvelopeIfMatch.evidence.test.tsx \
  src/documentEnvelopeIfMatch.lifecycle.test.tsx \
  src/documentEnvelopeIfMatch.reentrancy.test.tsx
```

Expected: focused tests fail because the current result type and runtime objects do not contain `previousEnvelope` or `currentEnvelope`.

- [ ] **Step 6: Commit the failing specification**

```bash
git add \
  src/documentEnvelopeIfMatch.evidence.test.tsx \
  src/documentEnvelopeIfMatch.lifecycle.test.tsx \
  src/documentEnvelopeIfMatch.reentrancy.test.tsx
git commit -m "test: specify atomic conflict evidence"
```

### Task 2: Implement additive envelope evidence without extra work

**Files:**
- Modify: `src/documentEnvelopeIfMatch.ts`
- Test: `src/documentEnvelopeIfMatch.evidence.test.tsx`
- Test: `src/documentEnvelopeIfMatch.test.tsx`
- Test: `src/documentEnvelopeIfMatch.lifecycle.test.tsx`
- Test: `src/documentEnvelopeIfMatch.reentrancy.test.tsx`

**Interfaces:**
- Consumes: the existing captured `currentEnvelope`, `currentRevision`, `PreparedDocumentEnvelope`, and editor-movement checks.
- Produces: additive `previousEnvelope` and `currentEnvelope` result properties.

- [ ] **Step 1: Extend the public result union**

Update `CwlEditorIfMatchRestoreResult` so the restored branch includes:

```ts
readonly previousEnvelope: CwlEditorDocumentEnvelope;
```

Encode the two conflict states separately:

```ts
| {
    readonly status: 'conflict';
    readonly currentRevision: CwlEditorDocumentRevision;
    readonly currentEnvelope: CwlEditorDocumentEnvelope;
  }
| {
    readonly status: 'conflict';
    readonly currentRevision: null;
    readonly currentEnvelope: null;
  }
```

Document that each non-null revision and envelope describe the same captured editor document and that null fields always occur in lockstep.

- [ ] **Step 2: Return stable mismatch evidence**

Change the stable mismatch result to:

```ts
return Object.freeze({
  status: 'conflict',
  currentRevision,
  currentEnvelope,
});
```

Do not parse or inspect `source` before this return.

- [ ] **Step 3: Return previous evidence on success**

Change the restored result to:

```ts
return Object.freeze({
  status: 'restored',
  previousRevision: currentRevision,
  previousEnvelope: currentEnvelope,
  envelope,
});
```

Use the exact existing `currentEnvelope` object reference.

- [ ] **Step 4: Return null evidence when no stable current version exists**

Change `createMovedDocumentConflict()` to:

```ts
return Object.freeze({
  status: 'conflict',
  currentRevision: null,
  currentEnvelope: null,
});
```

This helper must remain the common path for document movement and editor destruction.

- [ ] **Step 5: Update existing exact-object assertions**

Add `previousEnvelope` or `currentEnvelope` to exact result assertions in `src/documentEnvelopeIfMatch.test.tsx` without weakening them to partial matching.

- [ ] **Step 6: Verify GREEN and full production coverage**

Run:

```bash
pnpm typecheck
pnpm vitest run \
  src/documentEnvelopeIfMatch.evidence.test.tsx \
  src/documentEnvelopeIfMatch.test.tsx \
  src/documentEnvelopeIfMatch.lifecycle.test.tsx \
  src/documentEnvelopeIfMatch.reentrancy.test.tsx
pnpm coverage
```

Expected: all focused tests pass and production statement, branch, function, and line coverage are all 100%.

- [ ] **Step 7: Commit the implementation**

```bash
git add src/documentEnvelopeIfMatch.ts src/documentEnvelopeIfMatch*.test.tsx
git commit -m "feat: return envelopes with guarded restore revisions"
```

### Task 3: Verify imperative, collaborative, and packed consumer contracts

**Files:**
- Modify: `src/components/CwlEditor.envelopeHandle.test.tsx`
- Modify: `src/collaboration/CollaborativeCwlEditor.envelopeRestore.test.tsx`
- Modify: `scripts/verify-package.mjs`

**Interfaces:**
- Consumes: the shared `CwlEditorHandle` methods and root-package result type.
- Produces: standalone, Yjs-backed, and strict external consumer evidence for the additive fields.

- [ ] **Step 1: Assert standalone handle evidence**

Update the imperative handle test so a successful object and byte restore asserts `previousEnvelope`, and a stable mismatch asserts `currentEnvelope` paired with `currentRevision`.

- [ ] **Step 2: Assert collaborative evidence**

Update the Yjs-backed test to capture the pre-restore envelope and assert the returned `previousEnvelope` describes that exact frozen document while the Yjs document converges to the incoming content.

- [ ] **Step 3: Compile additive result fields externally**

In `scripts/verify-package.mjs`, add strict TypeScript narrowing without non-null assertions:

```ts
conditionalRestore.then((result) => {
  if (result === null) return;
  if (result.status === 'restored') {
    result.previousEnvelope.documentJson;
    return;
  }
  if (result.currentRevision === null) {
    const currentEnvelope: null = result.currentEnvelope;
    void currentEnvelope;
    return;
  }
  result.currentEnvelope.documentJson;
});
```

Keep existing ESM and CommonJS runtime export checks unchanged because no new runtime symbol is introduced.

- [ ] **Step 4: Verify package consumers**

Run:

```bash
pnpm build
pnpm verify:package
pnpm build:demo
```

Expected: library, collaboration, converter, ESM, CommonJS, strict declarations, package contents, and demo builds all succeed.

- [ ] **Step 5: Commit consumer verification**

```bash
git add \
  src/components/CwlEditor.envelopeHandle.test.tsx \
  src/collaboration/CollaborativeCwlEditor.envelopeRestore.test.tsx \
  scripts/verify-package.mjs
git commit -m "test: verify conflict evidence across consumers"
```

### Task 4: Document and release Inkspan 0.5.24

**Files:**
- Modify: `package.json`
- Modify: `README.md`
- Modify: `docs/revision-guarded-restore.md`
- Modify: `docs/imperative-envelope-persistence.md`
- Modify: `CHANGELOG.md`

**Interfaces:**
- Consumes: the finalized additive result contract.
- Produces: buyer-facing integration guidance and release metadata.

- [ ] **Step 1: Bump package metadata**

Set `package.json` version to `0.5.24` and describe atomic revision-envelope conflict evidence without changing package exports or dependencies.

- [ ] **Step 2: Update README examples**

Show that a stable conflict exposes `currentRevision` and `currentEnvelope` from one captured document, while null evidence requires a fresh read. State that the envelope contains full document content and must not be logged indiscriminately.

- [ ] **Step 3: Expand persistence documentation**

Document:

- `previousRevision` ↔ `previousEnvelope` pairing;
- `currentRevision` ↔ `currentEnvelope` pairing;
- null evidence for moved or destroyed editors;
- no second clone or hash;
- conflict evidence privacy and tenant-authorization responsibilities;
- durable server-side RFC 9110 compare-and-swap remains mandatory.

- [ ] **Step 4: Add the 0.5.24 changelog section**

Add `## [0.5.24] — 2026-08-04` under `Unreleased` with Added, Reliability, Performance, Security, Tests, and Documentation sections.

- [ ] **Step 5: Run all repository gates**

Run:

```bash
pnpm install --frozen-lockfile
pnpm typecheck
pnpm coverage
pnpm build
pnpm verify:package
pnpm build:demo

cd office
python -m pip install --require-hashes --only-binary=:all: -r requirements-ci.txt
python -m pip check
python scripts/check_docstrings.py
coverage run -m pytest
coverage report
python -m pip wheel . --no-deps --no-build-isolation --wheel-dir dist
```

Expected: every command succeeds; TypeScript and Python production coverage/docstring gates remain 100%.

- [ ] **Step 6: Commit release metadata**

```bash
git add package.json README.md docs/revision-guarded-restore.md \
  docs/imperative-envelope-persistence.md CHANGELOG.md
git commit -m "docs: release Inkspan 0.5.24 conflict evidence"
```

### Task 5: PR review, exact-head verification, and merge

**Files:**
- No additional production files unless review or checks identify a defect.

**Interfaces:**
- Consumes: the complete branch head.
- Produces: a squash-merged, release-ready main commit with zero open PRs.

- [ ] **Step 1: Open the pull request**

Create a draft PR titled `feat: return atomic conflict evidence` against `main`. Describe the buyer race, additive API, privacy boundary, no-extra-copy performance property, and required gates.

- [ ] **Step 2: Review every current-head finding**

Inspect human, CodeRabbit, code-scanning, dependency, and security feedback. Fix actionable findings test-first, resolve addressed threads, and do not dismiss unresolved defects.

- [ ] **Step 3: Require exact-head checks**

Confirm the final head passes CI, SAST Semgrep, Security Scan, CodeRabbit, 100% coverage, package consumers, demo build, and Office Python 3.11/3.14 gates.

- [ ] **Step 4: Merge with an expected-head guard**

Squash merge only with the exact verified head SHA. Re-query open PRs immediately afterward and confirm the queue is zero before starting another product slice.
