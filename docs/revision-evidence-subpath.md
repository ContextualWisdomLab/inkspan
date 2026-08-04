# Framework-independent revision evidence

Use the dedicated revision-evidence subpath in servers, workers, queues,
migration jobs, storage adapters, and other processes that do not render an
editor:

```ts
import {
  createDocumentEnvelopeRevisionEvidence,
  createDocumentEnvelopeRevisionEvidenceBytes,
  type DocumentEnvelopeDigestProvider,
} from '@contextualwisdomlab/cwl-editor/revision-evidence';

const captured = await createDocumentEnvelopeRevisionEvidence(
  persistedEnvelope,
  limits,
  digestProvider,
);

await saveVersion({
  document_envelope: captured.envelope,
  strong_entity_tag: captured.revision.strongEntityTag,
});
```

The subpath is published as independent ESM, CommonJS, and TypeScript
declaration artifacts. It bundles only Inkspan's versioned-envelope parser,
canonical JSON/UTF-8 serializer, SHA-256 revision contract, and frozen evidence
pairing. It does not load React, React DOM, TipTap, ProseMirror, Yjs, an editor
component, a transport client, a database adapter, credentials, or environment
configuration.

The root package continues to export the same functions for compatibility.
Applications already using `CwlEditor` can keep one root import. Non-editor
processes should prefer `/revision-evidence` so their loaded module graph does
not evaluate the interactive editor.

Because this subpath is distributed inside the existing editor package, a normal
npm or pnpm installation still installs the package-level dependencies declared
by `@contextualwisdomlab/cwl-editor`. The subpath guarantees framework-free
module evaluation, not a smaller registry dependency graph. A separately
versioned npm package would be required if procurement, image size, or software
composition policy later requires dependency-level isolation.

## Evidence semantics

Both object/JSON and strict UTF-8 functions return one shallow-frozen object:

```ts
{
  envelope, // detached and deeply frozen
  revision, // frozen SHA-256 equality validator
}
```

The revision is derived from the RFC 8785 canonical UTF-8 representation of the
returned envelope. One operation performs one strict parse and one digest-
provider invocation. Equivalent noncanonical JSON input is normalized before
hashing.

The strong entity tag may be used as an HTTP `ETag` only when it identifies the
actual selected representation. A durable service must enforce authenticated,
atomic RFC 9110 `If-Match` comparison in the same transaction that writes the
new document. Local evidence is not authorization, tenant membership, a
signature, a bearer token, or proof of persistence.

## Security and privacy

The evidence envelope contains the complete client-controlled document,
including author text, accepted hyperlinks, alternative text, inline base64
image payloads, and extension attributes. Do not copy it into ordinary logs,
metrics labels, analytics events, exception messages, public URLs, or compact
revision metadata.

CWL and naruon hosts retain tenant authorization, request-size and concurrency
limits, migration routing, encryption and signing, key management, retention,
regional residency, audit, retry, and conflict-resolution policy. No database
object is introduced by this API. Host persistence objects should use at least
two descriptive words and `snake_case` by default.

## Distribution verification

The release gate packs the exact npm artifact, extracts it into an operating-
system temporary `node_modules` tree containing only Inkspan, and executes the
subpath through ESM and CommonJS without installing any framework dependency.
A strict TypeScript consumer compiles against the same extracted package. An
accidental React, TipTap, ProseMirror, or Yjs import therefore fails before
merge. This deliberately tests the subpath's runtime graph more strictly than a
normal package-manager installation, which installs the package-level closure.

## References

- [RFC 8259: JSON](https://www.rfc-editor.org/rfc/rfc8259)
- [RFC 8785: JSON Canonicalization Scheme](https://www.rfc-editor.org/rfc/rfc8785)
- [RFC 9110 §13.1.1: `If-Match`](https://www.rfc-editor.org/rfc/rfc9110#section-13.1.1)
- [W3C Web Cryptography API Recommendation](https://www.w3.org/TR/2017/REC-WebCryptoAPI-20170126/)
- [Node.js package entry points](https://nodejs.org/api/packages.html#package-entry-points)
