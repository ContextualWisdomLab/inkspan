# Revision-Guarded Document Restore Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Restore a validated document envelope only when the active editor still matches an expected Inkspan strong revision entity tag.

**Architecture:** Add a focused `documentEnvelopeIfMatch.ts` module that captures one immutable ProseMirror document reference, hashes its versioned canonical envelope, checks for movement during the asynchronous digest, compares an exact generated strong entity tag, then reuses the existing envelope-prepare path for one callback-suppressed replacement. Pure APIs and shared imperative-handle methods cover object/JSON and strict UTF-8 byte inputs while leaving server persistence and conflict UI host-owned.

**Tech Stack:** TypeScript 5.x, TipTap v2, ProseMirror immutable nodes, Web Cryptography SHA-256, Vitest, React Testing Library, Vite, pnpm.

## Global Constraints

- Preserve standalone and provider-neutral Yjs collaboration behavior.
- Add no transport, persistence adapter, credential, environment-variable, database, or naruon-specific runtime dependency.
- Expected tags must exactly match `"sha256-<64 lowercase hexadecimal characters>"`.
- Mismatch and document movement return frozen conflict results; malformed input and provider failure retain typed redacted errors.
- There must be no asynchronous boundary between the final document-identity check and `setContent(..., false)`.
- Maintain repository-wide 100% production statement, branch, function, and line coverage.
- Maintain Office Python 100% statement/branch and shipped-symbol docstring coverage.
- Update package declarations, packed ESM/CommonJS consumers, README/docs, CHANGELOG, and version to 0.5.23 only after behavior is verified.

---

### Task 1: Public conditional-restore behavior

**Files:**
- Create: `src/documentEnvelopeIfMatch.test.tsx`
- Create: `src/documentEnvelopeIfMatch.ts`
- Modify: `src/documentEnvelopeRestore.ts`

**Interfaces:**
- Consumes: `createDocumentEnvelope()`, `createValidatedDocumentEnvelopeRevision()`, `DocumentEnvelopeRevisionError`, and active-schema envelope preparation.
- Produces: `restoreDocumentEnvelopeIfMatch()`, `restoreDocumentEnvelopeBytesIfMatch()`, and `CwlEditorIfMatchRestoreResult`.

- [ ] **Step 1: Write failing tests for matching, mismatch, document movement, malformed tag, bytes, and atomic validation failure**

```ts
const restored = await restoreDocumentEnvelopeIfMatch(
  editor,
  current.strongEntityTag,
  incomingEnvelope,
  undefined,
  digestProvider,
);
expect(restored.status).toBe('restored');
expect(editor.getJSON()).toEqual(incomingEnvelope.documentJson);

const conflict = await restoreDocumentEnvelopeIfMatch(
  editor,
  other.strongEntityTag,
  hostileIncomingSource,
  undefined,
  digestProvider,
);
expect(conflict).toEqual({ status: 'conflict', currentRevision: current });
expect(editor.getJSON()).toEqual(originalJson);
```

Use a deferred digest promise, change the editor before resolving it, and assert a frozen `{ status: 'conflict', currentRevision: null }` with no incoming parse or mutation.

- [ ] **Step 2: Run the focused test and verify RED**

Run: `pnpm vitest run src/documentEnvelopeIfMatch.test.tsx`  
Expected: FAIL because `documentEnvelopeIfMatch.js` and its public functions do not exist.

- [ ] **Step 3: Expose package-internal preparation helpers from the existing restore module**

```ts
export function prepareDocumentEnvelopeForEditor(...): PreparedDocumentEnvelope
export function prepareDocumentEnvelopeBytesForEditor(...): PreparedDocumentEnvelope
```

Both call the existing private parser/schema reconstruction path and do not mutate the editor.

- [ ] **Step 4: Implement exact strong-tag validation and conditional restore**

```ts
const STRONG_REVISION_TAG = /^"sha256-[0-9a-f]{64}"$/u;

export async function restoreDocumentEnvelopeIfMatch(...): Promise<CwlEditorIfMatchRestoreResult> {
  validateExpectedTag(expectedStrongEntityTag);
  const capturedDocument = editor.state.doc;
  const envelope = createDocumentEnvelope(capturedDocument.toJSON(), limits);
  const revision = await createValidatedDocumentEnvelopeRevision(envelope, digestProvider);
  if (editor.state.doc !== capturedDocument) {
    return Object.freeze({ status: 'conflict', currentRevision: null });
  }
  if (revision.strongEntityTag !== expectedStrongEntityTag) {
    return Object.freeze({ status: 'conflict', currentRevision: revision });
  }
  const prepared = prepareDocumentEnvelopeForEditor(editor, source, limits);
  editor.commands.setContent(prepared.documentNode, false);
  return Object.freeze({ status: 'restored', previousRevision: revision, envelope: prepared.envelope });
}
```

The byte function delegates through the byte preparation helper. The implementation validates the expected tag before reading current content.

- [ ] **Step 5: Run focused tests and verify GREEN**

Run: `pnpm vitest run src/documentEnvelopeIfMatch.test.tsx`  
Expected: PASS with no warnings.

- [ ] **Step 6: Commit the pure API slice**

```bash
git add src/documentEnvelopeIfMatch.ts src/documentEnvelopeIfMatch.test.tsx src/documentEnvelopeRestore.ts
git commit -m "feat: restore envelopes under revision preconditions"
```

### Task 2: Shared imperative handle integration

**Files:**
- Modify: `src/types.ts`
- Modify: `src/components/useEditorHandle.ts`
- Modify: `src/components/useEditorHandle.test.tsx`
- Modify: `src/components/CwlEditor.envelopeHandle.test.tsx`

**Interfaces:**
- Consumes: Task 1 pure conditional-restore functions and result type.
- Produces: `CwlEditorHandle.restoreDocumentEnvelopeIfMatch()` and `restoreDocumentEnvelopeBytesIfMatch()`.

- [ ] **Step 1: Add failing empty-handle and active-editor tests**

```ts
await expect(
  handle.restoreDocumentEnvelopeIfMatch(expectedTag, source),
).resolves.toBeNull();
```

For an active editor, verify match restoration, mismatch atomicity, custom limits, digest-provider injection, and callback suppression.

- [ ] **Step 2: Run focused handle tests and verify RED**

Run: `pnpm vitest run src/components/useEditorHandle.test.tsx src/components/CwlEditor.envelopeHandle.test.tsx`  
Expected: TypeScript/runtime failure because the methods are absent.

- [ ] **Step 3: Add documented handle signatures and delegate through the shared implementation**

```ts
restoreDocumentEnvelopeIfMatch(
  expectedStrongEntityTag: string,
  source: unknown,
  limits?: DocumentEnvelopeLimits,
  digestProvider?: DocumentEnvelopeDigestProvider | null,
): Promise<CwlEditorIfMatchRestoreResult | null>;
```

The byte method has the same parameters and result. Before hydration, return `Promise.resolve(null)` without invoking the digest provider.

- [ ] **Step 4: Run focused handle tests and verify GREEN**

Run: `pnpm vitest run src/components/useEditorHandle.test.tsx src/components/CwlEditor.envelopeHandle.test.tsx`  
Expected: PASS.

- [ ] **Step 5: Commit the imperative integration**

```bash
git add src/types.ts src/components/useEditorHandle.ts src/components/useEditorHandle.test.tsx src/components/CwlEditor.envelopeHandle.test.tsx
git commit -m "feat: expose revision-guarded restore on editor handles"
```

### Task 3: Public package and documentation contract

**Files:**
- Modify: `src/index.ts`
- Modify: `scripts/verify-package.mjs`
- Create: `docs/revision-guarded-restore.md`
- Modify: `docs/imperative-envelope-persistence.md`
- Modify: `README.md`
- Modify: `package.json`
- Modify: `CHANGELOG.md`

**Interfaces:**
- Consumes: Tasks 1–2 APIs and types.
- Produces: exact packed ESM/CommonJS/declaration consumer coverage and Inkspan 0.5.23 release metadata.

- [ ] **Step 1: Add failing package-consumer assertions**

Update strict TypeScript consumer declarations to import and type both pure functions and `CwlEditorIfMatchRestoreResult`. Add ESM/CommonJS smoke assertions that both functions are present.

- [ ] **Step 2: Run package verification and verify RED**

Run: `pnpm build && pnpm verify:package`  
Expected: FAIL until the root export surface includes the conditional APIs.

- [ ] **Step 3: Export the pure functions/type and write integration documentation**

Document:
- matching and conflict result handling;
- null current revision when the document moved during digest;
- callback suppression and retry behavior;
- standalone versus collaborative authorization;
- server-side RFC 9110 `If-Match` remains mandatory;
- CWL/naruon ownership and descriptive identifier requirements.

- [ ] **Step 4: Bump `package.json` to 0.5.23 and add a dated CHANGELOG section**

Record Added, Changed, Reliability, Security, Tests, and Documentation sections. Do not claim registry publication.

- [ ] **Step 5: Run package verification and verify GREEN**

Run: `pnpm build && pnpm verify:package`  
Expected: PASS for npm manifest, ESM, CommonJS, SSR-safe imports, subpaths, assets, and strict declarations.

- [ ] **Step 6: Commit package and documentation changes**

```bash
git add src/index.ts scripts/verify-package.mjs docs/revision-guarded-restore.md docs/imperative-envelope-persistence.md README.md package.json CHANGELOG.md
git commit -m "docs: publish revision-guarded restore contract"
```

### Task 4: Full exact-head verification and merge preparation

**Files:**
- Verify all files changed in Tasks 1–3.

**Interfaces:**
- Consumes: complete 0.5.23 candidate.
- Produces: reviewable PR with exact-head evidence.

- [ ] **Step 1: Run the full JavaScript gate**

Run:

```bash
pnpm install --frozen-lockfile
pnpm typecheck
pnpm coverage
pnpm build
pnpm verify:package
pnpm build:demo
```

Expected: all commands exit 0 and coverage reports 100% statements, branches, functions, and lines.

- [ ] **Step 2: Run Office gates**

Run:

```bash
cd office
python scripts/check_docstrings.py
coverage run -m pytest
coverage report
python -m pip check
python -m pip wheel . --no-deps --no-build-isolation --wheel-dir dist
```

Expected: tests pass, 100% statement/branch coverage, no missing shipped-symbol docstrings, dependency consistency, and wheel build success.

- [ ] **Step 3: Inspect diff and documentation consistency**

Confirm there are no temporary workflows, placeholders, unrelated dependency changes, database additions, provider coupling, raw secret diagnostics, or stale 0.5.22 descriptions.

- [ ] **Step 4: Open the PR and verify current-head review/check gates**

Require CI, Office Python 3.11/3.14, SAST, Security Scan, CodeRabbit, package verification, and no unresolved actionable review threads.

- [ ] **Step 5: Merge only with an expected-head guard**

Use squash merge only after all exact-head gates succeed, then confirm the open PR list is empty before selecting the next product slice.
