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

## Resource ceilings

RFC 8259 explicitly permits JSON implementations to limit accepted text size,
nesting depth, numeric range, and string length. Inkspan applies generous,
fail-closed defaults before and during envelope inspection:

| Limit | Default | Scope |
|---|---:|---|
| `maxJsonTextCodeUnits` | 67,108,864 | Raw JavaScript string before duplicate-name scanning or `JSON.parse()` |
| `maxJsonValues` | 1,000,000 | Scalar plus object/array values inside `documentJson` |
| `maxStringCodeUnits` | 33,554,432 | Every decoded document string and object name |
| `maxNestingDepth` | 128 | Object/array nesting below the document root |

The root package exports `DEFAULT_DOCUMENT_ENVELOPE_LIMITS` and the
`DocumentEnvelopeLimits` type. A host can tighten one or more ceilings without
forking the parser:

```ts
const envelope = parseDocumentEnvelope(rawEnvelopeJson, {
  maxJsonTextCodeUnits: 2 * 1024 * 1024,
  maxJsonValues: 100_000,
  maxStringCodeUnits: 1 * 1024 * 1024,
  maxNestingDepth: 64,
});
```

Omitted or explicitly `undefined` fields retain the default. Limit names are
allowlisted, and configured values must be positive safe integers. The raw-text
ceiling is measured in JavaScript UTF-16 code units because the parser receives
a JavaScript string; gateways must additionally enforce the actual HTTP or
message byte limit before decoding. OWASP likewise recommends total request-size
limits and avoiding unbounded input-driven resource allocation.

The value and array-width checks run before recursively materializing child
values. Object reflection reads descriptors without invoking getters. Limit
failures use `DocumentEnvelopeError` and do not include source strings, object
names, inline image bytes, or tenant identifiers.

## Validation and safety

Both creation and parsing return a detached, deeply frozen envelope. The
validator rejects cycles, non-JSON values, non-finite numbers, non-plain
objects, a non-`doc` root, sparse or decorated arrays, accessor properties,
symbol or non-enumerable fields, and nesting beyond the configured ceiling.
`__proto__` is retained only as an inert own data field and cannot mutate the
prototype of the cloned document.

Raw JSON parsing rejects duplicate object names before native `JSON.parse()`
can discard earlier values. The public functions also treat direct JavaScript
objects as hostile. Proxy traps and reflection failures are converted to a
bounded `DocumentEnvelopeError`; getters are never executed during document
validation. Error messages do not include source values, source-defined
property names, URLs, inline image bytes, or tenant data.

This validation establishes a portable storage boundary; it does not sanitize
or authorize the document body. The JSON may still contain client-controlled
text, links, inline image data, alternative text, and extension attributes.
CWL and naruon hosts remain responsible for:

- document and tenant authorization;
- transport-level byte limits, timeouts, rate limits, and concurrency limits;
- selecting tighter envelope ceilings for each product tier and use case;
- encryption, retention, audit, and backup policy;
- schema migration before restoration;
- validating descriptive nonnumeric document and revision identifiers;
- authorizing collaborative mutations before `setDocumentJson`;
- deciding whether document content may enter indexing or model workflows.

The envelope has no transport, database, credential, environment-variable, or
provider dependency. It can be stored by a standalone application or carried
through CWL/naruon service boundaries as an ordinary versioned data contract.

## Standards and security references

- RFC 8259, sections 8–10 — JSON interoperability and implementation limits
- RFC 7493 — I-JSON interoperability profile
- RFC 8785 — deterministic JSON canonicalization
- OWASP Denial of Service Cheat Sheet — request-size and resource-allocation limits
- OWASP REST Security Cheat Sheet — length, range, format, type, and request-size validation
