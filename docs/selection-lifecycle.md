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

## Revision-scoped selection evidence

For a delayed review, annotation, or AI operation, the imperative handle can
bind the current selection to the strong revision of the exact document
revision that contained it:

```tsx
const evidence =
  await editorRef.current?.getSelectionRevisionEvidence();

if (evidence) {
  beginReview({
    expectedDocumentRevision: evidence.revision.strongEntityTag,
    selection: evidence.selection,
  });
}
```

`getSelectionRevisionEvidence()` captures one immutable ProseMirror `EditorState`
before asynchronous SHA-256 work begins. The document envelope used for hashing
and the frozen `selection` snapshot are both derived from that same state, so a
later edit or selection move cannot pair coordinates from one revision with a
digest from another. The result contains the local strong revision plus
`anchor`, `head`, `from`, `to`, and `empty`; it does not copy selected text or
the complete document envelope into ordinary review metadata.

A host must compare the captured strong revision with the document revision it
intends to review before reusing the positions. If the document changed, raw
ProseMirror coordinates must not be applied to the new revision. The host owns
any explicit re-anchor, compare, merge, fork, durable comment, or collaborative
relative-position workflow and must revalidate authorization and the target
revision before mutation.

The local SHA-256 revision is equality evidence only. It is not a signature,
authorization grant, user or tenant identifier, server-selected durable ETag,
proof that a review was accepted, or proof that a persistence transaction
committed. Durable services remain responsible for authenticated atomic
concurrency and audit semantics.

## W3C text-position selector evidence

The active W3C interoperability line adds a separate imperative capture rather
than relabeling ProseMirror structural positions:

```tsx
const evidence =
  await editorRef.current?.getTextPositionSelectorEvidence();

if (evidence) {
  publishAnnotationProposal({
    expectedDocumentRevision: evidence.revision.strongEntityTag,
    selector: evidence.selector,
    textProjection: evidence.textProjection,
  });
}
```

`getTextPositionSelectorEvidence()` captures one immutable editor state, derives
the selector projection and document envelope from that same state, and only
then performs asynchronous SHA-256 revision derivation. The returned evidence is
frozen and contains no selected quote text.

Projection version 1 is explicitly identified as
`inkspan-prosemirror-text` version `1`. It uses logical ProseMirror document
order, U+000A LINE FEED as the configured block separator, and U+FFFC OBJECT
REPLACEMENT CHARACTER for supported non-text leaf nodes. `selector.start` is an
inclusive Unicode-code-point offset and `selector.end` is exclusive. Visual
bidirectional reordering does not alter the logical text stream.

Selection boundaries must coincide with grapheme-cluster boundaries. Inkspan
uses `Intl.Segmenter` grapheme segmentation for this check. A boundary inside a
grapheme cluster fails with `grapheme_boundary`; a runtime without the required
segmenter fails with `segmenter_unavailable`. Inkspan never silently moves an
invalid boundary to make an annotation appear valid.

This selector remains revision-scoped. It is not a durable cross-revision
anchor, `TextQuoteSelector`, actor identity, authorization record, timestamp,
signature, or persistence receipt. Hosts own source-resource identifiers,
annotation bodies and identifiers, publication, storage, authorization, tenant
policy, and any re-anchoring after the document revision changes.

The exact rationale, projection contract, privacy boundary, rollback policy, and
APA 7 references are recorded in
`docs/doctoring/w3c-text-position-selector-evidence.md`.

## Position semantics

`CwlEditorSelectionSnapshot` values are ProseMirror document positions, not DOM
offsets, Markdown character indexes, HTML byte offsets, W3C text positions, or
durable annotation identifiers. A snapshot describes the editor state at the
time of the callback. Any subsequent transaction can remap or invalidate those
coordinates.

W3C text-position evidence is a distinct coordinate system with an explicit
projection identity. Consumers must not mix the two systems even when numerical
values happen to be equal for a simple document.

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
revision-scoped evidence or establish a durable collaborative anchor under its
own product policy, then validate the target again before applying a result.

## Security and privacy boundary

Selection coordinates are client-controlled presentation state. They cannot be
used as an authorization boundary, ownership proof, server-side range validator,
or trusted audit record. Hosts remain responsible for document authorization,
operation-level permission checks, content classification, telemetry minimization,
and validating any later mutation against the current authorized document.

The callback and revision-scoped captures perform no network request, read no
environment variable, and introduce no transport, persistence, database, or
naruon-specific runtime dependency. They preserve Inkspan's modular MSA boundary
and require no database object or identifier.

## Accessibility

The callback and revision-scoped evidence add no DOM node, focus target, live
region, or keyboard behavior. They observe the same local selection changes
already produced by keyboard, pointer, assistive-technology, and programmatic
editor interactions. Hosts that show contextual controls must keep them keyboard
reachable, avoid obscuring the selection or focus indicator, provide an
accessible name, and return focus predictably when the control closes.

## Standards and primary references

- [TipTap editor events](https://tiptap.dev/docs/editor/api/events) — the
  `selectionUpdate` lifecycle event used by the React integrations.
- [TipTap setTextSelection command](https://tiptap.dev/docs/editor/api/commands/selection/set-text-selection)
  — programmatic caret and range selection semantics.
- [ProseMirror guide: document positions and selection](https://prosemirror.net/docs/guide/)
  — immutable editor state, document-relative positions, and selection
  coordinates.
- [ProseMirror reference](https://prosemirror.net/docs/ref/) — `Selection`,
  immutable document nodes, and `Node.textBetween` projection semantics.
- [W3C Web Annotation Data Model](https://www.w3.org/TR/annotation-model/)
  — interoperable selector semantics including Unicode-code-point
  `TextPositionSelector` positions and selector-state guidance.
- [ECMA-402](https://ecma-international.org/publications-and-standards/standards/ecma-402/)
  — the current published ECMAScript internationalization specification that
  defines `Intl.Segmenter`.
- [RFC 9110, HTTP Semantics](https://www.rfc-editor.org/rfc/rfc9110)
  — strong and weak entity-tag semantics and conditional-request boundaries.

## Verification

The TypeScript suite verifies absent callbacks, callbacks attached after mount,
live callback replacement, stable editor identity, caret and range snapshots,
and parity between standalone and provider-neutral collaborative editors. It
also verifies that revision-scoped range/caret evidence is frozen, contains no
selected text or complete envelope, remains bound to the pre-hash document state
while later edits and selection moves occur, and returns `null` before an editor
exists.

The W3C selector suite additionally verifies astral Unicode code points,
multi-block bidirectional logical order, supported leaf-node projection,
grapheme-boundary rejection, deterministic failure when grapheme segmentation is
unavailable, same-state revision atomicity, frozen evidence, and source-text
omission. Public declarations and packed-package consumers remain subject to the
repository-wide exact 100% production statement, branch, function, and line
coverage policy.
