# Schema-validated structural insertion

Inkspan supports structured templates and model-produced TipTap/ProseMirror JSON
through `CwlEditorHandle.insertDocumentJson()`. Insertion is different from a
full restore: callers may insert either top-level block nodes or inline nodes at
the current selection. Both forms now pass through a complete active-schema
preflight before Inkspan dispatches an editor transaction.

```ts
const candidateNodes = await generateApprovedTemplate();

if (!editorRef.current?.validateDocumentInsertionJson(candidateNodes)) {
  showUnsupportedTemplateMessage();
  return;
}

editorRef.current.insertDocumentJson(candidateNodes);
```

The root-package `validateDocumentInsertionJson(editor, candidateNodes)` export
provides the same preflight when a host already owns the TipTap `Editor`.

## Atomicity and supported shapes

Inkspan first treats the candidate as one or more top-level document blocks. If
that shape does not satisfy the active schema, it checks the same candidate as
inline paragraph content. Every node, mark, attribute, and child relationship is
reconstructed through the current ProseMirror schema and recursively checked.
Only a detached validated `Fragment` reaches TipTap's `insertContent` command.

Unknown nodes, unknown marks, malformed attributes, invalid child structures,
cycles, accessors, sparse arrays, non-finite numbers, and excessive nesting fail
with the redacted `DocumentSchemaError`. Validation itself does not focus the
editor, move the selection, dispatch a transaction, or invoke document-change
callbacks. A rejected insertion leaves the current document unchanged.

Insertion position still follows ProseMirror transaction semantics. A node that
is valid in the schema may be wrapped, split, or rejected according to the
current selection and its content expression. Hosts that need a fixed location
should first establish an authorized selection through their own workflow.

## Security and collaboration

Structural compatibility is not authorization. JSON from templates, imported
documents, plugins, or language models remains untrusted client-controlled
content. CWL and naruon hosts retain responsibility for tenant and document
authorization, model-output approval, request-size limits, retention, audit,
encryption, and feature-specific policy.

Inkspan does not execute source accessors while inspecting JSON-like input and
does not expose source text, attributes, links, inline image bytes, or tenant
identifiers in schema errors. Validated content still passes through the normal
safe-link and strict inline-raster transaction filters when inserted.

In collaborative editors, insertion mutates the host-owned Yjs document and is
synchronized by the host-owned provider. The host must authorize the operation
before calling the handle. Inkspan adds no provider, transport, credential,
database, environment-variable, or naruon-specific runtime dependency, so the
same API remains usable as a standalone module or inside the CWL modular MSA.
Use descriptive nonnumeric document, template, operation, and user identifiers
in surrounding persistence and audit records.

## Primary references

- TipTap `insertContent` JSON, node, and fragment command contract:
  <https://tiptap.dev/docs/editor/api/commands/content/insert-content>
- TipTap schema and JSON content checking guidance:
  <https://tiptap.dev/docs/editor/core-concepts/schema>
- ProseMirror `Schema.nodeFromJSON`, `Node.check`, and `Fragment`:
  <https://prosemirror.net/docs/ref/#model.Fragment>
