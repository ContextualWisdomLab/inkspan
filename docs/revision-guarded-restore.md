# Revision-guarded document restore

Inkspan 0.5.23 adds a local optimistic-concurrency boundary for delayed
autosave, AI, template, and review operations. A validated versioned envelope
can replace the active editor document only when the editor still matches an
expected Inkspan SHA-256 strong entity tag.

The feature prevents a stale asynchronous result from silently replacing newer
standalone or Yjs-backed content. It complements—but does not replace—the
server-side atomic `If-Match` compare-and-swap required for durable persistence.

## Pure API

```ts
import {
  restoreDocumentEnvelopeIfMatch,
  type CwlEditorIfMatchRestoreResult,
} from '@contextualwisdomlab/cwl-editor';

const result: CwlEditorIfMatchRestoreResult =
  await restoreDocumentEnvelopeIfMatch(
    editor,
    savedRevision.strongEntityTag,
    incomingEnvelope,
  );

if (result.status === 'conflict') {
  // Do not discard either version. Ask the host conflict workflow to reload,
  // compare, merge, fork, or retry from a fresh revision.
}
```

Use `restoreDocumentEnvelopeBytesIfMatch()` for strict UTF-8 envelope bytes.
Both functions accept optional `DocumentEnvelopeLimits` and an optional
`DocumentEnvelopeDigestProvider` after the source argument.

The expected tag must exactly match Inkspan's generated representation:

```text
"sha256-<64 lowercase hexadecimal characters>"
```

Weak tags, unquoted values, uppercase digests, alternate algorithms, controls,
and extra syntax fail closed before the editor document is read or a digest
provider is invoked.

## Result states

A successful result is frozen and contains the stable previous revision and the
validated envelope that was applied:

```ts
{
  status: 'restored',
  previousRevision,
  envelope,
}
```

A stable mismatch is also a frozen value and includes the active revision that
did not satisfy the precondition:

```ts
{
  status: 'conflict',
  currentRevision,
}
```

When the document changes while asynchronous SHA-256 or synchronous untrusted-
source preparation is in progress, or when the captured editor is destroyed,
Inkspan returns:

```ts
{
  status: 'conflict',
  currentRevision: null,
}
```

The captured validator is intentionally withheld because it is no longer the
active document's validator. A destroyed editor is likewise no longer a valid
mutation target. Inkspan does not parse the incoming source after detecting
destruction, and an already-destroyed editor returns the null-revision conflict
before hashing. The host can acquire the current editor instance and a fresh
revision before retrying.

Conflict is a normal result rather than an exception; malformed inputs,
provider failures, resource violations, active-schema incompatibility, and
active editor-policy rejection remain typed redacted exceptions.

`DocumentEnvelopeRestoreError` means the document passed envelope and schema
preparation but a ProseMirror transaction policy refused or transformed the
replacement. The error contains no source URL, text, inline image payload, or
tenant data. A caller must not record the operation as restored when this error
is raised.

## Race, lifecycle, and reentrancy boundary

Inkspan captures the immutable ProseMirror `editor.state.doc` reference and
hashes the versioned canonical envelope derived from that exact node. After the
digest resolves, it verifies that the editor remains alive and the active
document reference is unchanged. If the editor was destroyed or the document
moved, the incoming source is not parsed and no mutation occurs.

When the stable revision matches, Inkspan completes envelope parsing, resource
checks, version routing, hostile-value detachment, and complete active-schema
reconstruction synchronously. Reflection over untrusted objects can invoke
Proxy traps even though ordinary accessor properties are rejected without
execution, so Inkspan checks editor lifecycle and active document identity again
after source preparation. If reentrant code changed or destroyed the editor,
the prepared source is discarded and a null-revision conflict is returned.

Only after both checks does Inkspan apply one
`setContent(documentNode, false)` replacement without another asynchronous
boundary or attacker-controlled property access. TipTap commands can report
command execution before ProseMirror transaction filters decide whether the
new document is acceptable, so Inkspan compares the resulting active document
with the prepared node. Built-in safe-link and inline-image filters, or a
host-supplied policy plugin, therefore cannot produce a false `restored` result.
Selection-only transactions keep the same document reference and do not create
false content conflicts.

This is a local JavaScript concurrency, lifecycle, and reentrancy boundary. It
does not make browser memory a durable system of record and cannot replace a
database transaction.

## Imperative handle

The shared standalone and collaborative handle exposes the same behavior:

```tsx
const result = await editorRef.current?.restoreDocumentEnvelopeIfMatch(
  expectedStrongEntityTag,
  incomingEnvelope,
  limits,
  digestProvider,
);
```

Use `restoreDocumentEnvelopeBytesIfMatch()` for strict UTF-8 bytes. Before
client hydration, handle methods resolve to `null` without reading the source or
invoking the digest provider. A conditional restore that was started on a live
editor but outlives that editor resolves to a null-revision conflict rather than
mutating a destroyed instance or reporting stale success.

Successful restore suppresses normal change callbacks, matching the existing
atomic restore contract. The host should update its saved revision and dirty
state after success rather than treating the loaded persistence record as a new
user edit.

## Collaboration and authorization

`CollaborativeCwlEditor` exposes the same handle because Inkspan shares one
imperative implementation. A successful restore replaces the Yjs-backed
document and can affect every participant. The host must authorize the document,
tenant, user, expected revision, and operation before invoking it.

Inkspan does not create or connect a provider, carry credentials, persist Yjs
updates, assign rooms, destroy host-owned documents, or decide conflict UX.
CWL and naruon integrations retain transport, tenant isolation, server-side
atomic compare-and-swap, audit, retry/backoff, retention, and human conflict
resolution.

## Server-side persistence remains mandatory

A local match only proves what the current editor contained during one stable
JavaScript continuation. The persistence service must independently compare the
expected strong validator with its current durable revision inside the same
transaction that writes the new content. A false precondition must produce
`412 Precondition Failed` and leave durable content unchanged.

Revision tags are equality validators, not signatures, bearer credentials,
public document identifiers, tenant membership, or proof that a prior write was
committed. Persist descriptive nonnumeric document, tenant, user, and revision
identifiers as host metadata.

## Primary references

- [RFC 8785: JSON Canonicalization Scheme](https://www.rfc-editor.org/rfc/rfc8785)
- [Verified RFC 8785 erratum 7920: reject negative zero](https://www.rfc-editor.org/errata/eid7920)
- [RFC 9110 §13.1.1: `If-Match`](https://www.rfc-editor.org/rfc/rfc9110#section-13.1.1)
- [W3C Web Cryptography API Recommendation](https://www.w3.org/TR/2017/REC-WebCryptoAPI-20170126/)
- [TipTap v2 editor lifecycle and `isDestroyed`](https://v2.tiptap.dev/docs/editor/api/editor)
- [TipTap v2 `setContent`](https://v2.tiptap.dev/docs/editor/api/commands/content/set-content)
- [TipTap JSON persistence guidance](https://v2.tiptap.dev/docs/guides/output-json-html)
- [ProseMirror state and immutable document model](https://prosemirror.net/docs/ref/#state.EditorState)
