# Server rendering and hydration

Inkspan's standalone and collaborative React components are safe to include in
server-rendered application trees. Both components configure TipTap with
`immediatelyRender: false`, so the server emits a deterministic editor shell and
defers creation of the ProseMirror editor view until the React client hydrates.
This follows TipTap's official SSR guidance and prevents server/client markup
mismatches caused by constructing an editor view during server rendering.

## Rendering contract

- Server output contains the stable Inkspan shell, mode metadata, and, for the
  collaborative surface, the non-interactive connection-status region.
- Server output does not contain a ProseMirror editable view or serialize the
  initial document into presentation markup.
- The TipTap editor, event handlers, native-form mirror, toolbar, and Yjs binding
  become available after client hydration.
- `onReady` and the imperative `CwlEditorHandle` remain client lifecycle
  surfaces. Hosts must not expect either during server rendering.
- The server-rendered shell does not perform network requests, open a
  collaboration provider, persist content, or destroy a host-owned `Y.Doc`.

## Next.js App Router

Inkspan uses React hooks and remains an interactive client component. In a
Next.js App Router application, place it behind a small host-owned client
boundary:

```tsx
'use client';

import { CwlEditor } from '@contextualwisdomlab/cwl-editor';
import '@contextualwisdomlab/cwl-editor/styles.css';

export function DocumentEditor() {
  return <CwlEditor defaultValue="# Draft" />;
}
```

A Server Component may import and render `DocumentEditor`; it should not create
browser-only providers, awareness objects, or long-lived collaborative state on
the server. Create those resources inside the client boundary and keep their
transport, authentication, authorization, persistence, and disposal lifecycle
host-owned.

## Traditional SSR frameworks

React frameworks that render client components on the server may render
`CwlEditor` or `CollaborativeCwlEditor` directly. The initial shell is suitable
for `renderToString` and hydration. Do not disable hydration for an editor that
must become interactive.

Hosts should reserve any required layout space in their application shell to
avoid layout shift when the client editor and toolbar mount. Inkspan deliberately
does not invent a fixed editor height because compose surfaces, forms, dialogs,
and document workspaces have different layout contracts.

## CWL and naruon integration boundary

- Pass only serializable document identifiers and initial application state
  through server boundaries.
- Instantiate browser transports, credentials, collaboration providers, and
  `Y.Doc` ownership within the authorized client/service integration layer.
- Treat initial editor content as client presentation state; authorize and
  validate all persisted mutations at the service boundary.
- Do not embed secrets in editor props, server-rendered markup, collaboration
  awareness, hidden form fields, or inline diagnostics.
- Preserve descriptive nonnumeric identifiers across document, user, session,
  and collaboration boundaries.

## Verification

Repository tests run standalone and collaborative components through
`react-dom/server` in a Node environment and assert that the stable shell is
emitted without a ProseMirror view or document-body leakage. The normal browser
suite then verifies client initialization, editing, accessibility, forms,
collaboration, and the repository-wide 100% coverage gate.

## References

- TipTap React SSR guidance: <https://tiptap.dev/docs/editor/getting-started/install/react>
- TipTap performance and `immediatelyRender`: <https://tiptap.dev/docs/guides/performance>
- React `renderToString`: <https://react.dev/reference/react-dom/server/renderToString>
- Next.js client components: <https://nextjs.org/docs/app/getting-started/server-and-client-components>
