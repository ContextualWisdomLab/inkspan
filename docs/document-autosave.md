# Provider-neutral document autosave

Inkspan 0.5.28 adds a framework-independent autosave coordination surface at
`@contextualwisdomlab/cwl-editor/autosave`. It accepts immutable document
revision evidence, ensures that only one host save callback runs at a time, and
retains at most one not-yet-started revision.

Inkspan coordinates local ordering only. The host application continues to own
transport, authentication, authorization, tenant isolation, durable storage,
credentials, schema migration, retention, audit storage, retry budgets, and
conflict-resolution user experience.

## Install and import

Use the ordinary Inkspan package and import the dedicated subpath in browser,
server, worker, queue, or test code:

```ts
import {
  createDocumentAutosaveQueue,
  type DocumentAutosaveSaveResult,
} from '@contextualwisdomlab/cwl-editor/autosave';
import {
  createDocumentEnvelopeRevisionEvidence,
} from '@contextualwisdomlab/cwl-editor/revision-evidence';
```

The autosave subpath has no React, React DOM, TipTap, ProseMirror, or Yjs runtime
dependency. It does not create timers, perform network requests, or access
storage.

## Capture immutable revision evidence

Create evidence through Inkspan rather than constructing a look-alike object.
The envelope and SHA-256 strong entity tag are derived from the same normalized,
frozen document capture:

```ts
const evidence = await createDocumentEnvelopeRevisionEvidence({
  schemaId: 'https://inkspan.io/schemas/document-envelope/v1',
  schemaVersion: 1,
  documentJson: editorDocumentJson,
});
```

An editor host may instead use
`CwlEditorHandle.getDocumentEnvelopeRevisionEvidence()` so the document and its
revision are captured atomically from the active editor.

## Create the queue

The save callback receives one immutable evidence value. The host must separately
retain the strong entity tag of the durable revision that it loaded or last
committed. Use that durable base tag as `If-Match`; the submitted evidence tag
identifies the proposed new revision and becomes the next base only after the
write commits.

Return `saved` only after the authorized durable transaction has committed.
Return `conflict` when the server rejects the durable base revision, normally as
HTTP `412 Precondition Failed` after an atomic `If-Match` comparison.

```ts
let durableStrongEntityTag = loadedRevision.strongEntityTag;

const autosaveQueue = createDocumentAutosaveQueue({
  async save(evidence): Promise<DocumentAutosaveSaveResult> {
    const response = await fetch('/documents/current', {
      method: 'PUT',
      credentials: 'include',
      headers: {
        'content-type': 'application/json',
        'if-match': durableStrongEntityTag,
      },
      body: JSON.stringify(evidence.envelope),
    });

    if (response.status === 412) {
      return { status: 'conflict' };
    }
    if (!response.ok) {
      throw new Error('Private transport failure');
    }

    durableStrongEntityTag = evidence.revision.strongEntityTag;
    return { status: 'saved' };
  },
});
```

Do not copy private transport exceptions into public UI, logs, or telemetry. The
queue converts callback failures into a redacted `DocumentAutosaveQueueError`.
The original exception remains available only to the host's private transport
observability boundary.

## Enqueue editor changes

Change detection and debounce timing remain host-owned. When the host decides a
revision is ready, enqueue its immutable evidence:

```ts
const outcome = await autosaveQueue.enqueue(evidence);

switch (outcome.status) {
  case 'saved':
  case 'unchanged':
    markDocumentClean(outcome.strongEntityTag);
    break;
  case 'superseded':
    // A newer pending revision replaced this request before transport began.
    break;
  case 'conflict':
    openAuthenticatedConflictWorkflow();
    break;
  case 'closed':
    // Shutdown started before this request could run.
    break;
}
```

Requests for the same active or pending strong entity tag share one callback and
one promise. A newer different revision may replace only pending work. It never
cancels or overlaps a callback that has already started.

## Recover from conflict or failure

A conflict or callback failure blocks automatic progression. This is deliberate:
Inkspan does not guess whether a retry is authorized, safe, or useful.

```ts
const snapshot = await autosaveQueue.flush();

if (snapshot.state === 'blocked') {
  const recovery = await reloadCompareMergeOrForkUnderHostAuthorization();
  durableStrongEntityTag = recovery.currentDurableStrongEntityTag;
  autosaveQueue.resume();
}
```

Call `resume()` only after the host has completed its authenticated recovery
workflow. A conflict usually requires fetching the current durable revision,
showing or applying an accessible compare/merge/fork decision, updating the
host-owned durable base tag, and creating new revision evidence. A transport
failure usually requires host-specific retry budget, backoff, offline, and
user-notification policy.

`flush()` resolves when the queue is idle, blocked, or closed. It does not wait
forever for an external conflict decision.

## Shutdown

Use `close()` during page, worker, or host lifecycle shutdown:

```ts
const finalSnapshot = await autosaveQueue.close();
```

Closing rejects new work, resolves not-yet-started work as `closed`, and allows
an active host callback to finish. Inkspan never aborts host transport.

## Snapshot and observability rules

`getSnapshot()` returns frozen lifecycle metadata containing active, pending, and
last-saved strong entity tags. It never contains document bodies, callback
results, credentials, tenant identifiers, or original exceptions.

Strong entity tags can correlate identical canonical documents. Treat them as
tenant-confidential metadata:

- do not use document bodies or revision tags as metric-label values;
- do not place them in public URLs, unauthenticated logs, analytics events, or
  exception messages;
- use host-generated descriptive trace identifiers for correlation;
- apply the same authorization, retention, residency, encryption, and audit
  controls used for the durable document.

## Ownership matrix

| Concern | Inkspan | Host application |
| --- | --- | --- |
| Immutable evidence validation | Owns | Uses Inkspan evidence APIs |
| Single-flight local ordering | Owns | Enqueues approved revisions |
| Pending revision coalescing | Owns | Chooses change/debounce timing |
| Durable base revision tracking | Does not own | Owns |
| Transport and credentials | Does not own | Owns |
| Authentication and authorization | Does not own | Owns |
| Tenant isolation | Does not own | Owns |
| Durable atomic `If-Match` | Does not own | Owns |
| Storage and migration | Does not own | Owns |
| Retention and audit storage | Does not own | Owns |
| Retry and offline policy | Does not own | Owns |
| Conflict comparison and UX | Does not own | Owns |

## Standards boundary

The queue provides a linearizable local coordination surface for callback
invocations. It does not create a distributed transaction. Durable lost-update
prevention requires the host to compare the previously loaded or committed base
validator and write the proposed new document atomically in the same authorized
storage transaction, consistent with RFC 9110 `If-Match` semantics.

See `docs/doctoring/document-autosave-queue.md` for the architectural decision,
security analysis, test plan, and APA 7th references.
