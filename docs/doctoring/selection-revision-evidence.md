# Doctoring record: revision-scoped selection evidence

- **Status:** Accepted
- **Decision date:** 2026-08-08
- **Scope:** Local Inkspan editor-state selection and local document-revision evidence
- **Runtime change:** Adds one imperative read-only capture method; no transport, persistence, authorization, or collaboration provider is added

## Problem

Inkspan already exposes local ProseMirror selection coordinates and can capture a frozen document envelope with a matching SHA-256 revision. Those surfaces solve different problems when used separately. A host that starts an asynchronous review, annotation, or AI operation can read a selection and then hash the document in a second operation. If the editor changes between those reads, the host can accidentally pair selection coordinates from one document state with a revision from another.

That race is especially undesirable for enterprise review workflows because raw ProseMirror positions are meaningful only inside the document structure that produced them. Persisting only `from` and `to` creates weak provenance, while copying selected text into every event or audit record increases privacy and retention exposure.

## Decision

`CwlEditorHandle.getSelectionRevisionEvidence()` captures exactly one immutable ProseMirror `EditorState` before asynchronous digest work begins. From that same state it:

1. snapshots `anchor`, `head`, `from`, `to`, and `empty`;
2. creates and validates the versioned Inkspan document envelope from `state.doc`;
3. derives the existing canonical SHA-256 document revision; and
4. returns one frozen object containing only the frozen selection coordinates and frozen revision metadata.

The method returns `null` before an editor exists. It performs no network request and does not create transport, storage, authentication, authorization, tenant, retention, model, or database responsibility.

## Atomicity and concurrency boundary

ProseMirror editor states are immutable values. Capturing `editor.state` once gives Inkspan a stable document tree and selection even if a later transaction replaces the editor's current state while hashing is still pending. Inkspan therefore does not reread `editor.state`, `editor.getJSON()`, or the live selection after the asynchronous digest begins.

The returned revision is local equality evidence for the exact document that contained the selection. It is not a server-selected entity tag and does not prove that a durable document exists at that revision. A host that sends a delayed result to storage must still use authenticated, atomic concurrency such as a server-selected strong validator with RFC 9110 conditional-request semantics.

## Selection-coordinate boundary

ProseMirror `anchor` and `head` are document positions in one ProseMirror state; `from` and `to` are the ordered bounds of that selection. They are not DOM offsets, Markdown character indexes, HTML byte offsets, or normalized Unicode text indexes.

In particular, Inkspan does **not** label these coordinates as W3C `TextPositionSelector` values. The Web Annotation Data Model defines `TextPositionSelector` positions over Unicode code points in a normalized textual representation. A ProseMirror structural position has different semantics. Conflating them would produce an interoperability claim that the implementation does not satisfy.

A stored Inkspan selection must therefore be used only after confirming the exact document revision. If the document has changed, the host owns compare, merge, fork, collaborative relative-position handling, and **host-owned re-anchoring**. A future W3C Web Annotation adapter would need a separately specified deterministic text projection, selector conversion, state/provenance contract, and migration tests.

## Privacy and audit boundary

The evidence object deliberately contains no document envelope, document JSON, selected text, surrounding quote, link destination, image payload, actor, tenant, timestamp, authorization decision, signature, model identity, transport result, or durable-write claim. This keeps ordinary review-target metadata materially smaller than a full document capture and avoids turning a convenience API into a content-logging path.

The digest and positions can still be tenant-confidential metadata. Hosts must classify, authorize, retain, and redact them under their own policy. A revision digest is not a bearer credential or public document identifier, and coordinates are not proof of user intent or operation acceptance.

The W3C model's quote-based selectors can include the exact selected text and optional surrounding context. Those selectors are useful for interoperability and re-anchoring, but their content-bearing nature creates a different privacy boundary. Inkspan does not silently emit them from this method.

## Host responsibilities

Hosts remain responsible for:

- document and operation authorization;
- tenant isolation and credential handling;
- durable document, annotation, and comment identifiers;
- server-selected validators and atomic persistence;
- comment bodies, selected-content capture, classification, encryption, retention, and redaction;
- timestamps, actor attribution, signatures, audit storage, and acceptance claims;
- model-use policy and prompt/output handling;
- collaborative relative-position or other durable anchoring schemes; and
- conflict UX and host-owned re-anchoring when a document revision changes.

Inkspan remains responsible only for deterministic editor/conversion state and this local revision-scoped capture primitive.

## Failure and security behavior

Envelope resource limits and SHA-256 provider validation retain the existing fail-closed behavior. Invalid document-envelope state or invalid digest-provider output fails the capture rather than returning partially paired evidence. No evidence object is returned before the revision is successfully derived.

The method does not serialize selected content or invoke callbacks during hashing. Later document or selection changes do not mutate the frozen evidence already being computed. The evidence must not be used as an authorization check, audit identity, signature, or durable commit assertion.

## Verification

The test-first RED head `6735ec3ccf15b9d4318498c6bf2af6bae22fbb0f` failed TypeScript compilation because `getSelectionRevisionEvidence` did not yet exist. That failure is ordering evidence only.

Permanent deterministic tests verify:

- range and caret capture;
- one pre-hash document state surviving later document and selection changes;
- revision parity with the existing canonical document-revision implementation;
- frozen top-level, revision, and selection objects;
- absence of the document envelope and fixture text from returned evidence;
- `null` before editor creation; and
- documentation of coordinate, privacy, durability, re-anchoring, and standards boundaries.

Repository acceptance still requires the normal exact-head TypeScript, 100% statement/branch/function/line coverage, packed-package, SSR, Office, security, Semgrep, review, and branch-protection gates.

## Rollback

Rollback removes `getSelectionRevisionEvidence`, its public evidence type, focused tests, and documentation without changing existing selection callbacks, revision evidence, envelope persistence, autosave, collaboration, or serialization contracts. Hosts can continue using `onSelectionChange` and `getDocumentEnvelopeRevisionEvidence()` independently, but they then own synchronization between the two reads.

No stored Inkspan document schema or database migration is introduced, so rollback requires no content migration.

## References

Fielding, R., Nottingham, M., & Reschke, J. (2022). *HTTP semantics* (RFC 9110). RFC Editor. https://doi.org/10.17487/RFC9110

Haverbeke, M. (n.d.). *ProseMirror reference manual*. Retrieved August 8, 2026, from https://prosemirror.net/docs/ref/

World Wide Web Consortium, Web Annotation Working Group. (2017, February 23). *Web Annotation Data Model* (W3C Recommendation). https://www.w3.org/TR/annotation-model/
