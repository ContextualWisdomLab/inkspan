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

Unknown fields, schema identifiers, and versions fail closed in the strict
current-schema parser. Hosts route older or newer versions through an explicit
migration function rather than silently asking the current editor schema to
interpret them.

## Identity-only migration routing

When a host needs to select a migration for a complete legacy or future
envelope, use the bounded identity-only inspector rather than weakening the
strict parser or implementing a second untrusted JSON parser in the host:

```ts
import { parseDocumentEnvelope } from '@contextualwisdomlab/cwl-editor';
import { inspectDocumentEnvelopeIdentity } from '@contextualwisdomlab/cwl-editor/envelope-identity';

const identity = inspectDocumentEnvelopeIdentity(persisted);
const migrated = await migrationRegistry.migrate(identity, persisted);
const currentEnvelope = parseDocumentEnvelope(migrated);
```

The identity functions are also exported by the root package. The dedicated
`envelope-identity` subpath is framework-independent for servers, workers,
migration jobs, storage adapters, and other non-editor processes.

`inspectDocumentEnvelopeIdentity()` and
`inspectDocumentEnvelopeIdentityBytes()` return only a deeply frozen routing
value:

```ts
interface CwlEditorDocumentEnvelopeIdentity {
  readonly schemaId: string;
  readonly schemaVersion: number;
}
```

Inspection requires a complete syntactically valid envelope with `schemaId`,
`schemaVersion`, and `documentJson`. The identity must use a string schema ID and
a positive safe-integer schema version. JSON text retains duplicate-name and
resource-limit defenses; byte input retains bounded copying, BOM rejection, and
fatal UTF-8 decoding. Direct JavaScript objects are inspected through data
property descriptors without invoking getters, and hostile proxy/reflection
failures become bounded redacted `DocumentEnvelopeError` values.

The inspector may ignore additional future top-level data fields only when they
are ordinary enumerable JSON data fields and can be ignored without evaluating
accessors. It validates that `documentJson` is bounded JSON-compatible data, but
it deliberately does **not** require an unsupported generation to satisfy the
current TipTap/ProseMirror `doc` schema before returning routing metadata. That
is the key distinction between safe schema identification and current-schema
acceptance.

The inspector never returns `documentJson`, document text, links, inline image
data, future source fields, actor or tenant identity, credentials, transport
state, signatures, authorization decisions, migration-success claims, or
durable-write claims. Identifying an unsupported schema is therefore a routing
result, not proof that Inkspan understands, authorizes, or migrated that
representation.

Migration execution remains host-owned. The host chooses the schema registry,
authorizes the operation, applies tenant isolation and encryption, executes the
version-specific migration, performs durable persistence/audit/retention, and
owns rollback and recovery. The migrated result must re-enter
`parseDocumentEnvelope()` and pass the ordinary strict current-schema boundary
before it becomes canonical Inkspan document state. If no migration exists or a
migration fails, preserve the original source unchanged and report that bounded
host outcome.

## Canonical UTF-8 byte round trip

`encodeDocumentEnvelope()` creates canonical UTF-8 bytes for storage, hashes,
signatures, audit comparisons, and optimistic-concurrency inputs.
`parseDocumentEnvelopeBytes()` is the strict inverse boundary:

```ts
import {
  encodeDocumentEnvelope,
  parseDocumentEnvelopeBytes,
} from '@contextualwisdomlab/cwl-editor';

const persistedBytes = encodeDocumentEnvelope(envelope);
await objectStore.put(documentKey, persistedBytes);

const restored = parseDocumentEnvelopeBytes(
  await objectStore.get(documentKey),
  { maxUtf8Bytes: 2 * 1024 * 1024 },
);
```

The byte parser accepts a `Uint8Array` (including Node.js `Buffer` subclasses),
checks `maxUtf8Bytes` before copying or decoding, detaches the accepted bytes,
and uses the Encoding Standard's fatal UTF-8 decoder. Malformed sequences fail
instead of becoming replacement characters. A leading UTF-8 byte-order mark is
rejected: RFC 8259 requires networked JSON generators not to add one, while its
optional parser tolerance is deliberately not used for Inkspan's canonical
persistence contract. Callers with a legacy BOM-bearing source must normalize
and audit that migration explicitly before parsing.

The byte parser does not autodetect UTF-16, legacy code pages, compression, or
content type. Decompression and transport metadata remain host boundaries and
must be bounded before materializing a `Uint8Array`.

## Resource ceilings

RFC 8259 explicitly permits JSON implementations to limit accepted text size,
nesting depth, numeric range, and string length. Inkspan applies generous,
fail-closed defaults before and during envelope inspection:

| Limit | Default | Scope |
|---|---:|---|
| `maxUtf8Bytes` | 67,108,864 | Raw `Uint8Array` before copy and strict UTF-8 decoding |
| `maxJsonTextCodeUnits` | 67,108,864 | Raw JavaScript string before duplicate-name scanning or `JSON.parse()` |
| `maxJsonValues` | 1,000,000 | Scalar plus object/array values inside `documentJson` |
| `maxStringCodeUnits` | 33,554,432 | Every decoded document string and object name |
| `maxNestingDepth` | 128 | Object/array nesting below the document root |

The root package exports `DEFAULT_DOCUMENT_ENVELOPE_LIMITS` and the
`DocumentEnvelopeLimits` type. The identity-only subpath exposes the same limits
contract without importing the interactive editor dependency graph. A host can
tighten one or more ceilings without forking either boundary:

```ts
const envelope = parseDocumentEnvelope(rawEnvelopeJson, {
  maxUtf8Bytes: 2 * 1024 * 1024,
  maxJsonTextCodeUnits: 2 * 1024 * 1024,
  maxJsonValues: 100_000,
  maxStringCodeUnits: 1 * 1024 * 1024,
  maxNestingDepth: 64,
});
```

Omitted or explicitly `undefined` fields retain the default. Limit names are
allowlisted, and configured values must be positive safe integers. The raw-text
ceiling is measured in JavaScript UTF-16 code units, while the byte ceiling is
measured before decoding. Gateways must additionally enforce the complete HTTP,
message, compressed-body, and object-store limits before the library boundary.
OWASP likewise recommends total request-size limits and avoiding unbounded
input-driven resource allocation.

For strict current-schema JSON text and decoded UTF-8 bytes, the iterative
duplicate-name scanner counts every scalar and container and tracks value depth
before `JSON.parse()`. The fixed three-value and one-depth envelope wrapper
allowance keeps configured limits scoped to `documentJson`. Oversized raw
structures therefore fail before the native parser allocates their complete
object graph. Syntax-invalid input that remains inside the ceilings is still
reported by the canonical parser.

The identity-only path preserves the same configured limits and validates the
complete decoded document as JSON-compatible bounded data after parsing; it
does not treat an unknown version as current-schema document semantics merely
because the source is inside resource ceilings.

The post-parse value and array-width checks remain as defense in depth before
recursively cloning child values. Object reflection reads descriptors without
invoking getters. Limit failures use `DocumentEnvelopeError` and do not include
source strings, object names, inline image bytes, or tenant identifiers.

## Validation and safety

Both current-schema creation and parsing return a detached, deeply frozen
envelope. The validator rejects cycles, non-JSON values, non-finite numbers,
non-plain objects, a non-`doc` root, sparse or decorated arrays, accessor
properties, symbol or non-enumerable fields, and nesting beyond the configured
ceiling. `__proto__` is retained only as an inert own data field and cannot
mutate the prototype of the cloned document.

Raw JSON parsing rejects duplicate object names before native `JSON.parse()` can
discard earlier values. The public functions also treat direct JavaScript
objects as hostile. Proxy traps and reflection failures are converted to a
bounded `DocumentEnvelopeError`; getters are never executed during document or
identity inspection. Error messages do not include source values,
source-defined property names, URLs, inline image bytes, or tenant data.

This validation establishes portable storage and routing boundaries; it does not
sanitize or authorize the document body. The JSON may still contain
client-controlled text, links, inline image data, alternative text, and
extension attributes. CWL and naruon hosts remain responsible for:

- document and tenant authorization;
- transport-level byte limits, decompression limits, timeouts, rate limits, and concurrency limits;
- selecting tighter envelope ceilings for each product tier and use case;
- encryption, retention, audit, and backup policy;
- schema registry, migration selection/execution, persistence, and rollback before restoration;
- validating descriptive nonnumeric document and revision identifiers;
- authorizing collaborative mutations before `setDocumentJson`;
- deciding whether document content may enter indexing or model workflows.

The envelope and identity inspector have no transport, database, credential,
environment-variable, or provider dependency. They can be used by a standalone
application or carried through CWL/naruon service boundaries as ordinary
versioned data contracts.

## Standards and security references

- RFC 8259, sections 8–10 — UTF-8 JSON interchange, BOM behavior, and implementation limits
- WHATWG Encoding Standard — fatal UTF-8 decoding and BOM handling
- RFC 7493 — I-JSON interoperability profile
- RFC 8785 — deterministic JSON canonicalization for accepted current-schema bytes, not unsupported-version semantic validation
- OWASP Denial of Service Cheat Sheet — request-size and resource-allocation limits
- OWASP REST Security Cheat Sheet — length, range, format, type, and request-size validation
