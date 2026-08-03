# Document snapshots

Inkspan exposes a detached document snapshot for hosts that need one consistent
revision for autosave, preview, lossless persistence, search indexing, audit, and
AI-context construction. The same contract is available from standalone and
provider-neutral collaborative editors.

## Public contract

```tsx
import {
  CwlEditor,
  type CwlEditorDocumentChangeEvent,
  type CwlEditorHandle,
} from '@contextualwisdomlab/cwl-editor';
import { useRef } from 'react';

export function ComposeEditor() {
  const editorRef = useRef<CwlEditorHandle>(null);

  const persistDraft = ({ snapshot }: CwlEditorDocumentChangeEvent) => {
    queueDraftSave({
      markdown_body: snapshot.markdown,
      html_body: snapshot.html,
      document_json: snapshot.documentJson,
      search_text: snapshot.plainText,
    });
  };

  return (
    <CwlEditor
      ref={editorRef}
      mode="markdown"
      defaultValue="# Draft"
      onDocumentChange={persistDraft}
    />
  );
}
```

`CwlEditorDocumentSnapshot` contains:

| Field | Meaning |
| --- | --- |
| `mode` | Active host serialization: `markdown` or `html` |
| `value` | Current document in the active mode |
| `html` | Current TipTap/ProseMirror HTML serialization |
| `markdown` | Current normalized Markdown serialization |
| `plainText` | Deterministic reading-order projection without link destinations or image payloads |
| `documentJson` | Deep-frozen TipTap/ProseMirror document JSON, or `null` before editor creation |
| `isEmpty` | TipTap's current meaningful-content state |

The outer snapshot and the complete `documentJson` tree are frozen at runtime.
Strings, primitive values, and the structural JSON tree are detached from the
live editor. The snapshot does not expose a mutable ProseMirror transaction,
selection, DOM node, Yjs type, or provider object.

## Choosing a persistence representation

TipTap recommends JSON for persistence because it preserves the editor's node
and mark structure without reparsing HTML. Use `documentJson` when the receiving
service understands the same Inkspan extension schema and needs lossless editor
round-tripping. Use Markdown or HTML for interoperable exchange, rendering, and
systems that do not share the ProseMirror schema. Use `plainText` only for
search, preview, analytics, or deliberately minimized AI context.

ProseMirror JSON is schema-coupled. Persist a descriptive schema/version field
alongside it, for example `editor_schema_version`, and migrate stored documents
when the extension set changes. Never deserialize arbitrary JSON with a broader
or different schema and assume unsupported nodes or attributes are safe.

## Imperative reads

Use `getSnapshot()` when a synchronous workflow must read the current revision,
such as a native submit handler or an explicit **Save draft** command.

```ts
const snapshot = editorRef.current?.getSnapshot();
if (snapshot && !snapshot.isEmpty) {
  submitDraft(snapshot.value, snapshot.documentJson);
}
```

Before editor creation, `getSnapshot()` returns an empty frozen snapshot in the
current mode with `documentJson: null`. After hydration, it reads all
representations from the current editor revision directly.

## Callback semantics

TipTap documents `onUpdate` as the content-change event for continuously storing
current editor output. When `onDocumentChange` is present, Inkspan builds one
snapshot inside that event and passes the same revision to both callbacks:

1. HTML is read once from the current editor.
2. Markdown is normalized once through Inkspan's hardened HTML-to-Markdown
   boundary.
3. Plain text is derived from that normalized Markdown.
4. TipTap JSON is read from the same editor state and recursively frozen.
5. `onChange(snapshot.value)` runs for backward compatibility when configured.
6. `onDocumentChange({ editor, snapshot })` receives the detached snapshot.

An `onChange`-only integration retains its existing active-mode serialization
path and does not pay the additional Markdown/plain-text/JSON snapshot cost.
Replacing either callback uses a live React ref and does not recreate the TipTap
editor, selection, history, or Yjs binding.

## Security and privacy boundaries

`snapshot.plainText` follows [`plain-text-projection.md`](plain-text-projection.md).
It preserves authored reading order, paragraph boundaries, list markers, table
cells, code, link labels, and optional image alternative text. It does not emit
hyperlink destinations, inline base64 image payloads, element names, or HTML
attributes.

`documentJson`, by contrast, is intentionally lossless and can contain links,
inline image data URIs, alternative text, and extension attributes. Treat it as
the full document body, not as a minimized analytics or model-input projection.
Freezing prevents accidental in-process mutation; it does not sanitize content,
perform authorization, encrypt data, or make the object safe to log.

Hosts must apply tenant scope, validation, request-size limits, retention,
purpose limitation, encryption, telemetry minimization, and prompt/data
minimization before persistence or model use.

## Collaboration

`CollaborativeCwlEditor` emits the same snapshot contract for document-changing
updates observed by the local TipTap instance. The snapshot is an observational
export only:

- Yjs remains the sole shared-document source of truth.
- Inkspan does not persist, transport, debounce, retry, or version snapshots.
- The host owns room authorization, provider lifecycle, persistence, conflict
  policy, and durable revision identifiers.
- ProseMirror JSON and positions must not be treated as durable collaborative
  identifiers or as a replacement for Yjs updates/state vectors.

For naruon and other CWL hosts, persist snapshots behind the authorized compose
or `ui.panel` boundary. Use descriptive nonnumeric document/session identifiers
and two-word-or-longer database object names such as `document_snapshot` and
`editor_schema_version`. Keep private-context classification and disclosure
policy in the host platform rather than the editor package.

## Performance guidance

Snapshot construction performs HTML serialization, Markdown normalization,
plain-text projection, TipTap JSON serialization, and recursive freezing.
Inkspan does this work only when `onDocumentChange` is present or when the host
explicitly calls `getSnapshot()`. Existing `onChange`-only integrations retain
the active-mode-only serialization path. High-volume hosts should debounce
network persistence outside Inkspan while retaining the latest snapshot in
memory.

Do not use `onSelectionChange` as an autosave trigger; selection-only updates do
not change the document and do not emit `onDocumentChange`.

## References

- TipTap editor instance API (`getHTML`, `getJSON`, and `getText`):
  <https://tiptap.dev/docs/editor/api/editor>
- TipTap persistence guidance recommending JSON for flexible persistence:
  <https://tiptap.dev/docs/editor/core-concepts/persistence>
- ProseMirror document JSON serialization and schema deserialization:
  <https://prosemirror.net/docs/ref/#model.Node.toJSON>
- Inkspan plain-text projection:
  [`plain-text-projection.md`](plain-text-projection.md)
- Inkspan collaborative ownership model:
  [`collaboration.md`](collaboration.md)
