# Paired Revision Evidence Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Return one frozen document envelope together with the SHA-256 strong revision derived from that exact payload across pure, byte, and imperative Inkspan APIs.

**Architecture:** Extend `documentEnvelopeRevision.ts` with a frozen evidence type and paired creation functions. Existing revision-only functions delegate to the paired implementation. Extend the shared `CwlEditorHandle` so standalone and provider-neutral collaborative editors capture one current envelope and return the matching pair without a second editor read.

**Tech Stack:** TypeScript 5.7, TipTap v2/ProseMirror, React 18/19, Vitest 3, RFC 8785 canonical JSON, Web Cryptography-compatible SHA-256.

## Global Constraints

- Preserve existing public API behavior and typed redacted errors.
- Maintain repository-wide 100% TypeScript statement, branch, function, and line coverage.
- Maintain Office Python 3.11 and 3.14 100% branch and docstring coverage gates.
- Add no runtime dependency, provider, transport, database, or environment-variable coupling.
- Use descriptive nonnumeric identifiers; database objects, if introduced, must use two-word-or-longer `snake_case` or CamelCase/PascalCase names.
- Keep the evidence envelope out of telemetry-oriented examples and document CWL/naruon host ownership boundaries.
- Update README, focused guides, package verification, package metadata, CHANGELOG, and version to 0.5.25.

---

### Task 1: Specify and test paired pure evidence

**Files:**
- Modify: `src/documentEnvelopeRevision.test.ts`
- Modify: `src/documentEnvelopeRevision.ts`
- Modify: `src/index.ts`

**Interfaces:**
- Produces: `CwlEditorDocumentRevisionEvidence`
- Produces: `createDocumentEnvelopeRevisionEvidence(source, limits?, digestProvider?)`
- Produces: `createDocumentEnvelopeRevisionEvidenceBytes(source, limits?, digestProvider?)`

- [ ] **Step 1: Write failing object and byte evidence tests**

Add tests that import the new functions, assert the returned envelope and revision are frozen, assert the revision matches the exact canonical bytes of the returned envelope, and assert noncanonical strict UTF-8 input is normalized before hashing.

- [ ] **Step 2: Run the focused tests and verify RED**

Run: `pnpm exec vitest run src/documentEnvelopeRevision.test.ts`

Expected: TypeScript/Vitest fails because the evidence functions and type are not exported.

- [ ] **Step 3: Implement the minimal paired evidence path**

Add the frozen evidence interface, object/JSON and byte functions, and a package-internal validated helper. Make existing revision-only functions delegate and return `.revision`.

- [ ] **Step 4: Export the new public surface**

Export both functions and the evidence type from `src/index.ts`.

- [ ] **Step 5: Run the focused tests and verify GREEN**

Run: `pnpm exec vitest run src/documentEnvelopeRevision.test.ts`

Expected: PASS with no warnings.

### Task 2: Add atomic imperative capture

**Files:**
- Modify: `src/types.ts`
- Modify: `src/components/useEditorHandle.ts`
- Modify: `src/components/useEditorHandle.test.tsx`
- Modify: `src/components/CwlEditor.envelopeHandle.test.tsx`

**Interfaces:**
- Consumes: `CwlEditorDocumentRevisionEvidence`
- Produces: `CwlEditorHandle.getDocumentEnvelopeRevisionEvidence(limits?, digestProvider?)`

- [ ] **Step 1: Write failing lifecycle and active-editor tests**

Assert the empty handle resolves to `null`. For an active editor, assert the returned pair is frozen, matches `getDocumentEnvelope()` content, and uses one digest invocation. Retain the existing revision-only assertion.

- [ ] **Step 2: Run the focused tests and verify RED**

Run: `pnpm exec vitest run src/components/useEditorHandle.test.tsx src/components/CwlEditor.envelopeHandle.test.tsx`

Expected: TypeScript/Vitest fails because the handle method is missing.

- [ ] **Step 3: Implement the minimal handle method**

Import the evidence type into `src/types.ts`. Add `getDocumentEnvelopeRevisionEvidence()`. In `useEditorHandle`, capture one envelope and delegate to the validated paired helper; resolve `null` without invoking a provider when no editor exists. Make `getDocumentEnvelopeRevision()` return `.revision` from the same paired helper.

- [ ] **Step 4: Run the focused tests and verify GREEN**

Run: `pnpm exec vitest run src/components/useEditorHandle.test.tsx src/components/CwlEditor.envelopeHandle.test.tsx`

Expected: PASS with no warnings.

### Task 3: Verify packed consumers and documentation

**Files:**
- Modify: `scripts/verify-package.mjs`
- Modify: `README.md`
- Modify: `docs/document-revision-tags.md`
- Modify: `docs/imperative-envelope-persistence.md`
- Modify: `package.json`
- Modify: `CHANGELOG.md`

**Interfaces:**
- Consumes: all Task 1 and Task 2 public APIs.
- Produces: package version `0.5.25` and buyer-visible usage guidance.

- [ ] **Step 1: Extend strict ESM, CommonJS, and declaration consumer assertions**

Verify the new functions are callable, the evidence type narrows correctly, and `CwlEditorHandle` exposes the new method in the packed declarations.

- [ ] **Step 2: Update buyer-visible documentation**

Document one-call paired capture for autosave, delayed AI, compare/merge/fork, audit, and `If-Match`. State that the envelope is full document content and must not enter ordinary telemetry.

- [ ] **Step 3: Bump version and CHANGELOG**

Set `package.json` to `0.5.25`, update its description, and add the 0.5.25 release entry under `Unreleased`.

- [ ] **Step 4: Run complete verification**

Run:

```bash
pnpm typecheck
pnpm coverage
pnpm build
pnpm verify:package
pnpm build:demo
cd office && python -m pytest --cov=inkspan_office --cov-branch --cov-fail-under=100
```

Expected: all commands pass, TypeScript production coverage is 100%, and Office branch/docstring gates remain 100%.

- [ ] **Step 5: Open or update the pull request and inspect exact-head policy gates**

Confirm all required GitHub Checks, SAST, Security Scan, CodeRabbit, package consumers, Office matrices, and unresolved review-thread gates apply to the current head before merge.
