# Atomic document-envelope restore

Inkspan exposes one supported composition boundary for restoring a versioned document envelope into an active TipTap/ProseMirror editor:

```ts
import {
  restoreDocumentEnvelopeBytes,
  validateDocumentEnvelopeBytesForEditor,
} from '@contextualwisdomlab/cwl-editor';

const editor = editorHandle.getEditor();
if (editor && validateDocumentEnvelopeBytesForEditor(editor, storedBytes)) {
  restoreDocumentEnvelopeBytes(editor, storedBytes);
}
```

The equivalent object or JSON-text path uses `validateDocumentEnvelopeForEditor()` and `restoreDocumentEnvelope()`. All four helpers are exported from the package root for ESM, CommonJS, and strict TypeScript consumers.

## Atomicity contract

Restore performs these operations in order:

1. validate configured byte, text, value-count, string, and nesting ceilings;
2. strictly decode UTF-8 for byte input;
3. reject duplicate JSON object names;
4. validate the Inkspan envelope schema identifier and version;
5. detach and deeply freeze the document JSON;
6. reconstruct and recursively check the complete document against the active ProseMirror schema;
7. replace the editor document once.

Any failure before step 7 leaves the current document unchanged. Successful restore uses TipTap's loading form of `setContent(..., false)`, so the operation does not immediately emit the normal update callback and enqueue a duplicate autosave.

The restore functions return the validated, detached, frozen envelope that was applied. This allows a host to associate the exact accepted artifact with its own audit, revision, or optimistic-concurrency record without retaining the caller's mutable input object.

## Validation helpers

The validation helpers run the same parsing and active-schema checks without mutating the editor. They return `false` for malformed, oversized, incompatible, or unsupported input instead of exposing source data through an error message. Use them for file-picker feedback, migration routing, import previews, and disabled/enabled UI state.

Preflight is advisory rather than an authorization token: restore repeats the complete validation path against the supplied artifact immediately before mutation.

Restore functions preserve typed failure categories:

- `DocumentEnvelopeError` for malformed, oversized, duplicate-name, encoding, schema-ID, or version failures;
- `DocumentSchemaError` when the envelope is valid but its document tree is incompatible with the active extension schema.

Neither error includes document text, URLs, inline image payloads, tenant identifiers, or source JSON.

## Collaboration and authorization

Calling a restore helper with the editor instance owned by `CollaborativeCwlEditor` changes the host-owned Yjs document. Inkspan does not decide whether the caller may overwrite shared state. CWL and naruon hosts must authorize the document, tenant, user, revision, and operation before invoking restore and should use their own confirmation, audit, revision, and conflict policy.

For optimistic concurrency, compare a host-owned revision or hash derived from `encodeDocumentEnvelope()` before authorization. Canonical bytes provide a deterministic comparison input but do not grant write permission or replace an authenticated revision token.

## Migration boundary

The current parser intentionally rejects unknown envelope versions. Hosts must route older artifacts through an explicit, reviewed migration before restore. A migration should produce a current envelope, then pass that result through the same restore helper so the active schema remains the final acceptance gate.

Do not silently discard unknown nodes or marks during migration. Preserve the original artifact for audit and make lossy transformations explicit to the user or workflow owner.

## Resource and transport ownership

Inkspan bounds direct parser work, but the host still owns controls outside the JavaScript library boundary:

- compressed and decompressed request-size limits;
- upload and network timeouts;
- rate and concurrency limits;
- object-store and database authorization;
- tenant isolation and descriptive nonnumeric document identifiers;
- encryption, signing, key management, retention, and deletion;
- migration registry and rollback policy;
- telemetry minimization and redaction.

The helper adds no database, credential, environment-variable, transport, provider, or naruon-specific runtime dependency and remains suitable as a standalone module or a CWL/naruon MSA component.

## Primary references

- TipTap `setContent` command and update-event behavior
- ProseMirror `Schema.nodeFromJSON()` and `Node.check()`
- RFC 8259, *The JavaScript Object Notation (JSON) Data Interchange Format*
- RFC 7493, *The I-JSON Message Format*
- RFC 8785, *JSON Canonicalization Scheme (JCS)*
- WHATWG Encoding Standard, fatal UTF-8 decoding
