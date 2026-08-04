# Imperative document-envelope persistence

Inkspan 0.5.22 exposes the complete versioned persistence round trip and strong
revision validation on `CwlEditorHandle`. Hosts no longer need to reach through
`getEditor()` or manually compose envelope, canonicalization, schema-validation,
revision-digest, and restore functions for ordinary autosave and load workflows.

## Export the current revision

```tsx
const editorRef = createRef<CwlEditorHandle>();

const envelope = editorRef.current?.getDocumentEnvelope();
const canonicalJson = editorRef.current?.getDocumentEnvelopeJson();
const canonicalBytes = editorRef.current?.getDocumentEnvelopeBytes();
const revision = await editorRef.current?.getDocumentEnvelopeRevision();
```

All four methods read one current TipTap/ProseMirror document revision. The
object envelope is detached and deeply frozen. JSON follows Inkspan's
deterministic RFC 8785 representation, bytes are strict UTF-8 without a
byte-order mark, and the revision contains a lowercase SHA-256 digest plus a
quoted strong HTTP entity tag. Optional `DocumentEnvelopeLimits` can enforce
product-tier ceilings during export and revision generation.

Canonical export and revision generation reject negative zero under verified
RFC 8785 erratum 7920. ECMAScript otherwise serializes both `-0` and `0` as `0`,
which would collapse distinct pre-canonical values into the same stored bytes
and validator.

Before client hydration or after editor destruction, object export and revision
export return `null`, JSON export returns `''`, and byte export returns an empty
`Uint8Array`. These values are lifecycle fallbacks, not valid persisted
documents. A host must not store them as a document revision.

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

For an HTTP persistence service, a host can return the exact canonical
envelope's `strongEntityTag` as `ETag` and require the saved tag through
`If-Match` on update. The server must perform the compare-and-swap atomically and
return `412 Precondition Failed` instead of overwriting a newer revision. See
[document revision tags](./document-revision-tags.md) for representation,
privacy, and authorization boundaries.

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
decoding, canonical serialization, active-schema validation, strong SHA-256
revision generation, and unchanged-document failure behavior.

They do not replace gateway byte limits, decompression limits, timeouts,
rate/concurrency controls, migration routing, tenant isolation, encryption,
signatures, key management, retention, audit, or server-side optimistic
concurrency. A digest is not a signature or authorization token. Persist
descriptive nonnumeric document, tenant, user, and revision identifiers in host
metadata rather than extending the strict envelope with ad hoc fields.

## Primary references

- [RFC 8785: JSON Canonicalization Scheme](https://www.rfc-editor.org/rfc/rfc8785)
- [Verified RFC 8785 erratum 7920: reject negative zero](https://www.rfc-editor.org/errata/eid7920)
- [RFC 8259: The JavaScript Object Notation Data Interchange Format](https://www.rfc-editor.org/rfc/rfc8259)
- [RFC 9110 §13.1.1: `If-Match`](https://www.rfc-editor.org/rfc/rfc9110#section-13.1.1)
- [W3C Web Cryptography API Recommendation](https://www.w3.org/TR/2017/REC-WebCryptoAPI-20170126/)
- [WHATWG Encoding Standard: UTF-8](https://encoding.spec.whatwg.org/#utf-8)
- [TipTap persistence guidance](https://tiptap.dev/docs/editor/core-concepts/persistence)
- [ProseMirror `Node.fromJSON`](https://prosemirror.net/docs/ref/#model.Node^fromJSON)
