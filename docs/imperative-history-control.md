# Imperative undo and redo control

Status: `implemented_on_active_pr`

Inkspan exposes a narrow history-control surface on `CwlEditorHandle` for hosts that replace the built-in toolbar, provide an application command palette, or map desktop menu actions to the editor. This active-PR contract is not protected-main authority until the implementing pull request is integrated.

## Public handle contract

`CwlEditorHandle` provides four boolean-returning operations:

```ts
const handle = editorRef.current;

if (handle?.canUndo()) {
  handle.undo();
}

if (handle?.canRedo()) {
  handle.redo();
}
```

- `canUndo()` reports whether the currently registered editor history can undo.
- `undo()` asks that history implementation to undo and returns whether the command ran.
- `canRedo()` reports whether the currently registered editor history can redo.
- `redo()` asks that history implementation to redo and returns whether the command ran.

A newly created editor with no history reports both capabilities as `false`. After a document-changing edit, undo capability becomes available. A successful undo exposes redo capability, and a successful redo restores undo capability when history remains.

When the editor surface is read-only (`editable={false}`), all four history operations return `false` and no history entry is consumed. Restoring `editable={true}` exposes the same still-available history again. This read-only guard applies specifically to user-facing history commands; explicit host-control mutators such as `setValue()` and `restoreDocumentEnvelope()` retain their existing programmatic authority so a host can update a read-only presentation from its own trusted state transition.

## Lifecycle safety

A retained host handle must not keep a destroyed TipTap editor authoritative. Before an editor exists or after its editor has been destroyed, all four history methods return `false` without throwing. The same active-editor guard is used by the rest of the retained-handle read, mutation, envelope, revision, selection, and restore surface so stale destroyed-editor state cannot be presented as current Inkspan state.

Hosts should still dispose of retained refs normally; fail-closed behavior is a defensive boundary, not a replacement for application lifecycle management.

## Standalone and collaborative history

Standalone `CwlEditor` delegates to the history commands already registered by Inkspan's TipTap/StarterKit configuration. `CollaborativeCwlEditor` delegates through the same public handle to the collaboration-aware history commands registered with Yjs. Inkspan does not re-enable a second StarterKit local history engine in collaboration mode.

This means a host can wire one stable command surface without reaching into TipTap internals while preserving the history semantics selected by the active Inkspan editor configuration.

## Authority boundary

The four methods are local editor commands only. A successful `undo()` or `redo()` does **not** prove a durable save, actor identity, authorization, timestamp, audit event, persistence result, collaboration-provider acknowledgement, or server-side revision transition. Normal document-change callbacks and host persistence workflows remain responsible for whatever durable consequences the embedding application requires.

Inkspan does not acquire transport, authentication, authorization, tenancy, durable persistence, retention, provider-room, model-use, or audit authority through this API.

## Acceptance evidence

The implementing branch is expected to prove:

- initial, post-edit, post-undo, and post-redo capability transitions on a real editor;
- read-only history commands are inert without consuming history and become available again when editability is restored;
- no-active-editor and destroyed-editor fail-closed behavior;
- collaborative convergence through two in-memory `Y.Doc` editors without duplicate local history;
- unchanged package consumers, accessibility/browser evidence, Office evidence, security scans, and exact 100% owned-production statement/branch/function/line coverage.

Until the branch reaches protected `main`, downstream products must treat this document as active-PR guidance rather than a shipped-version guarantee.
