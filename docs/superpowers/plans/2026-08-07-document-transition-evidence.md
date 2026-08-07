# Document Transition Evidence Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add compact framework-independent evidence that deterministically binds one validated Inkspan document revision to another without exposing complete document content or claiming durable occurrence provenance.

**Architecture:** A new pure module parses both inputs before hashing, derives two existing SHA-256 revision objects sequentially, and returns one frozen schema object containing only previous/resulting revisions and `changed`. The package root and existing `/revision-evidence` subpath expose the same API; no transport, persistence, identity, tenant, model, editor, or database responsibility moves into Inkspan.

**Tech Stack:** TypeScript 5.7, Vitest 3, Vite library mode, npm packed-artifact verification, RFC 8785 canonical JSON, RFC 9110 validators, SHA-256.

## Global Constraints

- Work only in `ContextualWisdomLab/inkspan`; `.github` and `contextual-orchestrator` remain read-only dependencies.
- Start from exact protected-main commit `ca49a3249403be88ba3cb7c9589b3652f820e17c` and stop if another writer moves the branch unexpectedly.
- Do not modify PR #65 or PR #67 and do not start issue #66 before PR #65 merges.
- Write the behavioral test before production implementation and retain the failing exact-head CI evidence.
- Preserve 100% production statement, branch, function, and line coverage and beginner-readable public documentation.
- Add no runtime dependency, network call, credential, tenant identifier, database object, scheduler, model call, or write-capable workflow.
- Keep full envelopes private; transition evidence must expose revisions only.
- Do not bump or publish a version until protected integration, independent approval, provenance, and release-acceptance gates pass.

---

### Task 1: Specify the privacy-minimized transition contract

**Files:**
- Create: `src/documentTransitionEvidence.test.ts`

**Interfaces:**
- Consumes: existing `createDocumentEnvelope()`, `encodeDocumentEnvelope()`, `DocumentEnvelopeDigestProvider`, and planned transition APIs.
- Produces: failing behavioral requirements for `DOCUMENT_TRANSITION_EVIDENCE_SCHEMA_ID`, `DOCUMENT_TRANSITION_EVIDENCE_SCHEMA_VERSION`, `createDocumentEnvelopeTransitionEvidence()`, `createDocumentEnvelopeTransitionEvidenceBytes()`, and `CwlEditorDocumentTransitionEvidence`.

- [ ] **Step 1: Write the failing core test**

Create tests that import the not-yet-implemented module and cover:

```ts
const changed = await createDocumentEnvelopeTransitionEvidence(
  previousEnvelope,
  resultingEnvelope,
  undefined,
  nativeSha256Provider,
);
expect(changed.schemaId).toBe(
  'https://inkspan.io/schemas/document-transition-evidence/v1',
);
expect(changed.schemaVersion).toBe(1);
expect(changed.changed).toBe(true);
expect(changed.previousRevision.digestHex).toBe(PREVIOUS_KNOWN_DIGEST);
expect(changed.resultingRevision.digestHex).toBe(RESULTING_KNOWN_DIGEST);
expect(Object.isFrozen(changed)).toBe(true);
expect(Object.isFrozen(changed.previousRevision)).toBe(true);
expect(Object.isFrozen(changed.resultingRevision)).toBe(true);
expect(JSON.stringify(changed)).not.toContain('Confidential author text');
```

Add focused cases proving:

```ts
expect(unchanged.changed).toBe(false);
expect(digestProvider.digest).toHaveBeenCalledTimes(2);
expect(maximumConcurrentDigestCalls).toBe(1);
expect(digestInputs).toEqual([
  encodeDocumentEnvelope(previousEnvelope),
  encodeDocumentEnvelope(resultingEnvelope),
]);
```

For invalid resulting input, assert the promise rejects and `digest` is never called. For strict UTF-8, encode equivalent noncanonical JSON and assert the revision pair equals the object path. Recursively inspect result keys and reject `envelope`, `documentJson`, `text`, `href`, `alt`, and `src`.

- [ ] **Step 2: Run the focused test to verify RED**

Run:

```bash
pnpm vitest run src/documentTransitionEvidence.test.ts
```

Expected: FAIL during module resolution because `src/documentTransitionEvidence.ts` does not exist.

- [ ] **Step 3: Commit the RED test only**

```bash
git add src/documentTransitionEvidence.test.ts
git commit -m "test: specify document transition evidence"
```

---

### Task 2: Implement the pure transition module and root API

**Files:**
- Create: `src/documentTransitionEvidence.ts`
- Modify: `src/index.ts`
- Test: `src/documentTransitionEvidence.test.ts`

**Interfaces:**
- Consumes: `parseDocumentEnvelope()`, `parseDocumentEnvelopeBytes()`, `createValidatedDocumentEnvelopeRevisionEvidence()`, `DocumentEnvelopeLimits`, and `DocumentEnvelopeDigestProvider`.
- Produces:

```ts
export const DOCUMENT_TRANSITION_EVIDENCE_SCHEMA_ID =
  'https://inkspan.io/schemas/document-transition-evidence/v1' as const;
export const DOCUMENT_TRANSITION_EVIDENCE_SCHEMA_VERSION = 1 as const;

export interface CwlEditorDocumentTransitionEvidence {
  readonly schemaId: typeof DOCUMENT_TRANSITION_EVIDENCE_SCHEMA_ID;
  readonly schemaVersion: typeof DOCUMENT_TRANSITION_EVIDENCE_SCHEMA_VERSION;
  readonly previousRevision: CwlEditorDocumentRevision;
  readonly resultingRevision: CwlEditorDocumentRevision;
  readonly changed: boolean;
}
```

- [ ] **Step 1: Implement the minimal object and byte entrypoints**

Use one private helper with a parser parameter. Parse both sources before hashing:

```ts
const previousEnvelope = parse(previousSource, limits);
const resultingEnvelope = parse(resultingSource, limits);
const previous = await createValidatedDocumentEnvelopeRevisionEvidence(
  previousEnvelope,
  digestProvider,
);
const resulting = await createValidatedDocumentEnvelopeRevisionEvidence(
  resultingEnvelope,
  digestProvider,
);
return Object.freeze({
  schemaId: DOCUMENT_TRANSITION_EVIDENCE_SCHEMA_ID,
  schemaVersion: DOCUMENT_TRANSITION_EVIDENCE_SCHEMA_VERSION,
  previousRevision: previous.revision,
  resultingRevision: resulting.revision,
  changed: previous.revision.digestHex !== resulting.revision.digestHex,
});
```

Document every public constant, field, and function. Explain that output is local content-lineage evidence and not identity, authorization, time, signature, durable commit, or transport evidence.

- [ ] **Step 2: Export the contract from the root package**

Add value exports for both constants and both functions plus a type export for `CwlEditorDocumentTransitionEvidence` in `src/index.ts` beside revision evidence.

- [ ] **Step 3: Run focused tests and production coverage**

Run:

```bash
pnpm vitest run src/documentTransitionEvidence.test.ts
pnpm vitest run --coverage
```

Expected: all tests pass and production statement, branch, function, and line coverage remain 100%.

- [ ] **Step 4: Commit the core implementation**

```bash
git add src/documentTransitionEvidence.ts src/index.ts
git commit -m "feat: add deterministic document transition evidence"
```

---

### Task 3: Preserve the framework-independent package boundary

**Files:**
- Modify: `src/revision-evidence/index.ts`
- Modify: `src/revision-evidence/index.test.ts`
- Modify: `vite.revision-evidence.config.ts`
- Modify: `scripts/verify-framework-free-revision-evidence-package.mjs`

**Interfaces:**
- Consumes: Task 2 transition constants, type, and functions.
- Produces: matching ESM, CommonJS, and strict TypeScript exports from `@contextualwisdomlab/cwl-editor/revision-evidence` without framework imports.

- [ ] **Step 1: Add failing subpath tests before exports**

Extend `src/revision-evidence/index.test.ts` to import the transition API and assert the stable schema constants, changed/unchanged behavior, frozen result, and two digest calls. Run:

```bash
pnpm vitest run src/revision-evidence/index.test.ts
```

Expected: FAIL because the subpath does not export the new symbols.

- [ ] **Step 2: Add subpath wrapper declarations and runtime exports**

Import the internal functions and constants into `src/revision-evidence/index.ts`. Define the framework-neutral transition type using the existing local revision type and expose wrappers with the same signatures. Keep casts constrained to the adapter boundary and do not import editor/framework types.

- [ ] **Step 3: Include the new module in declaration generation**

Add `src/documentTransitionEvidence.ts` to the `vite-plugin-dts` include list in `vite.revision-evidence.config.ts`.

- [ ] **Step 4: Extend packed consumers**

In `scripts/verify-framework-free-revision-evidence-package.mjs`:

- assert both transition functions exist in ESM and CommonJS;
- execute a realistic before/after transition and assert `changed === true`;
- assert the result contains no `envelope` field;
- import `CwlEditorDocumentTransitionEvidence` in the strict TypeScript consumer;
- compile with `lib: ['ES2022']` and `types: []` unchanged.

- [ ] **Step 5: Verify build and package isolation**

Run:

```bash
pnpm run build
node scripts/verify-framework-free-revision-evidence-package.mjs
pnpm run verify:package
```

Expected: dedicated ESM/CommonJS/declaration artifacts pass without React, React DOM, TipTap, ProseMirror, or Yjs installed in the isolated consumer.

- [ ] **Step 6: Commit the package-boundary implementation**

```bash
git add src/revision-evidence/index.ts src/revision-evidence/index.test.ts vite.revision-evidence.config.ts scripts/verify-framework-free-revision-evidence-package.mjs
git commit -m "build: publish transition evidence without framework coupling"
```

---

### Task 4: Bind buyer-visible, operator, and doctoring records

**Files:**
- Create: `docs/doctoring/document-transition-evidence.md`
- Create: `src/documentTransitionDocumentation.test.ts`
- Modify: `README.md`
- Modify: `ARCHITECTURE.md`
- Modify: `docs/revision-evidence-subpath.md`
- Modify: `CHANGELOG.md`

**Interfaces:**
- Consumes: the exact Task 2 and Task 3 public API.
- Produces: discoverable host integration guidance, privacy/claim boundaries, APA 7 references, rollback instructions, and deterministic documentation regression tests.

- [ ] **Step 1: Write the failing documentation contract**

Create a Vitest file that reads repository Markdown and requires:

```ts
expect(readme).toContain('createDocumentEnvelopeTransitionEvidence');
expect(architecture).toContain('content-lineage evidence');
expect(operatorGuide).toContain('does not prove that a durable write occurred');
expect(doctoring).toContain('PROV-DM');
expect(doctoring).toContain('RFC 8785');
expect(doctoring).toContain('RFC 9110');
expect(changelog).toContain('privacy-minimized document transition evidence');
```

Run:

```bash
pnpm vitest run src/documentTransitionDocumentation.test.ts
```

Expected: FAIL because the product and operator records are not yet updated.

- [ ] **Step 2: Add buyer-visible usage and ownership guidance**

Add a concise README example that creates transition evidence and sends only the compact result into a host-owned authenticated audit/event pipeline. State that full document bodies remain private and that hosts own actor identity, tenancy, operation type, server time, durable result, signing, retention, and access policy.

Update `ARCHITECTURE.md` data/evidence ownership so compact content-lineage evidence is an Inkspan output while occurrence provenance and durable audit storage remain host-owned.

Extend `docs/revision-evidence-subpath.md` with the new API, failure behavior, sequential hashing, privacy boundary, and standalone/CWL/naruon use.

- [ ] **Step 3: Add doctoring and changelog records**

Create `docs/doctoring/document-transition-evidence.md` with:

- decision and rejected alternatives;
- exact schema and field meanings;
- W3C PROV entity/derivation versus activity/agent/time boundary;
- RFC 8785, RFC 9110, and FIPS 180-4 basis;
- current NIST note that FIPS 180-4 is planned for revision while SHA-256 remains in current FIPS validation testing;
- threat analysis for content leakage and overclaiming;
- verification, residual limits, and rollback;
- APA 7 references.

Record the unreleased feature in `CHANGELOG.md` without changing package version.

- [ ] **Step 4: Run documentation and full repository verification**

Run:

```bash
pnpm vitest run src/documentTransitionDocumentation.test.ts
pnpm run typecheck
pnpm run coverage
pnpm run build
pnpm run build:demo
pnpm run verify:package
```

Expected: all commands pass with 100% production coverage and complete package verification.

- [ ] **Step 5: Commit the documentation evidence**

```bash
git add README.md ARCHITECTURE.md CHANGELOG.md docs/revision-evidence-subpath.md docs/doctoring/document-transition-evidence.md src/documentTransitionDocumentation.test.ts
git commit -m "docs: define transition evidence provenance boundary"
```

---

### Task 5: Exact-head integration and protected review

**Files:**
- No new production files.

**Interfaces:**
- Consumes: the complete branch from Tasks 1-4.
- Produces: a Draft pull request with exact-head test, security, package, review, and approval evidence.

- [ ] **Step 1: Open a Draft PR from the exact current head**

The PR body must record the protected base SHA, RED commit, exact current head,
standalone/MSA boundary, no-version-bump decision, test commands, privacy claim
boundary, and dependency independence from PR #65, issue #66, `.github`, and
`contextual-orchestrator`.

- [ ] **Step 2: Inspect every exact-head check and review surface**

Require successful CI, Security Scan, SAST Semgrep, CodeRabbit status, any
inherited central checks, zero valid unresolved human or automated findings, and
no queued, pending, cancelled, skipped-required, absent, stale-head, failed, or
synthetic-merge evidence counted as success.

- [ ] **Step 3: Address valid findings test-first**

For every valid review or CI finding, re-read the exact branch head and target
blob, add a focused failing regression, implement the minimal fix, rerun the
exact-head gates, and resolve only the addressed thread.

- [ ] **Step 4: Merge only after protected acceptance**

Mark ready and merge only when a qualifying independent non-author approval,
branch protection, repository policy, security gates, and every required exact-
head check pass. Do not publish a release from this feature PR.
