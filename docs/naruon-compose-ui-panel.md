# Naruon compose and ui.panel integration

This guide shows how to embed Inkspan in a naruon composition without making
Inkspan depend on naruon. The same editor package remains usable in a standalone
React application, while naruon owns product routing, authenticated service
calls, tenant context, persistence, credentials, conflict UX, and model policy.

## Integration goals

A correct integration should:

1. keep the interactive editor in a narrow browser boundary;
2. keep provider credentials and authorization decisions outside Inkspan;
3. use server-selected strong `ETag` values for durable optimistic concurrency;
4. let Inkspan coordinate only deterministic local editing and save ordering;
5. keep the host-created `Y.Doc` and collaboration provider lifecycle outside the
   editor module;
6. expose an accessible conflict, recovery, and unsaved-state experience; and
7. separate local evidence from shareable evidence used for operations or due
   diligence.

## Recommended composition

Use a server component or equivalent host loader to authorize the document and
load its durable representation. Pass only serializable document data, a
server-selected strong `ETag`, an opaque non-secret editing-context lifecycle
identifier, and non-secret presentation options into one small client component.

```tsx
// app/documents/[documentId]/inkspan-panel.tsx
'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import {
  CwlEditor,
  type CwlEditorHandle,
} from '@contextualwisdomlab/cwl-editor';
import {
  createDocumentAutosaveSession,
  isStrongHttpEntityTag,
  type DocumentAutosaveSession,
} from '@contextualwisdomlab/cwl-editor/autosave';
import '@contextualwisdomlab/cwl-editor/styles.css';

interface InkspanPanelProps {
  readonly editingContextId: string;
  readonly documentId: string;
  readonly initialMarkdown: string;
  readonly initialStrongEntityTag: string;
}

export function InkspanPanel(props: InkspanPanelProps) {
  return <InkspanPanelSession key={props.editingContextId} {...props} />;
}

function InkspanPanelSession({
  documentId,
  initialMarkdown,
  initialStrongEntityTag,
}: InkspanPanelProps) {
  const editorRef = useRef<CwlEditorHandle>(null);
  const editGeneration = useRef(0);
  const [saveMessage, setSaveMessage] = useState('Document loaded.');

  const session = useMemo<DocumentAutosaveSession>(
    () =>
      createDocumentAutosaveSession({
        initialStrongEntityTag,
        async save(request) {
          const encodedDocumentId = encodeURIComponent(documentId);
          const response = await fetch(`/api/documents/${encodedDocumentId}`, {
            method: 'PUT',
            headers: {
              'Content-Type': 'application/json',
              'If-Match': request.ifMatchStrongEntityTag,
            },
            body: JSON.stringify(request.evidence.envelope),
          });

          if (response.status === 412) {
            return { status: 'conflict' };
          }
          if (!response.ok) {
            throw new Error('Document save failed without durable proof');
          }

          const nextStrongEntityTag = response.headers.get('ETag');
          if (!isStrongHttpEntityTag(nextStrongEntityTag)) {
            throw new Error('Document save omitted a valid strong ETag');
          }
          return {
            status: 'saved',
            nextStrongEntityTag,
          };
        },
      }),
    [documentId, initialStrongEntityTag],
  );

  useEffect(
    () => () => {
      editGeneration.current += 1;
      void session.close();
    },
    [session],
  );

  async function captureAndQueueLatestDocument(): Promise<void> {
    const capturedGeneration = ++editGeneration.current;
    setSaveMessage('Saving changes.');

    try {
      const evidence =
        await editorRef.current?.getDocumentEnvelopeRevisionEvidence();
      if (
        evidence === undefined ||
        evidence === null ||
        capturedGeneration !== editGeneration.current
      ) {
        return;
      }

      const outcome = await session.enqueue(evidence);
      if (capturedGeneration !== editGeneration.current) {
        return;
      }

      if (outcome.status === 'conflict') {
        setSaveMessage('Saving paused. Resolve the durable document conflict.');
      } else if (outcome.status === 'closed') {
        setSaveMessage('Saving is unavailable because this session closed.');
      } else {
        setSaveMessage('All current changes are saved or queued.');
      }
    } catch {
      if (capturedGeneration === editGeneration.current) {
        setSaveMessage('Saving paused. Use the host recovery action.');
      }
    }
  }

  return (
    <section aria-labelledby="document-editor-title">
      <h2 id="document-editor-title">Document editor</h2>
      <CwlEditor
        ref={editorRef}
        mode="markdown"
        defaultValue={initialMarkdown}
        onChange={() => {
          void captureAndQueueLatestDocument();
        }}
      />
      <p role="status" aria-live="polite">
        {saveMessage}
      </p>
    </section>
  );
}
```

The host must issue a new opaque `editingContextId` for every authorized document
load and whenever the authorized workspace, tenant, or document context changes.
The value is a UI lifecycle key only: it is not an authorization grant, tenant
identifier, durable validator, or audit identifier, and it should not be logged.
Keying the complete client session prevents React from reusing an uncontrolled
editor, autosave validator, pending digest, or status state for a different
document. Keying only `CwlEditor` is insufficient because the autosave session
and asynchronous capture state must be replaced in the same lifecycle boundary.

The generation guard prevents an older, slower asynchronous envelope digest from
being enqueued after a newer edit. A production host may debounce before capture
to reduce hashing frequency, but it must preserve the same latest-generation
ordering rule.

The example is intentionally transport-neutral beyond ordinary host `fetch()`.
A production naruon composition should place authentication, tenant resolution,
request deadlines, retry budgets, idempotency, telemetry, and error translation
inside the host API layer rather than the editor component. It should translate
redacted failure states into explicit recovery actions rather than expose private
callback errors or document bodies.

## compose contract

A naruon `compose` layer should treat Inkspan as one bounded capability module.
It may combine editor output with templates, workflows, contextual-orchestrator,
or other CWL services, but it must preserve these ownership rules:

- Inkspan receives only the document state and non-secret behavior options needed
  for editing.
- The composition root resolves authorization and tenant context before the
  panel receives a document.
- The composition root issues a fresh opaque editing-context lifecycle value for
  every authorized load and context transition.
- The composition root decides whether model use is allowed and which reviewed
  contextual-orchestrator policy applies.
- Model output returns as untrusted content and enters Inkspan through validated
  insertion or revision-guarded restore paths.
- Durable save success is established only by the host persistence transaction
  and its replacement strong validator.
- The composition root owns shutdown and cancellation when a route, workspace,
  or application session ends.

Inkspan must not read provider credentials, model credentials, database
credentials, or host authorization tokens. It also must not infer tenant
identity from a document body, revision digest, collaboration room name, editing
context value, or server validator.

## ui.panel contract

A naruon `ui.panel` host should provide the surrounding product experience:

- document title, owner, workspace, and classification labels;
- save, offline, reconnecting, conflict, recovery, and read-only status;
- accessible conflict actions such as compare, merge, fork, discard, and retry;
- confirmation before destructive replacement;
- model-use disclosure and user controls required by host policy;
- navigation and focus restoration when the panel opens or closes; and
- a support-safe error reference that excludes the document body and credentials.

Use `role="status"` or another appropriate live-region pattern for asynchronous
save state. Do not announce every keystroke. When a conflict occurs, move focus
to a labelled conflict region or dialog and provide a deterministic path back to
the editor.

## Durable autosave and conflict handling

The initial validator and every successful replacement must be a server-selected
strong `ETag`. The host persistence service must atomically compare `If-Match`
inside the same transaction that writes the new document representation.

Treat outcomes as follows:

| Outcome | Host behavior |
| --- | --- |
| Saved with replacement strong validator | Install the returned validator before the next save begins |
| `412 Precondition Failed` | Pause automatic progression and show the accessible conflict workflow |
| Timeout, disconnect, or malformed response | Treat as ambiguous; do not claim saved or advance the validator |
| Authenticated recovery load | Supply the newly loaded server validator to the session before resuming retained work |
| Route or panel shutdown | Stop new work, let any active transport settle according to host policy, then discard private in-memory evidence |

A local Inkspan SHA-256 revision is equality evidence for deterministic local
operations. It is not a durable server validator and must never replace the
host's `ETag`.

## Collaboration lifecycle

For real-time editing, create the `Y.Doc`, provider, room authorization, and
awareness policy in the host composition. Inkspan may bind the supplied document
to the editor, but it must not create or destroy the host provider.

This matters when one provider is shared by multiple panels, presence surfaces,
or background synchronization tasks. Unmounting an editor panel must not
silently terminate collaboration used elsewhere. The host should explicitly
destroy the provider only when the owning workspace or application lifecycle
ends.

## contextual-orchestrator integration

The host may call `ContextualWisdomLab/contextual-orchestrator` for insertion,
rewrite, review, or structured document generation. Keep the integration
provider-neutral:

1. capture one immutable Inkspan envelope and local revision;
2. let the host authorize and dispatch the model operation;
3. validate the returned content through Inkspan's ordinary safe-content path;
4. apply a delayed result only with revision-guarded restore or an explicit
   compare/merge/fork decision; and
5. store only host-approved audit metadata, never private intermediate reasoning.

The editor package does not select reasoning effort, models, credentials, prompt
retention, or provider regions. Those decisions remain with the host and
contextual-orchestrator policy.

## Local evidence and shareable evidence

**Local evidence** may contain full envelopes, conflict bodies, Yjs updates,
awareness state, prompts, model output, tenant identifiers, server validators,
or deployment-specific security findings. Keep it within the authorized product
boundary and retention policy.

**Shareable evidence** for support, release acceptance, procurement, or
acquisition review should be deliberately produced from non-customer fixtures.
Examples include exact-head CI results, package hashes, SBOMs, provenance,
license inventories, deterministic conversion fixtures, accessibility test
results, public API declarations, and redacted operator runbooks.

Never promote local evidence to shareable evidence merely because it is hashed,
canonicalized, encrypted, or attached to a successful CI run.

## Failure checklist

Before enabling the panel in production, verify that:

- the server rejects unauthorized document IDs before returning content;
- the host issues a fresh opaque editing-context lifecycle value for every
  authorized document load and context transition;
- the complete editor and autosave session remount together when that lifecycle
  value changes;
- document path segments are encoded before transport and revalidated by the
  authorized server route;
- every durable write uses an authenticated atomic `If-Match` transaction;
- missing, weak, malformed, or stale validators fail closed;
- request timeouts and cancellation are host-owned and bounded;
- conflict UI is keyboard-operable and announced without exposing document text
  in generic telemetry;
- provider and model credentials never enter client props, document envelopes,
  error messages, or collaboration awareness state;
- the host provider survives panel remounts when it is shared;
- release evidence excludes tenant data and is bound to the exact package and
  source head; and
- rollback restores a previously verified package rather than bypassing
  validation, security, or review gates.

See [`../ARCHITECTURE.md`](../ARCHITECTURE.md) for the system diagrams and
[`doctoring/naruon-modular-architecture.md`](doctoring/naruon-modular-architecture.md)
for standards and decision evidence.
