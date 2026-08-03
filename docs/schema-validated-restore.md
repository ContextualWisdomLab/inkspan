# Schema-validated structural restore

Inkspan's document envelope establishes a versioned persistence boundary, but
a compatible envelope can still contain a node or mark that the active editor
extension set does not support. Restoring such content without a complete
preflight risks lossy parsing, confusing partial output, or a late exception.

`CwlEditorHandle.validateDocumentJson()` checks a complete TipTap/ProseMirror
JSON document against the currently mounted editor schema without changing the
editor:

```ts
const envelope = parseDocumentEnvelope(await loadDocument());

if (!editorRef.current?.validateDocumentJson(envelope.documentJson)) {
  showMigrationRequired();
  return;
}

editorRef.current.setDocumentJson(envelope.documentJson);
```

`setDocumentJson()` performs the same validation again immediately before the
replacement. It reconstructs the full ProseMirror node tree, calls the schema's
recursive node check, verifies that the root is the configured top node, and
only then dispatches one replacement transaction. Invalid input throws the
redacted `DocumentSchemaError`; the existing document and change callbacks are
left untouched.

The standalone `validateDocumentJson(editor, documentJson)` export provides the
same preflight when a host already owns the TipTap `Editor` instance.

## Security and data handling

Before ProseMirror sees the input, Inkspan passes it through the versioned
document-envelope clone boundary. Accessors are not executed, Proxy/reflection
failures are redacted, cycles and non-JSON values are rejected, and the checked
node is detached from caller-owned objects. Schema errors do not include source
text, attributes, links, inline image bytes, or tenant identifiers.

Schema compatibility is not authorization or sanitization. CWL and naruon hosts
remain responsible for document and tenant authorization, migration policy,
request-size limits, retention, audit, encryption, and approval of collaborative
shared-document replacement. Inkspan's existing safe-link and inline-raster
transaction filters remain the content-security boundary when the validated
node is committed.

Validation is local and deterministic. It adds no database, network, provider,
credential, environment-variable, or naruon-specific dependency, preserving
standalone use and modular MSA integration.

## Primary references

- TipTap `setContent` command and invalid-content options:
  <https://tiptap.dev/docs/editor/api/commands/content/set-content>
- TipTap invalid-schema handling:
  <https://tiptap.dev/docs/guides/invalid-schema>
- ProseMirror `Schema.nodeFromJSON`, `Node.fromJSON`, and `Node.check`:
  <https://prosemirror.net/docs/ref/#model.Node.check>
