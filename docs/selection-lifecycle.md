# Selection lifecycle contract

Inkspan exposes the local editor selection through the optional
`onSelectionChange` callback on both `CwlEditor` and
`CollaborativeCwlEditor`. This gives host applications a supported boundary for
contextual AI actions, annotation controls, floating toolbars, and selection
telemetry without scraping ProseMirror DOM nodes.

## Public API

```tsx
<CwlEditor
  defaultValue="Select text for an AI action."
  onSelectionChange={({ editor, selection }) => {
    if (selection.empty) {
      closeContextualActions();
      return;
    }

    openContextualActions({
      editor,
      from: selection.from,
      to: selection.to,
    });
  }}
/>
```

The callback receives a stable TipTap `Editor` instance and a detached
`CwlEditorSelectionSnapshot` containing `anchor`, `head`, `from`, `to`, and
`empty`.

- `anchor` is the fixed side of the selection.
- `head` is the moving side of the selection.
- `from` and `to` are the ordered lower and upper document-position bounds.
- `empty` is `true` for a caret and `false` for a selected range.

Callback props are read through live refs. Adding or replacing a callback after
mount does not recreate the TipTap editor, ProseMirror state, or Yjs binding.
The callback is not invoked merely because a new React callback identity is
supplied; it runs on the next local TipTap `selectionUpdate` event.

## Position semantics

Selection values are ProseMirror document positions, not DOM offsets, Markdown
character indexes, HTML byte offsets, or durable annotation identifiers. A
snapshot describes the editor state at the time of the callback. Any subsequent
transaction can remap or invalidate those coordinates.

Hosts that perform work synchronously can inspect or transform the current
selection through the supplied editor. Hosts that defer work across document
changes must map positions through intervening ProseMirror transactions or use a
domain-specific durable anchor. Persisting raw `from` and `to` values as a
long-lived comment or authorization record is unsupported.

Inkspan intentionally emits coordinates rather than selected content. This
avoids copying document text into every callback, log, analytics event, or state
store. A host that genuinely needs selected content must read it deliberately
from the current editor state and apply its own privacy, classification,
retention, and redaction policy.

## Collaborative behavior

`CollaborativeCwlEditor` reports the local ProseMirror selection only. Remote
collaborator selections remain provider-owned awareness data and are rendered
through Inkspan's existing collaboration cursor boundary. A local selection
callback does not publish awareness, authorize a shared-document mutation,
create a durable Yjs relative position, or persist anything.

Concurrent Yjs changes can remap the local selection before or after a callback.
A CWL or naruon host that launches an asynchronous AI operation should capture
the intended text or establish a durable collaborative anchor under its own
product policy, then validate the target again before applying a result.

## Security and privacy boundary

Selection coordinates are client-controlled presentation state. They cannot be
used as an authorization boundary, ownership proof, server-side range validator,
or trusted audit record. Hosts remain responsible for document authorization,
operation-level permission checks, content classification, telemetry minimization,
and validating any later mutation against the current authorized document.

The callback itself performs no network request, reads no environment variable,
and introduces no transport, persistence, database, or naruon-specific runtime
dependency. It preserves Inkspan's modular MSA boundary and requires no database
object or identifier.

## Accessibility

The callback adds no DOM node, focus target, live region, or keyboard behavior.
It observes the same local selection changes already produced by keyboard,
pointer, assistive-technology, and programmatic editor interactions. Hosts that
show contextual controls must keep them keyboard reachable, avoid obscuring the
selection or focus indicator, provide an accessible name, and return focus
predictably when the control closes.

## Standards and primary references

- [TipTap editor events](https://tiptap.dev/docs/editor/api/events) — the
  `selectionUpdate` lifecycle event used by the React integrations.
- [TipTap setTextSelection command](https://tiptap.dev/docs/editor/api/commands/selection/set-text-selection)
  — programmatic caret and range selection semantics.
- [ProseMirror guide: document positions and selection](https://prosemirror.net/docs/guide/)
  — immutable editor state, document-relative positions, and selection
  coordinates.
- [ProseMirror reference: Selection](https://prosemirror.net/docs/ref/#state.Selection)
  — `anchor`, `head`, `from`, `to`, and mapping behavior.

## Verification

The TypeScript suite verifies absent callbacks, callbacks attached after mount,
live callback replacement, stable editor identity, caret and range snapshots,
and parity between standalone and provider-neutral collaborative editors. The
public types are also compiled through the packed-package consumer gate under
the repository-wide 100% statement, branch, function, and line coverage policy.
