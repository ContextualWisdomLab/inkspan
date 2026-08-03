# Document snapshots

Inkspan exposes a detached document snapshot for hosts that need one consistent
revision for autosave, preview, search indexing, audit, and AI-context
construction. The same contract is available from standalone and provider-neutral
collaborative editors.

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
| `isEmpty` | TipTap's current meaningful-content state |

The snapshot object is frozen at runtime and all fields are detached strings or
primitive values. It does not expose a mutable ProseMirror transaction,
selection, DOM node, Yjs type, or provider object.

## Imperative reads

Use `getSnapshot()` when a synchronous workflow must read the current revision,
such as a native submit handler or an explicit **Save draft** command.

```ts
const snapshot = editorRef.current?.getSnapshot();
if (snapshot && !snapshot.isEmpty) {
  submitDraft(snapshot.value);
}
```

Before editor creation, `getSnapshot()` returns an empty frozen snapshot in the
current mode. After hydration, it reads the current editor revision directly.

## Callback semantics

TipTap v2 documents `onUpdate` as the content-change event for continuously
storing current editor output. When `onDocumentChange` is present, Inkspan builds
one snapshot inside that event and passes the same revision to both callbacks:

1. HTML is read once from the current editor.
2. Markdown is normalized once through Inkspan's hardened HTML-to-Markdown
   boundary.
3. Plain text is derived from that normalized Markdown.
4. `onChange(snapshot.value)` runs for backward compatibility when configured.
5. `onDocumentChange({ editor, snapshot })` receives the detached snapshot.

An `onChange`-only integration retains its existing active-mode serialization
path and does not pay the additional Markdown/plain-text projection cost.
Replacing either callback uses a live React ref and does not recreate the TipTap
editor, selection, history, or Yjs binding.

## Plain-text privacy boundary

`snapshot.plainText` follows [`plain-text-projection.md`](plain-text-projection.md).
It preserves authored reading order, paragraph boundaries, list markers, table
cells, code, link labels, and optional image alternative text. It does not emit
hyperlink destinations, inline base64 image payloads, element names, or HTML
attributes.

Plain text is therefore suitable as an input to host-owned search, preview, and
AI pipelines, but it is not an authorization or classification decision. A host
must still apply tenant scope, retention, purpose limitation, and prompt/data
minimization before persistence or model use.

## Collaboration

`CollaborativeCwlEditor` emits the same snapshot contract for document-changing
updates observed by the local TipTap instance. The snapshot is an observational
export only:

- Yjs remains the sole shared-document source of truth.
- Inkspan does not persist, transport, debounce, retry, or version snapshots.
- The host owns room authorization, provider lifecycle, persistence, conflict
  policy, and durable revision identifiers.
- ProseMirror positions and snapshot strings must not be treated as durable
  collaborative identifiers.

For naruon and other CWL hosts, persist snapshots behind the authorized compose
or `ui.panel` boundary. Use descriptive nonnumeric document/session identifiers
and keep private-context classification and disclosure policy in the host
platform rather than the editor package.

## Performance guidance

Snapshot construction performs HTML serialization, Markdown normalization, and
plain-text projection. Inkspan does this work only when `onDocumentChange` is
present or when the host explicitly calls `getSnapshot()`. Existing
`onChange`-only integrations retain the active-mode-only serialization path.
High-volume hosts should debounce network persistence outside Inkspan while
retaining the latest snapshot in memory.

Do not use `onSelectionChange` as an autosave trigger; selection-only updates do
not change the document and do not emit `onDocumentChange`.

## References

- TipTap v2 output and update guidance:
  <https://v2.tiptap.dev/docs/guides/output-json-html>
- TipTap v2 editor events:
  <https://v2.tiptap.dev/docs/editor/api/events>
- Inkspan plain-text projection:
  [`plain-text-projection.md`](plain-text-projection.md)
- Inkspan collaborative ownership model:
  [`collaboration.md`](collaboration.md)
