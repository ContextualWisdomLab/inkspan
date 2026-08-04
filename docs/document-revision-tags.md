# Document revision tags and optimistic concurrency

Inkspan 0.5.26 provides deterministic SHA-256 revision validators and frozen
revision-envelope evidence for versioned document envelopes. These boundaries
close the client-side portion of optimistic-concurrency workflows without moving
persistence, authorization, or transport ownership into the editor package.

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

Inkspan also applies verified RFC 8785 erratum 7920 and rejects negative zero
before canonical serialization. ECMAScript serializes both `-0` and `0` as `0`;
accepting both would allow distinct pre-canonical values to receive the same
canonical bytes and revision validator.

`CwlEditorHandle.getDocumentEnvelopeRevision()` captures one current editor
revision, canonicalizes it, and returns the same frozen result. Before client
hydration or after editor destruction it resolves to `null`.

## Retain the exact normalized payload that was hashed

Use revision evidence when a server, worker, migration job, queue consumer,
storage adapter, autosave, delayed AI operation, review, compare, merge, fork,
or audit flow needs both the normalized envelope and its validator:

```ts
import {
  createDocumentEnvelopeRevisionEvidence,
  createDocumentEnvelopeRevisionEvidenceBytes,
} from '@contextualwisdomlab/cwl-editor';

const objectEvidence =
  await createDocumentEnvelopeRevisionEvidence(untrustedEnvelopeJson);
const byteEvidence =
  await createDocumentEnvelopeRevisionEvidenceBytes(storedEnvelopeBytes);

await saveDocument({
  envelope: objectEvidence.envelope,
  expectedStrongEntityTag: objectEvidence.revision.strongEntityTag,
});
```

Each function parses its source once, retains the exact deeply frozen normalized
envelope returned by Inkspan's versioned persistence boundary, derives the
revision from that envelope's RFC 8785 canonical UTF-8 bytes, and returns one
frozen `{ envelope, revision }` pair. Valid but noncanonical strict UTF-8 input
is normalized before hashing. Each call performs one digest-provider operation.

Use `CwlEditorHandle.getDocumentEnvelopeRevisionEvidence()` for a current
standalone or provider-neutral collaborative editor. It captures the editor once
and uses the same pairing implementation, preventing a user or Yjs edit from
occurring between independent envelope and revision reads.

The pair is a capture, not proof that the editor or durable record remains
unchanged after the promise resolves. Delayed local application must use
revision-guarded restore, while durable services must evaluate the expected tag
and mutation atomically in the host-owned storage transaction.

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

The stable conformance basis is the W3C Web Cryptography API Recommendation
published in 2017. Web Cryptography Level 2 was still a First Public Working
Draft as of 2026-08-04; Inkspan tracks it as work in progress and does not claim
Level 2 conformance. SHA-256 itself remains specified by the current final
FIPS PUB 180-4 while NIST prepares a future revision.

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

A `CwlEditorDocumentRevisionEvidence` envelope contains the complete
client-controlled document, including text, accepted links, inline image
payloads, alternative text, and extension attributes. Do not write evidence
objects to ordinary logs, metric labels, analytics events, exception messages,
public URLs, or compact revision metadata. Apply the same authorization, tenant
isolation, encryption, redaction, retention, regional-residency, and audit
controls used for persisted documents. Send or store only
`revision.strongEntityTag` where a compact validator is sufficient.

Revision tags can reveal that two tenants or records contain the same document.
Do not expose cross-tenant lookup endpoints, use a revision tag as a public
document identifier, or place full tags in broad telemetry without a documented
need and retention policy. Persist descriptive nonnumeric document, tenant,
user, and revision identifiers as host metadata rather than adding ad hoc fields
to Inkspan's strict envelope.

Inkspan owns strict parsing, normalization, canonicalization, local digest
generation, and revision-envelope pairing. CWL and naruon hosts own document
routes, expected-revision storage, authenticated atomic compare-and-swap,
conflict UX, authorization, tenant isolation, encryption, signatures, audit,
retention, and retry policy.

## References (APA 7th edition)

Bray, T. (2017). *The JavaScript Object Notation (JSON) data interchange format*
(RFC 8259). RFC Editor. https://doi.org/10.17487/RFC8259

Fielding, R., Nottingham, M., & Reschke, J. (2022). *HTTP semantics* (RFC
9110). RFC Editor. https://doi.org/10.17487/RFC9110

National Institute of Standards and Technology. (2015). *Secure Hash Standard
(SHS)* (FIPS PUB 180-4). U.S. Department of Commerce.
https://doi.org/10.6028/NIST.FIPS.180-4

RFC Editor. (2024). *Errata ID 7920 for RFC 8785: Reject negative zero*.
https://www.rfc-editor.org/errata/eid7920

Rundgren, A., Jordan, B., & Erdtman, S. (2020). *JSON Canonicalization Scheme
(JCS)* (RFC 8785). RFC Editor. https://doi.org/10.17487/RFC8785

WHATWG. (n.d.). *Encoding Standard*. Retrieved August 4, 2026, from
https://encoding.spec.whatwg.org/

World Wide Web Consortium. (2017). *Web Cryptography API* (W3C
Recommendation). https://www.w3.org/TR/2017/REC-WebCryptoAPI-20170126/

World Wide Web Consortium. (2025). *Web Cryptography Level 2* (First Public
Working Draft). https://www.w3.org/TR/2025/WD-webcrypto-2-20250422/
