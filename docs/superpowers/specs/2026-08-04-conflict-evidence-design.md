# Atomic Conflict Evidence Design

**Date:** 2026-08-04  
**Target release:** Inkspan 0.5.24

## Objective

Close the conflict-resolution race left after Inkspan 0.5.23 introduced revision-guarded document restore. A stable revision mismatch currently returns the active SHA-256 revision but not the exact document envelope from which that revision was computed. A host that calls `getDocumentEnvelope()` afterward can observe a later edit, producing an envelope that does not match the returned revision and cannot be trusted for compare, merge, fork, audit, or retry UI.

Inkspan will return the already-captured, deeply frozen envelope beside its matching revision. Successful restore will likewise return the exact previous envelope beside `previousRevision`. No additional document clone, canonicalization, digest, provider, network, database, or persistence dependency is introduced.

## Selected approach

Extend the existing additive result contract while preserving every 0.5.23 field:

```ts
export type CwlEditorIfMatchRestoreResult =
  | {
      readonly status: 'restored';
      readonly previousRevision: CwlEditorDocumentRevision;
      readonly previousEnvelope: CwlEditorDocumentEnvelope;
      readonly envelope: CwlEditorDocumentEnvelope;
    }
  | {
      readonly status: 'conflict';
      readonly currentRevision: CwlEditorDocumentRevision | null;
      readonly currentEnvelope: CwlEditorDocumentEnvelope | null;
    };
```

The existing `status`, `previousRevision`, `envelope`, and `currentRevision` properties remain unchanged. Consumers that structurally inspect the result receive new evidence without changing invocation signatures. The pure object/JSON and strict UTF-8 functions plus the shared standalone/collaborative imperative handle all inherit the enriched result.

## Alternatives considered

### Nested version object

A cleaner normalized shape would return `previous: { revision, envelope }` or `current: { revision, envelope }`. It was rejected because replacing the existing top-level fields would create needless consumer migration during the 0.x integration cycle.

### Separate conflict snapshot function

A second function could read the editor after a conflict. It was rejected because the second read recreates the exact time-of-check/time-of-use race this feature must eliminate.

### Canonical JSON or bytes in the result

Returning serialized payloads was rejected. Hosts can derive canonical JSON or bytes from the frozen envelope when needed; eagerly serializing would add CPU and allocation cost to every guarded restore.

## Data flow

1. Validate the expected Inkspan strong entity tag.
2. Reject an already destroyed editor with a null-evidence conflict.
3. Capture the immutable current ProseMirror document reference.
4. Create one detached, deeply frozen `currentEnvelope` from that exact node.
5. Derive `currentRevision` from that same envelope.
6. If the editor moved or was destroyed during hashing, return `currentRevision: null` and `currentEnvelope: null`.
7. If the stable revision mismatches, return both `currentRevision` and `currentEnvelope` without inspecting the incoming source.
8. On a stable match, prepare the incoming envelope and recheck editor identity and lifecycle.
9. If the editor moved during preparation, return null evidence.
10. Apply the prepared document through the existing verified editor-policy boundary.
11. Return `previousRevision`, `previousEnvelope: currentEnvelope`, and the applied incoming `envelope`.

The revision and evidence envelope therefore always describe the same captured document. A non-null revision must never be paired with a null or unrelated envelope.

## Error and conflict behavior

- Invalid expected tags, digest failures, malformed envelopes, resource-limit violations, unsupported versions, active-schema incompatibility, and editor-policy rejection retain their existing typed, redacted exceptions.
- Stable revision mismatch is a normal conflict containing non-null matching revision and envelope evidence.
- Document movement, source-reflection reentrancy, or editor destruction produces a normal conflict with both evidence fields set to `null`.
- The incoming source is not inspected on either mismatch class.
- Result objects remain shallow-frozen. Revision objects and envelope objects retain their existing frozen contracts.

## Security and privacy

A conflict envelope contains the full client-controlled document body, including text, safe hyperlinks, inline image payloads, alternative text, and extension attributes. It is not a telemetry-safe summary. Inkspan will document that hosts must apply authorization, tenant isolation, encryption, retention, redaction, and logging minimization before storing or transmitting conflict evidence.

The envelope is evidence of one local editor observation. It is not a signature, authorization token, durable transaction result, tenant identifier, or substitute for authenticated server-side RFC 9110 `If-Match` compare-and-swap.

## Performance

The current implementation already allocates and freezes `currentEnvelope` before hashing. Returning the same object adds only one result-property reference. No second document traversal, clone, canonical serialization, SHA-256 digest, or ProseMirror reconstruction is permitted.

## Public documentation

Update the dedicated revision-guarded restore guide, imperative persistence guide, README, package consumer verification, package description, and CHANGELOG. Examples must show that non-null revision and envelope evidence are an inseparable pair and that null evidence requires a fresh snapshot before retry.

## Verification

Tests must demonstrate:

- matching object and byte restores return the exact frozen previous envelope paired with `previousRevision`;
- stable mismatch returns the exact frozen current envelope paired with `currentRevision` and does not inspect a hostile source;
- document movement during hashing returns both evidence fields as null;
- document movement during source preparation returns both evidence fields as null;
- editor destruction before or during hashing returns both evidence fields as null;
- standalone and collaborative imperative handles expose the same enriched contract;
- strict packed TypeScript consumers compile the additive fields;
- packed ESM and CommonJS exports remain valid;
- repository-wide production statement, branch, function, and line coverage remains 100%;
- Office Python 3.11 and 3.14 branch and docstring gates remain 100%;
- SAST, Security Scan, CodeRabbit, and unresolved-review-thread gates pass on the exact PR head.

## Standards and primary documentation

- RFC 8785, JSON Canonicalization Scheme.
- RFC 9110 §13.1.1, `If-Match` strong comparison and lost-update prevention.
- W3C Web Cryptography API Recommendation, SHA-256 digest operation.
- TipTap v2 JSON persistence and `setContent` documentation.
- ProseMirror immutable document-node and transaction model.
