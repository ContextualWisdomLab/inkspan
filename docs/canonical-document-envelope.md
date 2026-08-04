# Canonical document envelopes

Inkspan exposes `serializeDocumentEnvelope()` and `encodeDocumentEnvelope()` for deterministic persistence, comparison, hashing, signing, deduplication, and optimistic-concurrency inputs.

```ts
import {
  createDocumentEnvelope,
  encodeDocumentEnvelope,
  serializeDocumentEnvelope,
} from '@contextualwisdomlab/cwl-editor';

const snapshot = editorRef.current!.getSnapshot();
if (snapshot.documentJson === null) {
  throw new Error('The editor is not ready');
}

const envelope = createDocumentEnvelope(snapshot.documentJson);
const canonicalJson = serializeDocumentEnvelope(envelope);
const canonicalUtf8 = encodeDocumentEnvelope(envelope);
```

## Deterministic contract

The serializer follows the JSON Canonicalization Scheme rules for an already validated Inkspan envelope:

- no insignificant whitespace;
- ECMAScript JSON serialization for literals, strings, and IEEE-754 numbers;
- recursive property sorting by raw UTF-16 code units;
- unchanged array element order;
- unchanged Unicode content, without normalization;
- rejection of lone UTF-16 surrogates;
- UTF-8 output without a byte-order mark from `encodeDocumentEnvelope()`.

The canonical envelope can be the input to a host-owned digest or signature function. Inkspan intentionally does not select a hash algorithm, key-management service, signing identity, object-store key, or conflict-resolution policy.

## Trust and compatibility boundary

Canonicalization does not authorize a write and does not prove that document content is safe or semantically valid. Before persistence or restoration, CWL and naruon hosts remain responsible for:

1. authenticating the caller and authorizing the descriptive nonnumeric document identifier;
2. enforcing tenant isolation, document size, retention, encryption, and logging policy;
3. parsing the envelope and validating `documentJson` against the active editor schema;
4. selecting and recording explicit migrations when schema versions change;
5. comparing canonical bytes only within the same documented envelope and extension contract.

`parseDocumentEnvelope()` remains fail-closed for unknown fields, schema identifiers, and versions. `validateDocumentJson()` or `CwlEditorHandle.validateDocumentJson()` remains the active-schema preflight before `setDocumentJson()`.

## Raw JSON input

RFC 8785 requires duplicate object property names to be rejected before canonicalization. JavaScript's native `JSON.parse()` does not retain evidence of duplicate names. For signed or adversarial raw JSON protocols, hosts must use an I-JSON parser that rejects duplicate names before passing the resulting value into Inkspan. Envelopes created in memory with `createDocumentEnvelope()` cannot contain duplicate object keys.

## Standards basis

- RFC 8785, JSON Canonicalization Scheme
- RFC 7493, The I-JSON Message Format
- RFC 8259, The JavaScript Object Notation Data Interchange Format
- ECMAScript JSON serialization and UTF-16 string ordering
