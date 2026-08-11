# Atomic document-envelope restore

Inkspan exposes one supported composition boundary for restoring a versioned document envelope into an active TipTap/ProseMirror editor:

```ts
import {
  DocumentEnvelopeRestoreError,
  restoreDocumentEnvelopeBytes,
  validateDocumentEnvelopeBytesForEditor,
} from '@contextualwisdomlab/cwl-editor';

const editor = editorHandle.getEditor();
if (editor && validateDocumentEnvelopeBytesForEditor(editor, storedBytes)) {
  try {
    restoreDocumentEnvelopeBytes(editor, storedBytes);
  } catch (error) {
    if (error instanceof DocumentEnvelopeRestoreError) {
      // An active ProseMirror transaction policy refused or transformed the
      // otherwise valid document. Do not record the operation as restored.
    }
    throw error;
  }
}
```

The equivalent object or JSON-text path uses `validateDocumentEnvelopeForEditor()` and `restoreDocumentEnvelope()`. All helpers and typed errors are exported from the package root for ESM, CommonJS, and strict TypeScript consumers.

## Atomicity contract

Restore performs these operations in order:

1. validate configured byte, text, value-count, string, and nesting ceilings;
2. strictly decode UTF-8 for byte input;
3. reject duplicate JSON object names;
4. validate the Inkspan envelope schema identifier and version;
5. detach and deeply freeze the document JSON;
6. reconstruct and recursively check the complete document against the active ProseMirror schema;
7. construct the same complete replacement on the captured editor state and run ProseMirror transaction filtering/appending as a detached preflight;
8. reject before live dispatch if the preflight refuses or transforms the prepared document;
9. dispatch one TipTap `setContent(..., false)` replacement;
10. verify that the resulting active document is structurally equal to the prepared document; and
11. if a stateful or non-deterministic policy diverges only during live dispatch, restore the captured local ProseMirror state before throwing `DocumentEnvelopeRestoreError`.

Malformed or incompatible input fails before any editor mutation. Deterministic transaction filters and append-transaction transformations are exercised on detached state first, so a known policy rejection or transformation leaves the live editor unchanged. Inkspan's built-in safe-link and inline-image policies therefore reject unsafe replacements without changing the document.

A host-supplied plugin can be stateful, non-deterministic, or perform external side effects while a transaction is dispatched. If such a plugin accepts the detached preflight but transforms the live replacement, Inkspan restores the captured **local ProseMirror editor state** and reports `DocumentEnvelopeRestoreError`. That rollback covers the local document, selection, and ProseMirror plugin-state snapshot represented by the captured editor state; Inkspan cannot retract an external network, telemetry, storage, or other side effect that a host plugin chose to emit during live dispatch. Hosts remain responsible for making those effects transactional or compensating when they install such plugins.

Successful restore suppresses the normal update callback so loading an already-persisted artifact does not immediately enqueue a duplicate autosave. The restore functions return the validated, detached, frozen envelope that was exactly applied. This allows a host to associate the accepted artifact with its own audit, revision, or optimistic-concurrency record without retaining the caller's mutable input object.

## Validation helpers

The validation helpers run envelope parsing, resource checks, and active-schema reconstruction without mutating the editor. They return `false` for malformed, oversized, incompatible, or unsupported input instead of exposing source data through an error message. Use them for file-picker feedback, migration routing, and import previews.

A `true` result means the source can be prepared under the current envelope and ProseMirror schema. It is not a promise that every active transaction policy will accept the later replacement: validation intentionally does not dispatch or preflight host transaction plugins. Restore remains the authoritative application gate and can still raise `DocumentEnvelopeRestoreError`. UI enablement based on a validation helper must therefore preserve a visible restore-error path rather than assuming the subsequent command cannot fail.

Restore functions preserve typed failure categories:

- `DocumentEnvelopeError` for malformed, oversized, duplicate-name, encoding, schema-ID, or version failures;
- `DocumentSchemaError` when the envelope is valid but its document tree is incompatible with the active extension schema;
- `DocumentEnvelopeRestoreError` when an active ProseMirror policy refuses or transforms the prepared replacement.

These errors contain no document text, URLs, inline image payloads, tenant identifiers, or source JSON.

## Collaboration and authorization

Calling a restore helper with the editor instance owned by `CollaborativeCwlEditor` changes the host-owned Yjs document. Inkspan does not decide whether the caller may overwrite shared state. CWL and naruon hosts must authorize the document, tenant, user, revision, and operation before invoking restore and should use their own confirmation, audit, revision, and conflict policy.

For optimistic concurrency, use Inkspan's strong document revision and revision-guarded restore APIs locally, and enforce authenticated RFC 9110 `If-Match` atomically in the durable persistence transaction. Canonical bytes and equality validators do not grant write permission or replace tenant authorization.

## Migration boundary

The current parser intentionally rejects unknown envelope versions. Hosts must route older artifacts through an explicit, reviewed migration before restore. A migration should produce a current envelope, then pass that result through the same restore helper so the active schema and editor policies remain the final acceptance gates.

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

- [TipTap v2 `setContent` command](https://v2.tiptap.dev/docs/editor/api/commands/content/set-content)
- [ProseMirror `EditorState.applyTransaction()`](https://prosemirror.net/docs/ref/#state.EditorState.applyTransaction)
- [ProseMirror `PluginSpec.filterTransaction`](https://prosemirror.net/docs/ref/#state.PluginSpec.filterTransaction)
- [ProseMirror `PluginSpec.appendTransaction`](https://prosemirror.net/docs/ref/#state.PluginSpec.appendTransaction)
- [ProseMirror `Schema.nodeFromJSON()` and `Node.check()`](https://prosemirror.net/docs/ref/#model.Schema.nodeFromJSON)
- [RFC 8259: The JavaScript Object Notation (JSON) Data Interchange Format](https://www.rfc-editor.org/rfc/rfc8259)
- [RFC 7493: The I-JSON Message Format](https://www.rfc-editor.org/rfc/rfc7493)
- [RFC 8785: JSON Canonicalization Scheme](https://www.rfc-editor.org/rfc/rfc8785)
- [RFC 9110 §13.1.1: `If-Match`](https://www.rfc-editor.org/rfc/rfc9110#section-13.1.1)
- [WHATWG Encoding Standard: UTF-8](https://encoding.spec.whatwg.org/#utf-8)
