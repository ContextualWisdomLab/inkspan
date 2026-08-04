# Document revision tags and optimistic concurrency

Inkspan 0.5.22 adds deterministic SHA-256 revision validators for versioned
document envelopes. The validator closes the client-side portion of an
optimistic-concurrency workflow without moving persistence, authorization, or
transport ownership into the editor package.

## Create a revision validator

```ts
import {
  createDocumentEnvelopeRevision,
  createDocumentEnvelopeRevisionBytes,
} from '@contextualwisdomlab/cwl-editor';

const objectRevision = await createDocumentEnvelopeRevision(envelope);
const byteRevision = await createDocumentEnvelopeRevisionBytes(storedBytes);

console.log(objectRevision.digestHex);
console.log(objectRevision.strongEntityTag);
```

Both functions parse through the normal fail-closed envelope boundary and hash
the RFC 8785 canonical UTF-8 representation. Object-property ordering and
insignificant JSON whitespace therefore do not change the revision. A changed
schema identifier, schema version, node, mark, attribute, or text value does.

`CwlEditorHandle.getDocumentEnvelopeRevision()` captures one current editor
revision, canonicalizes it, and returns the same frozen result. Before client
hydration or after editor destruction it resolves to `null`.

## HTTP lost-update protection

A host may return `strongEntityTag` as the `ETag` for the exact canonical
envelope representation and require it in `If-Match` for a later state-changing
request. RFC 9110 requires strong comparison for `If-Match` and requires the
origin server not to perform the method when the precondition is false.

```http
ETag: "sha256-8e..."

PUT /documents/customer_proposal
If-Match: "sha256-8e..."
Content-Type: application/json
```

The server must answer `412 Precondition Failed` when its current strong
validator differs. It must not treat the client-provided tag as proof of
identity, permission, tenant membership, or successful prior persistence.

A server that stores, compresses, signs, encrypts, wraps, or otherwise transforms
the canonical envelope is responsible for deciding whether the resulting HTTP
representation still has the same entity tag. When the response bytes are not
the canonical envelope bytes, issue a server-owned validator instead.

## Digest provider

The default implementation uses the platform Web Cryptography
`SubtleCrypto.digest('SHA-256', ...)` operation. Hosts running in an environment
without Web Cryptography can inject a compatible `DocumentEnvelopeDigestProvider`.
Inkspan never falls back to SHA-1, a non-cryptographic checksum, or an implicit
provider.

The complete canonical byte sequence is materialized before hashing because the
Web Cryptography digest operation is not streaming. Existing
`DocumentEnvelopeLimits` should therefore be selected conservatively for the
browser, worker, desktop, or server runtime that performs the operation.

A provider receives a `BufferSource`, not an Inkspan-specific byte class. Browser
iframes, workers, test realms, and server runtimes can expose typed arrays with
different prototype identities even when their bytes are identical. Provider
adapters and integration tests should compare or copy the addressed byte range
(`buffer`, `byteOffset`, and `byteLength`) rather than requiring constructor or
prototype identity. The provider must treat the supplied bytes as read-only and
must not retain them beyond the digest operation unless the host explicitly owns
that additional copy and its retention policy.

## Security, privacy, and audit boundaries

A SHA-256 digest detects equality with extremely high confidence, but it is not
a digital signature, message authentication code, encryption mechanism, or
authorization decision. A party able to replace both document and digest can
replace both consistently. Use authenticated transport and server-side access
control, and use signatures or MACs when authenticity is required.

Revision tags can reveal that two tenants or records contain the same document.
Do not expose cross-tenant lookup endpoints, use a revision tag as a public
document identifier, or place full tags in broad telemetry without a documented
need and retention policy. Persist descriptive nonnumeric document, tenant,
user, and revision identifiers as host metadata rather than adding ad hoc fields
to Inkspan's strict envelope.

Inkspan owns canonicalization and local digest generation. CWL and naruon hosts
own document routes, expected-revision storage, atomic compare-and-swap,
conflict UX, authorization, tenant isolation, encryption, signatures, audit,
retention, and retry policy.

## Primary references

- [RFC 8785: JSON Canonicalization Scheme](https://www.rfc-editor.org/rfc/rfc8785)
- [RFC 9110 §13.1.1: `If-Match`](https://www.rfc-editor.org/rfc/rfc9110#section-13.1.1)
- [W3C Web Cryptography Level 2: SHA digest](https://www.w3.org/TR/webcrypto-2/#sha-operations)
- [FIPS PUB 180-4: Secure Hash Standard](https://csrc.nist.gov/pubs/fips/180-4/upd1/final)
