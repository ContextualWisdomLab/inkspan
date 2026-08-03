# Selection context contract

Inkspan exposes a point-in-time selection snapshot through
`CwlEditorHandle.getSelection()`. The surface is intended for host-owned AI
rewrite, command, audit, and compose workflows that need the user's current
selection without scraping browser DOM Selection state or reaching through
TipTap internals.

## Host API

```tsx
import { useRef } from 'react';
import {
  CwlEditor,
  type CwlEditorHandle,
} from '@contextualwisdomlab/cwl-editor';

const editorRef = useRef<CwlEditorHandle>(null);

<CwlEditor ref={editorRef} defaultValue="Select text to rewrite." />;

const selection = editorRef.current?.getSelection();
if (selection && !selection.empty) {
  const proposedRewrite = await rewriteWithHostModel(selection.text);
  editorRef.current?.insertValue(proposedRewrite);
}
```

The snapshot contains `anchor`, `head`, normalized `from` and `to` document
positions, `empty`, and selected `text`. `insertValue` continues to replace the
current selection or insert at the cursor through the normal editor transaction
and `onChange` path.

## Selection semantics

- Coordinates are ProseMirror document positions for the editor state observed
  when `getSelection()` runs.
- `anchor` and `head` preserve selection direction; `from` and `to` are the
  normalized lower and upper boundaries.
- Cursor selections return `empty: true` and an empty `text` value.
- Range selections use ProseMirror `Node.textBetween` in document order, with a
  blank line between text blocks.
- Non-text leaf nodes are omitted. Inline image data URIs, attributes, HTML,
  Markdown delimiters, and hyperlink destinations are not copied into `text`.
  Link labels remain ordinary selected text.
- Before an editor exists or after it has been destroyed, the handle returns the
  safe empty snapshot `{ anchor: 0, head: 0, from: 0, to: 0, empty: true,
  text: '' }`.

Coordinates are ephemeral. Hosts must not persist them as document identifiers,
authorization evidence, or database keys. Collaborative transactions may remap
the live selection after a snapshot has been taken. Hosts should re-read the
selection immediately before applying a command when exact positional identity
matters.

## Security and privacy boundary

The selection API intentionally returns plain authored text rather than a
serialized slice. This avoids exposing inline base64 payloads, external link
destinations, HTML attributes, or editor implementation objects to analytics,
LLM prompts, logs, and cross-service requests by default.

The text itself can still contain confidential or regulated user content. CWL
and naruon hosts remain responsible for tenant authorization, purpose
limitation, consent, retention, prompt logging, model routing, data residency,
and redaction. Do not treat `getSelection()` as an authorization or data-loss
prevention decision.

## MSA and collaboration interoperability

`getSelection()` is implemented by the shared imperative handle used by both
`CwlEditor` and `CollaborativeCwlEditor`. It introduces no transport, provider,
credential, persistence, environment-variable, database-object, or naruon
runtime dependency. The host continues to own Yjs transport and persistence,
service authorization, AI execution, retries, audit records, and user-facing
approval flows.

## Primary references

- ProseMirror reference documentation for `Selection`, `TextSelection`,
  `NodeSelection`, and `Node.textBetween`:
  <https://prosemirror.net/docs/ref/>
- TipTap editor API and command chaining:
  <https://tiptap.dev/docs/editor/api/editor>
- W3C Selection API, for the browser selection surface Inkspan deliberately does
  not require hosts to scrape:
  <https://www.w3.org/TR/selection-api/>

## Verification

The repository-wide 100% TypeScript coverage gate verifies the pre-mount empty
fallback, non-empty range selection, normalized directional positions,
plain-text reading order, hyperlink-destination omission, and cursor behavior.
