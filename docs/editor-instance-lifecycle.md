# Editor instance lifecycle contract

Inkspan exposes a paired instance lifecycle on both `CwlEditor` and
`CollaborativeCwlEditor`:

- `onReady(editor)` runs once for each TipTap `Editor` instance after creation.
- `onDestroy(editor)` runs once for that same instance when TipTap destroys it.

The callbacks are instance-scoped rather than render-scoped. Replacing either
React callback does not recreate the editor, replay readiness, reset selection,
or rebuild a Yjs binding.

## Host integration

```tsx
import { useCallback } from 'react';
import { CwlEditor } from '@contextualwisdomlab/cwl-editor';

export function DocumentComposer() {
  const handleReady = useCallback((editor) => {
    editor.on('transaction', recordLocalEditorActivity);
  }, []);

  const handleDestroy = useCallback((editor) => {
    editor.off('transaction', recordLocalEditorActivity);
    releaseEditorScopedResources(editor);
  }, []);

  return (
    <CwlEditor
      defaultValue="# Draft"
      onReady={handleReady}
      onDestroy={handleDestroy}
    />
  );
}
```

Inkspan resolves `onDestroy` through a live callback reference at the moment the
instance is destroyed. A host can therefore attach teardown after hydration or
replace teardown logic without forcing TipTap recreation. `onReady` is not
replayed when its callback identity changes; it is tied to TipTap's actual
creation event.

## Collaborative recreation

A collaborative editor can intentionally create a replacement TipTap instance
when an instance-defining dependency changes, including the host-owned `Y.Doc`,
scoped provider, or collaboration field. Inkspan emits the complete lifecycle:
`onDestroy` for the old editor followed by `onReady` for the replacement.
Ordinary prop changes such as accessibility metadata, editable state, mode, or
callback identity do not rebuild the collaboration binding.

The editor lifecycle does not transfer ownership of the supplied Yjs document,
provider, awareness transport, authentication token, or persistence connection.
Inkspan destroys only its own TipTap instance and scoped cursor adapter. CWL and
naruon hosts remain responsible for provider disconnect, Yjs document disposal,
and service-level authorization.

## React development behavior

React Strict Mode may intentionally exercise additional development-only
mount/cleanup cycles to reveal missing cleanup. Treat each editor received by
`onReady` as an independent instance and pair resource acquisition with the
matching `onDestroy`. Do not model either callback as a process-wide singleton
signal or a promise that a React component mounts only once.

The lifecycle is bound directly to TipTap creation and destruction rather than
a React effect that depends on the callback identity. This prevents an inline or
newly memoized `onReady` function from being mistaken for a new editor instance
and avoids duplicate subscriptions, telemetry registration, or autosave workers.

## Reliability and security boundary

- Remove editor-scoped listeners, observers, timers, and object references in
  `onDestroy`.
- Do not issue new editor commands after destruction; use `editor.isDestroyed`
  when asynchronous work can outlive the instance.
- Do not retain document content, selections, or credentials merely because an
  instance is being destroyed. Apply the host's normal classification,
  minimization, and retention policy.
- A lifecycle callback is not an authorization event, persistence acknowledgement,
  audit proof, or collaborative disconnect notification.
- Callback failures remain host failures. Keep teardown idempotent and avoid
  throwing from cleanup paths that must release other resources.

The API introduces no network, persistence, database, environment-variable, or
service-discovery dependency. It preserves Inkspan's modular MSA boundary and
requires no database object or identifier.

## Primary references

- [TipTap editor events](https://tiptap.dev/docs/editor/api/events) — editor
  creation and destruction lifecycle events.
- [TipTap Editor instance API](https://tiptap.dev/docs/editor/api/editor) —
  `destroy()` and `isDestroyed` semantics.
- [TipTap React integration](https://tiptap.dev/docs/editor/getting-started/install/react)
  — `useEditor`, deferred SSR initialization, and editor-instance ownership.
- [React Strict Mode](https://react.dev/reference/react/StrictMode) —
  development-only render and cleanup checks.
- [React `useEffect`](https://react.dev/reference/react/useEffect) — dependency
  identity, cleanup symmetry, and unnecessary effect reruns.

## Verification

The TypeScript suite verifies standalone and collaborative parity, one readiness
notification per created instance, no readiness replay after callback
replacement, late attachment and replacement of teardown callbacks, stable
editor identity, and one matching destruction notification. Existing tests also
exercise absent callbacks under the repository-wide 100% statement, branch,
function, and line coverage gate.
