# Versioned document persistence envelope

Inkspan's HTML and Markdown exports maximize interoperability, while
`CwlEditorDocumentSnapshot.documentJson` preserves the complete current
TipTap/ProseMirror structure. Persisting that bare JSON without an explicit
schema identity makes future extension changes difficult to route or migrate.

The root package therefore exports a small, deterministic envelope contract:

```ts
import {
  createDocumentEnvelope,
  parseDocumentEnvelope,
} from '@contextualwisdomlab/cwl-editor';

const snapshot = editorRef.current?.getSnapshot();
if (snapshot?.documentJson) {
  const envelope = createDocumentEnvelope(snapshot.documentJson);
  await saveDocument(JSON.stringify(envelope));
}

const persisted = await loadDocument();
const envelope = parseDocumentEnvelope(persisted);
editorRef.current?.setDocumentJson(envelope.documentJson);
```

Version 1 contains exactly three fields:

```json
{
  "schemaId": "https://inkspan.io/schemas/document-envelope/v1",
  "schemaVersion": 1,
  "documentJson": { "type": "doc", "content": [] }
}
```

Unknown fields, schema identifiers, and versions fail closed. Hosts must route
older or newer versions through an explicit migration function rather than
silently asking the current editor schema to interpret them.

## Validation and safety

Both creation and parsing return a detached, deeply frozen envelope. The
validator rejects cycles, non-JSON values, non-finite numbers, non-plain
objects, a non-`doc` root, and nesting deeper than 128 containers. Parse errors
are bounded and do not echo the source document or tenant data.

This validation establishes a portable storage boundary; it does not sanitize
or authorize the document body. The JSON may still contain client-controlled
text, links, inline image data, alternative text, and extension attributes.
CWL and naruon hosts remain responsible for:

- document and tenant authorization;
- request and persistence size limits;
- encryption, retention, audit, and backup policy;
- schema migration before restoration;
- validating descriptive nonnumeric document and revision identifiers;
- authorizing collaborative mutations before `setDocumentJson`;
- deciding whether document content may enter indexing or model workflows.

The envelope has no transport, database, credential, environment-variable, or
provider dependency. It can be stored by a standalone application or carried
through CWL/naruon service boundaries as an ordinary versioned data contract.
