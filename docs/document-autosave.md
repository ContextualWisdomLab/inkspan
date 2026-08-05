# Provider-neutral document autosave

Inkspan exposes framework-independent autosave coordination at
`@contextualwisdomlab/cwl-editor/autosave`. The package accepts immutable document
revision evidence, ensures that only one host save callback runs at a time,
retains at most one not-yet-started revision, and shares one internal pending
flush promise across concurrent quiescence checks.

Use `createDocumentAutosaveSession()` for ordinary durable HTTP persistence. It
binds every callback to the exact server-issued strong entity tag loaded or last
committed by the host. Use the lower-level `createDocumentAutosaveQueue()` only
when the host deliberately owns a different version-token protocol and can prove
its validator handoff separately.

Inkspan owns deterministic local ordering, immutable evidence validation, and
server-validator handoff only. The host continues to own transport,
authentication, authorization, tenant isolation, durable storage, credentials,
schema migration, backup, rollback, retention, audit storage, retry budgets,
offline and idempotency policy, and conflict-resolution user experience.

## Install and import

Use the ordinary Inkspan package and import the dedicated subpath in browser,
server, worker, queue, or test code:

```ts
import {
  createDocumentAutosaveSession,
  type DocumentAutosaveDurableSaveResult,
} from '@contextualwisdomlab/cwl-editor/autosave';
import {
  createDocumentEnvelopeRevisionEvidence,
} from '@contextualwisdomlab/cwl-editor/revision-evidence';
```

The autosave subpath has no React, React DOM, TipTap, ProseMirror, Yjs, DOM,
provider SDK, storage driver, or network runtime dependency. It does not create
timers, perform requests, read environment variables, access storage, or choose
a tenant.

## Capture immutable revision evidence

Create evidence through Inkspan rather than constructing a look-alike object.
The envelope and local SHA-256 revision are derived from the same normalized,
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

The autosave boundary validates the public evidence shape, deep immutability,
active schema, SHA-256 metadata, and resource ceilings. It does not recompute the
digest. Use an Inkspan-created evidence value, or apply an equivalent trusted
private canonicalization and hashing boundary before enqueueing it.

The evidence revision is local equality evidence. It is not automatically the
origin server's durable HTTP `ETag`, authorization decision, tenant identifier,
signature, or proof that a durable transaction committed.

## Load the durable base validator

The host must load the document and the durable service's server-selected strong
`ETag` under the same authenticated document context. Missing, weak, malformed,
or inaccessible validators fail closed before the session is created.

```ts
const loadedResponse = await loadDocument();
const loadedStrongEntityTag = loadedResponse.headers.get('ETag');

const autosaveSession = createDocumentAutosaveSession({
  initialStrongEntityTag: loadedStrongEntityTag ?? '',
  async save(request): Promise<DocumentAutosaveDurableSaveResult> {
    const response = await saveDocument({
      envelope: request.evidence.envelope,
      ifMatch: request.ifMatchStrongEntityTag,
    });

    if (response.status === 412) {
      return { status: 'conflict' };
    }
    if (!response.ok) {
      throw new Error('Private transport failure');
    }

    return {
      status: 'saved',
      nextStrongEntityTag: response.headers.get('ETag') ?? '',
    };
  },
});
```

`createDocumentAutosaveSession()` validates the initial value immediately. It
also validates every replacement before advancing the next callback's
`If-Match` base. Empty, missing, weak, unquoted, whitespace-containing, list,
wildcard, control-character, and out-of-range values are rejected through a
redacted `DocumentAutosaveQueueError`; they never become a later transport
validator.

The host callback must return `saved` only after the authorized durable
transaction commits. The returned `nextStrongEntityTag` must be the strong
validator selected by the durable service for the committed representation.
Return `conflict` when the service rejects the supplied base, normally as HTTP
`412 Precondition Failed` after an atomic `If-Match` comparison.

Do not copy private transport exceptions into public UI, logs, or telemetry. The
session converts callback failures into a redacted queue error. The original
exception remains available only to the host's private transport observability
boundary.

Every host save callback must apply a host-owned timeout or abort signal around
its transport and durable transaction. Inkspan intentionally cannot cancel
host-owned I/O. A callback that never settles retains the one active
single-flight request, prevents pending work from starting, and keeps `flush()`
and `close()` unresolved. Timeout handling, retry budgets, backoff, offline
policy, idempotency confirmation, and user notification remain host-owned; a
failed attempt must reject or throw without falsely returning `saved`.

## Enqueue editor changes

Change detection and debounce timing remain host-owned. When the host decides a
revision is ready, enqueue its immutable evidence:

```ts
const outcome = await autosaveSession.enqueue(evidence);

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

Requests for the same active or pending local revision share one callback and one
promise. A newer different revision may replace only pending work. It never
cancels or overlaps a callback that has already started. Inkspan retains at most
one active document and one pending document regardless of edit frequency.

An `unchanged` outcome is emitted only when the requested local revision is still
known to be the session's last successful revision and no active or pending write
can replace it. A different active or pending write, server conflict, invalid
callback result, promise-assimilation failure, or ambiguous transport failure
invalidates that shortcut. Recovery does not restore the shortcut; a later
successful save must establish it again.

## Recover from conflict or failure

A conflict or callback failure blocks automatic progression. This is deliberate:
Inkspan does not guess whether a retry is authorized, safe, or useful.

```ts
const snapshot = await autosaveSession.flush();

if (snapshot.state === 'blocked') {
  const recovery = await reloadCompareMergeOrForkUnderHostAuthorization();

  autosaveSession.resume(recovery.currentDurableStrongEntityTag);
}
```

Call `resume(nextStrongEntityTag)` only after the host completes its authenticated
recovery workflow. A conflict normally requires fetching the current durable
revision, showing or applying an accessible compare/merge/fork decision, and
creating new revision evidence. A transport failure normally requires
host-specific retry budget, backoff, offline, idempotency confirmation, and
user-notification policy.

The replacement durable tag is validated and installed before retained work
resumes. An invalid tag throws the machine-readable
`invalid_recovery_validator` error without clearing the blocked state. Calling
`resume()` while the session is not blocked returns `false` and does not change
the current durable base.

`flush()` resolves when the session is idle, blocked, or closed. Concurrent calls
while work is active return the same pending promise, so repeated component,
worker, or operator checks do not append unbounded internal waiters. It does not
wait forever for an external conflict decision.

A recovery or shutdown decision can race with the asynchronous wrapper that
turns an internal queue snapshot into a public session snapshot. When recovery
or closing starts before that wrapper continuation runs, `flush()` follows the
new work until the session is currently idle, blocked, or closed. The returned
lifecycle fields and `durableStrongEntityTag` therefore describe one coherent
logical moment rather than combining a stale blocked snapshot with a newer
validator.

## Shutdown

Use `close()` during page, worker, or host lifecycle shutdown:

```ts
const finalSnapshot = await autosaveSession.close();
```

Closing rejects new work, resolves not-yet-started work as `closed`, and allows
an active host callback to finish. Inkspan never aborts host transport. The final
session snapshot includes the last accepted durable validator but no document
body or private callback value.

## Lower-level queue

`createDocumentAutosaveQueue()` remains available for hosts whose durable version
protocol is not an RFC 9110 entity tag or whose validator state is intentionally
owned elsewhere. Its callback receives only immutable revision evidence and
returns `saved` or `conflict`.

A host choosing this primitive must independently prove that it:

- loads the correct durable base under authorization;
- supplies that exact base to every compare-and-swap transaction;
- advances the base only from the committed service response;
- preserves the base across conflict and ambiguous failure;
- installs the recovered base before calling `resume()`; and
- rejects malformed or weak validators before transport.

The durable session exists so ordinary hosts do not have to reimplement that
security-sensitive mutable closure.

## SSR, worker, and modular host integration

The autosave subpath is safe to import in SSR, Node.js, web workers, service
workers, and provider-neutral queues because it has no DOM or editor-framework
runtime requirement. Instantiate one session per authorized document editing
context rather than placing tenant, user, room, or credential identifiers inside
Inkspan.

For CWL and naruon integrations:

- a compose service or `ui.panel` captures Inkspan revision evidence and owns
  accessible dirty, saving, blocked, retry, and conflict UI;
- a host service supplies authenticated transport and the initially loaded and
  subsequently returned durable strong entity tags;
- the persistence service performs tenant-scoped atomic `If-Match` comparison
  and envelope commit in one transaction;
- contextual-orchestrator may coordinate host policy but does not become part of
  the Inkspan runtime dependency graph;
- Inkspan never receives provider credentials, room identifiers, database
  connections, retention policy, or model-use policy; and
- session snapshots may drive local presentation but are not a durable audit log.

## Snapshot and observability rules

`getSnapshot()` returns frozen lifecycle metadata containing active, pending,
last-saved local revision tags, and the current durable server tag. It never
contains document bodies, callback results, credentials, tenant identifiers, or
original exceptions.

`lastSavedStrongEntityTag` is the local evidence revision most recently reported
as saved. `durableStrongEntityTag` is the current server-selected base for the
next compare-and-swap. They may differ and must not be substituted for each
other.

Both values can correlate representations. Treat them as tenant-confidential
metadata:

- do not use document bodies or revision tags as metric-label values;
- do not place them in public URLs, unauthenticated logs, analytics events, or
  exception messages;
- use host-generated descriptive trace identifiers for correlation; and
- apply the same authorization, retention, residency, encryption, and audit
  controls used for the durable document.

## Ownership matrix

| Concern | Inkspan session | Host application or service |
| --- | --- | --- |
| Immutable evidence validation | Owns | Uses Inkspan evidence APIs |
| Single-flight ordering and bounded pending work | Owns | Chooses change/debounce timing |
| Strong entity-tag syntax validation | Owns | Supplies server-selected values |
| Durable validator handoff between callbacks | Owns | Returns committed replacement value |
| Transport and credentials | Does not own | Owns |
| Authentication and authorization | Does not own | Owns |
| Tenant isolation | Does not own | Owns |
| Atomic durable `If-Match` comparison and commit | Does not own | Owns |
| Storage, migration, backup, and rollback | Does not own | Owns |
| Retention, residency, redaction, and audit storage | Does not own | Owns |
| Retry, offline, idempotency, and conflict UX | Does not own | Owns |
| Model provider and model-use policy | Does not own | Owns |

## Standards boundary

The session provides a linearizable local coordination and validator-handoff
surface for callback invocations. It does not create a distributed transaction.
Durable lost-update prevention requires the host to compare the supplied
previously loaded or committed server validator and write the proposed document
atomically in the same authorized storage transaction, consistent with RFC 9110
`If-Match` semantics.

See `docs/doctoring/document-autosave-queue.md` and
`docs/doctoring/durable-autosave-session.md` for the architectural decisions,
security analyses, verification plans, and APA 7th references to RFC 9110, RFC
8785, Herlihy and Wing (1990), and ISO/IEC 25010:2023.
