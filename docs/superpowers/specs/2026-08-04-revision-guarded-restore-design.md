# Revision-Guarded Document Restore Design

**Date:** 2026-08-04  
**Target release:** Inkspan 0.5.23

## Objective

Add a provider-neutral, local optimistic-concurrency boundary for asynchronous
autosave, AI, template, and review workflows. A host must be able to restore a
validated versioned document envelope only when the active editor still matches
an expected Inkspan strong revision validator. A stale operation must return a
normal conflict result and must not replace newer standalone or Yjs-backed
content.

This closes the client-side lost-update gap left after Inkspan 0.5.22 introduced
RFC 8785 canonical envelopes and SHA-256 strong revision validators. It does not
replace the server-side atomic compare-and-swap required by RFC 9110 `If-Match`.

## Selected approach

Implement two public asynchronous functions:

```ts
restoreDocumentEnvelopeIfMatch(
  editor,
  expectedStrongEntityTag,
  source,
  limits?,
  digestProvider?,
): Promise<CwlEditorIfMatchRestoreResult>

restoreDocumentEnvelopeBytesIfMatch(
  editor,
  expectedStrongEntityTag,
  source,
  limits?,
  digestProvider?,
): Promise<CwlEditorIfMatchRestoreResult>
```

Expose matching methods on `CwlEditorHandle`, returning `null` before client
hydration or after editor destruction.

The expected validator is the exact quoted value produced by
`CwlEditorDocumentRevision.strongEntityTag`:

```text
"sha256-<64 lowercase hexadecimal characters>"
```

Weak tags, uppercase digests, unquoted values, alternate algorithms, control
characters, and additional syntax fail closed with a redacted
`DocumentEnvelopeRevisionError`.

## Result contract

```ts
export type CwlEditorIfMatchRestoreResult =
  | {
      readonly status: 'restored';
      readonly previousRevision: CwlEditorDocumentRevision;
      readonly envelope: CwlEditorDocumentEnvelope;
    }
  | {
      readonly status: 'conflict';
      readonly currentRevision: CwlEditorDocumentRevision | null;
    };
```

Both variants are shallow-frozen. Nested revision and envelope values are
already detached and frozen by their existing contracts.

A conflict with a non-null revision means a stable current document was hashed
and did not match the expected tag. A null revision means the document changed
while asynchronous hashing was in progress, so Inkspan refuses to report the
captured validator as current. The host may retry from a fresh editor snapshot.

## Atomicity and data flow

1. Validate the expected strong entity tag before reading or hashing document
   content.
2. Capture the immutable ProseMirror `editor.state.doc` reference.
3. Convert that exact node to a resource-bounded versioned envelope and hash its
   RFC 8785 canonical bytes.
4. After the digest promise resolves, compare the active `editor.state.doc`
   reference with the captured reference.
   - If the document changed, return `{ status: 'conflict', currentRevision:
     null }` without parsing or applying the incoming source.
5. Compare the stable current tag with `expectedStrongEntityTag`.
   - If they differ, return a conflict containing the stable current revision.
6. Parse the incoming object/JSON text or strict UTF-8 bytes and reconstruct the
   complete active TipTap/ProseMirror schema without mutating the editor.
7. Apply one `setContent(documentNode, false)` replacement synchronously in the
   same JavaScript continuation and return the restored envelope plus the
   previous revision.

There is no `await` between the final document-identity check and the one editor
mutation. JavaScript cannot interleave another task in that synchronous segment.
Selection-only transactions preserve the ProseMirror document reference and do
not create false document conflicts.

## Component boundaries

- `documentEnvelopeRestore.ts` continues to own envelope parsing, active-schema
  reconstruction, and one-shot replacement. It exposes package-internal prepare
  helpers so conditional restore does not duplicate validation logic.
- `documentEnvelopeIfMatch.ts` owns expected-tag validation, current-document
  capture, asynchronous revision generation, conflict detection, and the public
  result type.
- `useEditorHandle.ts` adds host convenience methods while preserving the shared
  standalone/collaborative handle implementation.
- `types.ts` declares the imperative methods.
- `index.ts` exports the pure APIs and public result type.

No database, network provider, persistence adapter, credential, environment
variable, or naruon-specific runtime dependency is added.

## Error and conflict behavior

- Malformed expected tags throw `DocumentEnvelopeRevisionError` before hashing.
- Digest-provider absence, failure, or invalid output retains the existing typed
  redacted revision errors.
- Envelope resource, UTF-8, duplicate-name, version, and active-schema failures
  retain their existing typed redacted errors and leave the editor unchanged.
- Revision mismatch and document movement during hashing are expected conflict
  outcomes, not exceptions.
- Callback-suppressed restoration mirrors existing atomic envelope restore and
  does not immediately schedule another `onChange`/`onDocumentChange` save.

## Security and ownership

The validator detects equality; it is not an authorization token, tenant ID,
digital signature, or proof of persistence. Inkspan owns canonicalization,
local revision comparison, active-schema validation, and one local editor
mutation. CWL, naruon, and other hosts retain authenticated transport, tenant
isolation, server-side atomic compare-and-swap, persistence, encryption,
signing, audit, retry/backoff, and user-visible conflict resolution.

Collaborative restore mutates the host-owned Yjs document. The host must
explicitly authorize the operation before calling the API. Inkspan does not
create, connect, persist, or destroy a collaboration provider.

## Verification

Tests must demonstrate:

- matching object/JSON and byte envelopes restore exactly once;
- stable mismatches return the current revision and do not inspect or mutate the
  incoming document;
- document changes while the digest is pending return a null-revision conflict
  and never apply stale content;
- selection-only movement does not create a conflict;
- malformed expected tags fail before the digest provider runs;
- digest-provider failures and incoming envelope/schema failures remain redacted
  and atomic;
- imperative standalone and collaborative methods share the same behavior;
- pre-hydration handles resolve to `null` without invoking a provider;
- exact packed ESM, CommonJS, and strict TypeScript consumer surfaces include
  the new APIs;
- repository-wide production statement, branch, function, and line coverage
  remains 100%; Office Python docstring and branch coverage remain 100%.

## Standards and primary documentation

- RFC 8785, JSON Canonicalization Scheme.
- Verified RFC 8785 erratum 7920, negative-zero rejection.
- RFC 9110 §13.1.1, `If-Match` strong comparison and lost-update prevention.
- W3C Web Cryptography API Recommendation, SHA-256 digest operation.
- TipTap v2 `setContent` command and JSON persistence guidance.
- ProseMirror immutable document-node and transaction model.
