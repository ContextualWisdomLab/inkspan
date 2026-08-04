# Revision-Guarded Document Restore Implementation Record

**Date:** 2026-08-04  
**Release candidate:** Inkspan 0.5.23  
**Design:** `2026-08-04-revision-guarded-restore-design.md`

## Implemented public contract

The release candidate provides two provider-neutral pure functions:

- `restoreDocumentEnvelopeIfMatch()` for an object or JSON-text envelope;
- `restoreDocumentEnvelopeBytesIfMatch()` for strict UTF-8 envelope bytes.

Both accept the active TipTap editor, an exact Inkspan SHA-256 strong entity
tag, an untrusted source, optional `DocumentEnvelopeLimits`, and an optional
`DocumentEnvelopeDigestProvider`. The same operations are available through the
shared standalone and collaborative `CwlEditorHandle`.

Before hydration or after editor destruction, the handle methods resolve to
`null` without reading the source or invoking the provider.

## Concurrency behavior

The implementation validates the expected tag before reading editor content,
captures the immutable ProseMirror document node, derives and hashes that exact
versioned envelope, and checks document identity again after the asynchronous
digest.

- A document change during hashing returns a frozen conflict with
  `currentRevision: null` and does not inspect the incoming source.
- A stable tag mismatch returns a frozen conflict with the stable current
  revision and does not inspect the incoming source.
- A stable match runs the existing envelope parser, resource controls, migration
  gate, hostile-value detachment, and complete active-schema reconstruction.
  It then performs one callback-suppressed `setContent(..., false)` operation
  without another asynchronous boundary.
- A selection-only transaction preserves the ProseMirror document reference and
  does not create a false document conflict.

## Validation and security behavior

Expected validators must exactly match:

```text
"sha256-<64 lowercase hexadecimal characters>"
```

The implementation rejects weak tags, uppercase digests, unquoted values,
alternate algorithms, incorrect length, control characters, line terminators,
and appended syntax before hashing. Existing redacted typed failures remain in
force for unavailable or invalid digest providers, malformed envelopes,
duplicate object names, resource-limit violations, unsupported versions, and
active-schema incompatibility.

A local match is not authorization, a signature, tenant membership, or proof of
durable persistence. CWL, naruon, and other hosts retain authenticated transport,
server-side atomic RFC 9110 `If-Match`, persistence, tenant isolation,
encryption, audit, retry policy, and user-visible conflict resolution.
Collaborative restore requires explicit host authorization because a successful
operation changes the host-owned Yjs document.

## Package and documentation integration

The root package exports both pure functions and the frozen
`CwlEditorIfMatchRestoreResult` union. Packed ESM, CommonJS, and strict
TypeScript consumer checks exercise the public surface. The package metadata,
README, imperative persistence guide, dedicated revision-guarded restore guide,
and CHANGELOG identify the 0.5.23 contract.

Temporary branch-only finalization workflows have been removed. The canonical
repository CI workflow is restored, so the exact current head is evaluated by
the normal TypeScript, package, demo, Office Python, SAST, Security Scan, and
review gates.

## Exact-head acceptance gates

The pull request may become ready and merge only when its exact current head
satisfies all of the following:

1. TypeScript typecheck succeeds.
2. Production statement, branch, function, and line coverage are all 100%.
3. Library, collaboration, converter, packed ESM/CommonJS, strict declarations,
   and demo builds succeed.
4. Office Python 3.11 and 3.14 tests, dependency consistency, wheel inspection,
   100% statement/branch coverage, and shipped-symbol docstring coverage pass.
5. SAST Semgrep and the repository Security Scan succeed.
6. CodeRabbit and any human review contain no unresolved actionable finding.
7. No temporary workflow, unrelated dependency drift, transport coupling,
   persistence adapter, credential, environment-variable access, database
   object, or naruon-specific runtime dependency remains in the diff.
8. Merge uses an exact expected-head guard and is followed by a fresh open-PR
   inventory.
