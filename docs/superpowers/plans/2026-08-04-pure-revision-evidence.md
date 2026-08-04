# Pure Document Revision Evidence Implementation Plan

> **For agentic workers:** Execute test-first and verify the exact PR head before merge.

**Goal:** Add framework-independent object/JSON and strict UTF-8 functions that return one frozen normalized document envelope together with the SHA-256 revision derived from that exact payload.

**Architecture:** Extend `documentRevisionEvidence.ts` with object, byte, and validated-envelope evidence helpers. Reuse the validated helper from the shared imperative editor handle. Export the pure functions from the root package and verify packed ESM, CommonJS, and strict TypeScript consumers.

**Tech Stack:** TypeScript 5.7, RFC 8785 canonical JSON, Web Cryptography-compatible SHA-256, Vitest 3, React 18/19, TipTap v2/ProseMirror.

## Constraints

- Preserve all 0.5.25 API behavior and typed redacted errors.
- Maintain repository-wide 100% TypeScript statement, branch, function, and line coverage.
- Maintain Office Python 3.11/3.14 100% branch and shipped-symbol docstring coverage.
- Add no runtime dependency or provider/transport/database/environment coupling.
- Use descriptive nonnumeric identifiers; any database object introduced must use two-word-or-longer `snake_case` or CamelCase/PascalCase.
- Protect evidence envelopes as full document content in all examples.
- Update README, focused documentation, package verification, package metadata, CHANGELOG, and version to 0.5.26.

### Task 1: Specify pure evidence behavior

**Files:**
- Create: `src/documentRevisionEvidence.test.ts`
- Modify: `src/documentRevisionEvidence.ts`
- Modify: `src/index.ts`

- [ ] Write failing object/JSON and byte evidence tests.
- [ ] Verify RED: missing pure evidence exports.
- [ ] Implement object/JSON, strict UTF-8, and validated-envelope helpers.
- [ ] Export both functions from the root package.
- [ ] Verify focused tests pass.

### Task 2: Share pairing logic with imperative capture

**Files:**
- Modify: `src/components/useEditorHandle.ts`
- Verify: `src/components/CwlEditor.envelopeHandle.test.tsx`
- Verify: `src/components/useEditorHandle.test.tsx`

- [ ] Replace the local imperative pairing helper with the shared validated-envelope helper.
- [ ] Confirm one editor read, stable asynchronous evidence, frozen results, and lifecycle `null` behavior remain covered.
- [ ] Run focused imperative tests.

### Task 3: Complete commercial packaging and release metadata

**Files:**
- Modify: `scripts/verify-revision-evidence-package.mjs`
- Modify: `README.md`
- Modify: `docs/document-revision-tags.md`
- Modify: `docs/imperative-envelope-persistence.md`
- Modify: `package.json`
- Modify: `CHANGELOG.md`

- [ ] Verify packed ESM, CommonJS, and strict declaration consumers.
- [ ] Document server, worker, migration, autosave, AI, compare/merge/fork, privacy, and CWL/naruon boundaries.
- [ ] Bump version and add the 0.5.26 CHANGELOG entry.
- [ ] Run complete CI, package, demo, Office, SAST, Security Scan, CodeRabbit, exact-head, and unresolved-thread gates.
- [ ] Merge only when the current head satisfies repository policy.
