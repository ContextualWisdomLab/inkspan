# Provider-neutral collaboration

Inkspan 0.3 exposes real-time editing from a separate package entrypoint:

```bash
pnpm add @contextualwisdomlab/cwl-editor yjs
```

```tsx
import * as Y from 'yjs';
import {
  CollaborativeCwlEditor,
  type CollaborationConnectionStatus,
  type CollaborationProviderLike,
} from '@contextualwisdomlab/cwl-editor/collaboration';
import '@contextualwisdomlab/cwl-editor/styles.css';

interface SharedDocumentProps {
  document: Y.Doc;
  provider: CollaborationProviderLike;
  connectionStatus: CollaborationConnectionStatus;
}

export function SharedDocument({
  document,
  provider,
  connectionStatus,
}: SharedDocumentProps) {
  return (
    <CollaborativeCwlEditor
      document={document}
      provider={provider}
      user={{
        userId: 'editor-alice',
        displayName: 'Alice',
        cursorColor: '#2563eb',
      }}
      mode="markdown"
      connectionStatus={connectionStatus}
      onChange={(markdown) => {
        // Observational export only. Persist Yjs updates as authoritative data.
        console.log(markdown);
      }}
    />
  );
}
```

The collaboration entrypoint is built separately from the ordinary editor.
Applications importing only `@contextualwisdomlab/cwl-editor` do not include
Yjs, `y-prosemirror`, or the TipTap collaboration extensions in their browser
bundle.

## Ownership boundary

The host owns all stateful infrastructure:

- the stable `Y.Doc` and its authorization scope;
- the WebSocket, WebRTC, Hocuspocus, or custom transport provider;
- authentication, tenant/document authorization, token refresh, and revocation;
- persistence of Yjs updates or snapshots;
- reconnection policy, offline buffering, observability, and provider teardown.

Inkspan does not open a network connection, read an environment variable, store
a credential, select a tenant, persist a document, or call `destroy()` on a
host-supplied document or provider. Unmounting and remounting an editor against
the same live `Y.Doc` preserves the collaborative state.

Pass stable object references. Replacing `document`, `provider`, or `field`
intentionally recreates the TipTap binding; ordinary React rerenders and user
presence changes do not. Inkspan wraps the provider's awareness object with a
component-scoped listener boundary before giving it to TipTap, then detaches
that boundary at unmount. The host provider itself remains live and untouched.

## One source of truth

A collaborative editor accepts neither `value` nor `defaultValue`. The Yjs
fragment selected by `field` (default: `default`) is the sole source of truth.
This avoids two independent initializers racing to replace the same ProseMirror
state, especially when tables are present.

Apply a persisted Yjs update before mounting:

```ts
const document = new Y.Doc();
Y.applyUpdate(document, persistedUpdate);
```

For a new document, seed content once in an authorized creation/migration
transaction and persist the resulting Yjs update. Do not send static HTML or
Markdown to every client at mount time. `onChange`, `getHTML()`, `getMarkdown()`,
and `getValue()` are exports for search, email, LLM, preview, or audit pipelines;
they are not collaborative persistence formats.

StarterKit history is disabled in this mode. Toolbar and imperative `undo()` /
`redo()` commands are supplied by TipTap's Yjs collaboration extension, so the
undo manager follows collaborative transaction semantics rather than maintaining
an incompatible local ProseMirror history.

## Provider contract

Inkspan requires the provider's public Yjs awareness surface used by TipTap's
cursor integration and the accessible collaborator count:

```ts
type CollaborationAwarenessEvent = 'change' | 'update';

interface CollaborationProviderLike {
  awareness: {
    readonly clientID: number;
    readonly states: Map<number, Record<string, unknown>>;
    getLocalState(): Record<string, unknown> | null;
    getStates(): Map<number, Record<string, unknown>>;
    setLocalStateField(field: string, value: unknown): void;
    on(
      event: CollaborationAwarenessEvent,
      listener: (...args: unknown[]) => void,
    ): void;
    off(
      event: CollaborationAwarenessEvent,
      listener: (...args: unknown[]) => void,
    ): void;
  };
}
```

Hocuspocus, y-websocket, y-webrtc, and custom providers can satisfy this
structurally. Inkspan does not import a provider SDK or couple the component to
a vendor-specific connection lifecycle. The `change` event drives concise
collaborator-count announcements; TipTap's cursor integration consumes the
`update` event and `states` map.

## Presence and privacy

Only the following public cursor payload is propagated under the awareness
`user` field:

```ts
{
  id: 'editor-alice',
  name: 'Alice',
  color: '#2563eb'
}
```

`userId` must be nonempty, descriptive, not numeric-only, and no longer than 80
Unicode code points. `displayName` must be nonempty and is published and rendered
as at most 80 Unicode code points. `cursorColor` must be a six-digit hexadecimal
color. Do not put access tokens, email addresses, roles, tenant IDs, document
permissions, or any other secret in awareness: awareness state is ephemeral,
broadcast to peers, and intentionally not used as an authorization source.

Remote names are inserted with `textContent`, length-bounded, and never treated
as markup. Invalid remote colors fall back to a safe color. Remote collaborator
counts ignore blank, numeric-only, and over-80-code-point public identifiers.
Cursor labels choose black or white text from relative luminance for readable
contrast.

## Accessibility

The component keeps the same `role="textbox"`, `aria-multiline`, custom
`ariaLabel`, keyboard toolbar, and read-only semantics as `CwlEditor`. A
pre-existing `role="status"`, `aria-live="polite"`, `aria-atomic="true"` region
announces concise connection and remote-collaborator counts. It listens to
awareness `change` events rather than heartbeat-style updates, avoiding
unnecessary repeated announcements.

The visible connection state is host-supplied through `connectionStatus`:
`connecting`, `connected`, `disconnected`, or `offline`. Inkspan does not infer
transport health from undocumented provider internals.

## Naruon and CWL service boundaries

For Naruon or another CWL MSA host, keep collaboration behind the existing UI
panel boundary:

1. The document/session service authorizes a descriptive document identifier
   and returns transport credentials to the host shell.
2. The host constructs and retains the provider and `Y.Doc` for that session.
3. Inkspan receives only the document, awareness boundary, public user fields,
   and presentation props.
4. The host persists Yjs updates and independently indexes observational
   Markdown/HTML exports for search, RAG, email, or downstream agents.
5. Revocation closes the host provider and removes the panel; Inkspan is not an
   authorization enforcement point.

This separation permits provider replacement, regional transport changes,
offline-first clients, and service-account policy evolution without forking the
editor or coupling its core package to organization infrastructure.

## Primary references

- [TipTap v2 Collaboration](https://v2.tiptap.dev/docs/editor/extensions/functionality/collaboration)
- [TipTap v2 Collaboration Cursor](https://v2.tiptap.dev/docs/editor/extensions/functionality/collaboration-cursor)
- [Yjs Awareness and Presence](https://docs.yjs.dev/getting-started/adding-awareness)
- [WAI-ARIA `status` role](https://www.w3.org/TR/wai-aria-1.2/#status)
- [WCAG relative luminance definition](https://www.w3.org/WAI/WCAG22/Understanding/contrast-minimum.html)
