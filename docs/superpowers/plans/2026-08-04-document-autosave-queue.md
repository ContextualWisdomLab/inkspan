# Provider-Neutral Document Autosave Queue Implementation Plan

> **For agentic workers:** Execute every task test-first, preserve the host/Inkspan ownership boundary, and verify the exact current PR head before merge.

**Goal:** Add a framework-independent, bounded-memory, single-flight autosave queue that coalesces immutable document revision evidence without owning transport, authorization, persistence, tenancy, credentials, timers, migration, retention, or conflict UX.

**Architecture:** Publish a dedicated `@contextualwisdomlab/cwl-editor/autosave` subpath. The queue accepts `CwlEditorDocumentRevisionEvidence`, validates its public revision contract, invokes one host-owned save callback at a time, keeps at most one not-yet-started revision, coalesces matching revisions and concurrent flush waiters, pauses after conflict or callback failure, and exposes frozen document-free state. The subpath must evaluate without React, TipTap, ProseMirror, or Yjs.

**Tech stack:** TypeScript 5.7, Node.js 22, Vite 6 library builds, Vitest 3 with 100% statement/branch/function/line coverage, npm packed-artifact ESM/CommonJS/strict declaration consumers.

## Constraints

- No production code before an observed failing test.
- No timer, network, persistence, provider SDK, credential, tenant, environment-variable, React, TipTap, ProseMirror, or Yjs dependency in the autosave source graph.
- At most one active save, one pending evidence object, and one shared pending flush promise.
- Never expose document bodies in queue snapshots or request outcomes.
- Preserve redacted errors and fail-closed validation.
- Keep all public objects frozen and all public APIs beginner-readable through complete JSDoc.
- Maintain repository-wide 100% production statement and branch coverage and Office 100% branch/docstring coverage.
- Introduce no database object. Future host objects retain the two-descriptive-word naming rule and `snake_case` default.
- Target package version 0.5.28 only after the integrated exact head is release-ready.

### Task 1: Specify queue behavior with a RED contract

**Files:**
- Create: `src/autosave/index.test.ts`
- Create: `src/autosave/index.ts` only after the RED run

**Test-first contract:**

```ts
import {
  createDocumentAutosaveQueue,
  type DocumentAutosaveSaveFunction,
} from './index.js';

const queue = createDocumentAutosaveQueue({ save });
const outcome = await queue.enqueue(evidence);
expect(outcome.status).toBe('saved');
```

Coverage scenarios:

- saved request and frozen/document-free snapshot;
- same-revision active and pending coalescing;
- one pending revision and deterministic supersession;
- strict single-flight callback ordering and re-entrant enqueue;
- unchanged outcome after a durable save;
- conflict pause, queued retention, `flush()`, and `resume()`;
- one shared pending `flush()` promise under repeated calls;
- thrown callback and invalid callback result with redacted error and recovery;
- close while idle, saving, and blocked;
- invalid evidence, digest/tag mismatch, invalid options, and invalid callback brand;
- bounded retention under many pending revisions;
- every public branch, result, error, and lifecycle state.

**Verification:**

1. Open a draft PR from the RED commit.
2. Confirm the exact head fails because the autosave module or public contract is missing—not because of a syntax or fixture error.
3. Implement the minimal queue state machine.
4. Re-run the focused test and confirm green before refactoring.

### Task 2: Implement the framework-independent state machine

**Files:**
- Create: `src/autosave/index.ts`
- Modify: `src/autosave/index.test.ts`
- Create: `src/autosave/flushCoalescing.test.ts`

**Public types:**

```ts
export type DocumentAutosaveQueueState =
  | 'idle'
  | 'saving'
  | 'blocked'
  | 'closing'
  | 'closed';

export type DocumentAutosaveBlockedReason = 'conflict' | 'failure';

export interface DocumentAutosaveQueueSnapshot {
  readonly state: DocumentAutosaveQueueState;
  readonly blockedReason: DocumentAutosaveBlockedReason | null;
  readonly activeStrongEntityTag: string | null;
  readonly pendingStrongEntityTag: string | null;
  readonly lastSavedStrongEntityTag: string | null;
}
```

**Implementation rules:**

- Validate a plain options object with exactly one callable `save` data field.
- Validate an evidence object using ordinary data properties, SHA-256 algorithm, lowercase 64-character digest, exact quoted `"sha256-<digest>"` tag, and a frozen envelope/revision/evidence graph.
- Enqueue synchronously records or coalesces work, then starts a microtask-safe pump.
- The pump removes the pending request before invoking the host callback so re-entrant enqueue can create the next pending request.
- Saved outcomes advance `lastSavedStrongEntityTag`; conflicts block; exceptions and invalid outcomes reject active callers with one redacted `DocumentAutosaveQueueError` and block.
- `resume()` clears blocked state and restarts the pump only when work remains.
- Concurrent nonterminal `flush()` calls return the same pending promise, which resolves on idle, blocked, or closed and after active completion during closing.
- `close()` rejects new work, resolves pending work as closed, permits the active callback to settle, and then closes.
- No promise or callback from older work can mutate a newer active request.

### Task 3: Publish and prove a framework-free autosave subpath

**Files:**
- Create: `vite.autosave.config.ts`
- Create: `scripts/verify-framework-free-autosave-package.mjs`
- Modify: `package.json`
- Modify: `scripts/verify-package.mjs`

**Packaging contract:**

```json
{
  "./autosave": {
    "types": "./dist/autosave/index.d.ts",
    "import": "./dist/cwl-autosave.js",
    "require": "./dist/cwl-autosave.cjs"
  }
}
```

Verification must:

- build dedicated ESM/CommonJS/declaration artifacts;
- pack the exact npm artifact with scripts disabled;
- extract only Inkspan into an operating-system temporary `node_modules` tree;
- assert React, React DOM, TipTap, ProseMirror, and Yjs are absent from the isolated consumer;
- execute real saved/coalesced/conflict flows through ESM and CommonJS;
- compile a strict TypeScript consumer with `types: []` and no DOM library;
- assert all resolved paths remain inside the extracted package tree;
- verify the general package manifest includes every autosave runtime and declaration target.

### Task 4: Complete authoritative product and operator documentation

**Files:**
- Create: `docs/document-autosave-queue.md`
- Modify: `README.md`
- Modify: `docs/doctoring/document-autosave-queue.md`
- Modify: `CHANGELOG.md`

Documentation must explain:

- host debounce/change-detection and transport ownership;
- authenticated atomic RFC 9110 `If-Match` write requirements;
- same-revision coalescing, pending supersession, conflict/failure pause, recovery, flush, and close semantics;
- bounded active, pending, and internal flush-waiter retention;
- full-document privacy boundaries and revision-tag correlation risk;
- SSR, worker, Node.js, naruon compose, and `ui.panel` integration boundaries;
- that the queue is local coordination, not a distributed transaction or durable audit log;
- APA 7th references to RFC 9110, RFC 8785, Herlihy and Wing (1990), and ISO/IEC 25010:2023.

Add one consolidated 0.5.28 changelog section after integrating the 0.5.27 default branch.

### Task 5: Verify the exact head and integrate

**Exact-head gates:**

1. Focused Vitest autosave tests.
2. Repository-wide typecheck and 100% coverage.
3. All library builds and packed-package consumers.
4. Demo and Office Python 3.11/3.14 100% branch/docstring gates.
5. SAST Semgrep, Security Scan, dependency review, CodeRabbit, GitHub Advanced Security, and central required workflows.
6. No unresolved current-head human or automated review thread.
7. Every repository-required independent approval bound to the exact head.
8. Branch protection, repository policy, and guarded squash merge.

After merge, re-inspect open PRs before choosing the next bounded slice. Publish 0.5.28 only when the merged default branch also passes release acceptance, provenance, registry, and release-evidence gates and an authorized release tag can be created without bypassing policy.
