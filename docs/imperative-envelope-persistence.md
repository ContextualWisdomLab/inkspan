# Imperative document-envelope persistence

Inkspan 0.5.21 exposes the complete versioned persistence round trip on
`CwlEditorHandle`. Hosts no longer need to reach through `getEditor()` or
manually compose envelope, canonicalization, schema-validation, and restore
functions for ordinary autosave and load workflows.

## Export the current revision

```tsx
const editorRef = createRef<CwlEditorHandle>();

const envelope = editorRef.current?.getDocumentEnvelope();
const canonicalJson = editorRef.current?.getDocumentEnvelopeJson();
const canonicalBytes = editorRef.current?.getDocumentEnvelopeBytes();
```

All three methods read one current TipTap/ProseMirror document revision. The
object envelope is detached and deeply frozen. JSON follows Inkspan's
deterministic RFC 8785 representation, and bytes are strict UTF-8 without a
byte-order mark. Optional `DocumentEnvelopeLimits` can enforce product-tier
ceilings during export.

Before client hydration or after editor destruction, object export returns
`null`, JSON export returns `''`, and byte export returns an empty
`Uint8Array`. These values are lifecycle fallbacks, not valid persisted
documents.

## Validate and restore

```tsx
const limits = {
  maxUtf8Bytes: 8 * 1024 * 1024,
  maxJsonValues: 250_000,
};

if (editorRef.current?.validateDocumentEnvelopeBytes(storedBytes, limits)) {
  editorRef.current.restoreDocumentEnvelopeBytes(storedBytes, limits);
}
```

Object and JSON-text inputs use `validateDocumentEnvelope()` and
`restoreDocumentEnvelope()`. Strict UTF-8 inputs use the corresponding
`...Bytes` methods. Validation is non-mutating. Restore completes duplicate
object-name detection, resource checks, schema/version routing, hostile-value
detachment, and full active ProseMirror schema reconstruction before one
`setContent(..., false)` mutation. A failure leaves the current document
unchanged.

Successful restore suppresses normal change callbacks because loading an
already-persisted revision must not immediately schedule another autosave.
Hosts should update their own saved-revision, dirty-state, and optimistic-
concurrency records after the method returns.

## Collaboration authorization

`CollaborativeCwlEditor` exposes the same handle because both surfaces share
the implementation. Restoring into a collaborative editor replaces the
Yjs-backed document and can affect other participants. Inkspan validates
content compatibility but does not grant permission. The CWL or naruon host
must authorize the document, tenant, user, and expected revision before
invoking restore and must coordinate awareness, audit, and conflict UX.

## Security and MSA boundary

The convenience methods preserve all lower-level guarantees: redacted typed
errors, duplicate-name rejection, configurable resource ceilings, strict UTF-8
decoding, canonical serialization, active-schema validation, and
unchanged-document failure behavior.

They do not replace gateway byte limits, decompression limits, timeouts,
rate/concurrency controls, migration routing, tenant isolation, encryption,
signatures, key management, retention, audit, or optimistic concurrency.
Persist descriptive nonnumeric document, tenant, user, and revision identifiers
in host metadata rather than extending the strict envelope with ad hoc fields.

## Primary references

- RFC 8785, JSON Canonicalization Scheme
- RFC 8259, The JavaScript Object Notation Data Interchange Format
- WHATWG Encoding Standard, UTF-8 decoding
- TipTap editor commands and persistence guidance
- ProseMirror `Node.fromJSON` schema reconstruction
