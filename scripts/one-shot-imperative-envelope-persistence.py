"""Apply and verify the one-shot imperative envelope persistence product slice."""

from pathlib import Path
import json


def replace_once(text: str, old: str, new: str) -> str:
    """Replace one required marker and fail closed when the branch drifted."""
    if text.count(old) != 1:
        raise RuntimeError(f"expected one marker, found {text.count(old)}")
    return text.replace(old, new, 1)


types_path = Path("src/types.ts")
types_text = types_path.read_text()
types_text = replace_once(
    types_text,
    "import type { JSONContent } from '@tiptap/core';\nimport type { Editor } from '@tiptap/react';\n",
    """import type { JSONContent } from '@tiptap/core';
import type { Editor } from '@tiptap/react';
import type {
  CwlEditorDocumentEnvelope,
  DocumentEnvelopeLimits,
} from './documentEnvelope.js';
""",
)
types_text = replace_once(
    types_text,
    """  getSnapshot(): CwlEditorDocumentSnapshot;
  /** Replace the whole document from a string in the active `mode`. */
""",
    """  getSnapshot(): CwlEditorDocumentSnapshot;
  /**
   * Create a detached, deeply frozen versioned envelope from the current
   * editor revision. Returns `null` before editor creation.
   */
  getDocumentEnvelope(
    limits?: DocumentEnvelopeLimits,
  ): CwlEditorDocumentEnvelope | null;
  /**
   * Serialize the current editor revision as canonical RFC 8785 envelope JSON.
   * Returns an empty string before editor creation.
   */
  getDocumentEnvelopeJson(limits?: DocumentEnvelopeLimits): string;
  /**
   * Encode the current editor revision as canonical UTF-8 envelope bytes.
   * Returns an empty byte array before editor creation.
   */
  getDocumentEnvelopeBytes(limits?: DocumentEnvelopeLimits): Uint8Array;
  /** Replace the whole document from a string in the active `mode`. */
""",
)
types_text = replace_once(
    types_text,
    """  setValue(value: string): void;
  /**
   * Check whether JSON can be restored by the active TipTap/ProseMirror schema
""",
    """  setValue(value: string): void;
  /**
   * Check whether an object or JSON-text envelope can be restored atomically by
   * the active editor. Returns `false` before editor creation.
   */
  validateDocumentEnvelope(
    source: unknown,
    limits?: DocumentEnvelopeLimits,
  ): boolean;
  /**
   * Check whether strict UTF-8 envelope bytes can be restored atomically by the
   * active editor. Returns `false` before editor creation.
   */
  validateDocumentEnvelopeBytes(
    source: unknown,
    limits?: DocumentEnvelopeLimits,
  ): boolean;
  /**
   * Atomically restore an object or JSON-text envelope after resource and
   * active-schema validation. Returns `null` before editor creation.
   */
  restoreDocumentEnvelope(
    source: unknown,
    limits?: DocumentEnvelopeLimits,
  ): CwlEditorDocumentEnvelope | null;
  /**
   * Atomically restore strict UTF-8 envelope bytes after resource and
   * active-schema validation. Returns `null` before editor creation.
   */
  restoreDocumentEnvelopeBytes(
    source: unknown,
    limits?: DocumentEnvelopeLimits,
  ): CwlEditorDocumentEnvelope | null;
  /**
   * Check whether JSON can be restored by the active TipTap/ProseMirror schema
""",
)
types_path.write_text(types_text)

handle_path = Path("src/components/useEditorHandle.ts")
handle_text = handle_path.read_text()
handle_text = replace_once(
    handle_text,
    """import {
  parseDocumentJsonForEditor,
  validateDocumentJson,
} from '../documentSchema.js';
import type { CwlEditorHandle, EditorMode } from '../types.js';
""",
    """import {
  createDocumentEnvelope,
  type CwlEditorDocumentEnvelope,
  type DocumentEnvelopeLimits,
} from '../documentEnvelope.js';
import {
  encodeDocumentEnvelope,
  serializeDocumentEnvelope,
} from '../documentEnvelopeCanonical.js';
import {
  restoreDocumentEnvelope,
  restoreDocumentEnvelopeBytes,
  validateDocumentEnvelopeBytesForEditor,
  validateDocumentEnvelopeForEditor,
} from '../documentEnvelopeRestore.js';
import {
  parseDocumentJsonForEditor,
  validateDocumentJson,
} from '../documentSchema.js';
import type { CwlEditorHandle, EditorMode } from '../types.js';
""",
)
handle_text = replace_once(
    handle_text,
    """import { editorHtmlToValue, editorValueToHtml } from './editorSerialization.js';

/** Expose the stable host-control contract shared by editor surfaces. */
""",
    """import { editorHtmlToValue, editorValueToHtml } from './editorSerialization.js';

/** Create a validated portable envelope from one active editor revision. */
function createCurrentDocumentEnvelope(
  editor: Editor,
  limits?: DocumentEnvelopeLimits,
): CwlEditorDocumentEnvelope {
  return createDocumentEnvelope(editor.getJSON(), limits);
}

/** Expose the stable host-control contract shared by editor surfaces. */
""",
)
handle_text = replace_once(
    handle_text,
    """      getSnapshot: () =>
        createEditorDocumentSnapshot(editor, modeRef.current),
      setValue: (next: string) => {
""",
    """      getSnapshot: () =>
        createEditorDocumentSnapshot(editor, modeRef.current),
      getDocumentEnvelope: (limits) =>
        editor ? createCurrentDocumentEnvelope(editor, limits) : null,
      getDocumentEnvelopeJson: (limits) =>
        editor
          ? serializeDocumentEnvelope(
              createCurrentDocumentEnvelope(editor, limits),
            )
          : '',
      getDocumentEnvelopeBytes: (limits) =>
        editor
          ? encodeDocumentEnvelope(
              createCurrentDocumentEnvelope(editor, limits),
            )
          : new Uint8Array(),
      setValue: (next: string) => {
""",
)
handle_text = replace_once(
    handle_text,
    """      setValue: (next: string) => {
        if (!editor) return;
        editor.commands.setContent(
          editorValueToHtml(next, modeRef.current),
          false,
        );
      },
      validateDocumentJson: (documentJson) =>
""",
    """      setValue: (next: string) => {
        if (!editor) return;
        editor.commands.setContent(
          editorValueToHtml(next, modeRef.current),
          false,
        );
      },
      validateDocumentEnvelope: (source, limits) =>
        editor
          ? validateDocumentEnvelopeForEditor(editor, source, limits)
          : false,
      validateDocumentEnvelopeBytes: (source, limits) =>
        editor
          ? validateDocumentEnvelopeBytesForEditor(editor, source, limits)
          : false,
      restoreDocumentEnvelope: (source, limits) =>
        editor ? restoreDocumentEnvelope(editor, source, limits) : null,
      restoreDocumentEnvelopeBytes: (source, limits) =>
        editor ? restoreDocumentEnvelopeBytes(editor, source, limits) : null,
      validateDocumentJson: (documentJson) =>
""",
)
handle_path.write_text(handle_text)

empty_test_path = Path("src/components/useEditorHandle.test.tsx")
empty_test = empty_test_path.read_text()
empty_test = replace_once(
    empty_test,
    """    expect(Object.isFrozen(handle.getSnapshot())).toBe(true);
    expect(() => handle.setValue('ignored')).not.toThrow();
""",
    """    expect(Object.isFrozen(handle.getSnapshot())).toBe(true);
    expect(handle.getDocumentEnvelope()).toBeNull();
    expect(handle.getDocumentEnvelopeJson()).toBe('');
    expect(handle.getDocumentEnvelopeBytes()).toEqual(new Uint8Array());
    expect(handle.validateDocumentEnvelope({})).toBe(false);
    expect(handle.validateDocumentEnvelopeBytes(new Uint8Array())).toBe(false);
    expect(handle.restoreDocumentEnvelope({})).toBeNull();
    expect(handle.restoreDocumentEnvelopeBytes(new Uint8Array())).toBeNull();
    expect(() => handle.setValue('ignored')).not.toThrow();
""",
)
empty_test_path.write_text(empty_test)

package_path = Path("package.json")
package_data = json.loads(package_path.read_text())
if package_data["version"] != "0.5.20":
    raise RuntimeError("unexpected package version")
package_data["version"] = "0.5.21"
package_data["description"] = (
    "Inkspan — commercial-grade Markdown + HTML WYSIWYG editor module "
    "(TipTap/ProseMirror, MIT) with SSR-safe client hydration, native form "
    "integration, lossless document snapshots, preparse-resource-bounded "
    "duplicate-name-safe versioned persistence envelopes, canonical JSON plus "
    "strict UTF-8 byte round trips, one-call imperative envelope export and "
    "atomic active-schema restore, host-owned lifecycle callbacks, strict link "
    "and image policies, accessible editing controls, provider-neutral Yjs "
    "collaboration, a standalone base64 converter, and bundled offline "
    "multilingual Noto Sans fonts."
)
package_path.write_text(json.dumps(package_data, indent=2, ensure_ascii=False) + "\n")

changelog_path = Path("CHANGELOG.md")
changelog = changelog_path.read_text()
entry = """## [Unreleased]

## [0.5.21] — 2026-08-04

### Added
- `CwlEditorHandle.getDocumentEnvelope()`, `getDocumentEnvelopeJson()`, and `getDocumentEnvelopeBytes()` for one-call lossless export from the current active editor revision
- `CwlEditorHandle.validateDocumentEnvelope()`, `validateDocumentEnvelopeBytes()`, `restoreDocumentEnvelope()`, and `restoreDocumentEnvelopeBytes()` for host-friendly non-mutating preflight and atomic import

### Changed
- Package version **0.5.21**
- Standalone and provider-neutral collaborative editor refs now expose the complete object, canonical JSON, and strict UTF-8 persistence round trip without requiring hosts to reach through `getEditor()` or manually compose lower-level functions

### Reliability
- Pre-hydration and post-destruction handles return deterministic empty fallbacks and never attempt document mutation
- Valid restore still performs exactly one callback-suppressed editor replacement only after envelope resource checks and complete active-schema reconstruction succeed

### Security
- Imperative convenience methods preserve the existing redacted typed failures, duplicate-name rejection, resource ceilings, strict UTF-8 decoding, and hostile-object defenses
- CWL and naruon hosts retain authorization, tenant isolation, migration, optimistic concurrency, transport, signing, encryption, retention, and audit policy

### Tests
- Added active-editor object/JSON/byte export, valid preflight, callback-suppressed restore, incompatible-schema atomicity, byte restore, custom-limit, and empty-handle coverage under the repository-wide 100% TypeScript coverage gate

### Documentation
- Added `docs/imperative-envelope-persistence.md` with complete host integration examples, lifecycle behavior, collaboration authorization, and modular MSA boundaries
"""
changelog_path.write_text(replace_once(changelog, "## [Unreleased]\n", entry))

Path("src/components/CwlEditor.envelopeHandle.test.tsx").write_text(
    """import { act, cleanup, render, waitFor } from '@testing-library/react';
import { createRef } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  createDocumentEnvelope,
  DOCUMENT_ENVELOPE_SCHEMA_ID,
  DOCUMENT_ENVELOPE_SCHEMA_VERSION,
  encodeDocumentEnvelope,
} from '../documentEnvelope.js';
import { DocumentSchemaError } from '../documentSchema.js';
import type { CwlEditorHandle } from '../types.js';
import { CwlEditor } from './CwlEditor.js';

afterEach(cleanup);

function createParagraphDocument(text: string) {
  return {
    type: 'doc',
    content: [
      {
        type: 'paragraph',
        content: [{ type: 'text', text }],
      },
    ],
  };
}

describe('CwlEditor imperative envelope persistence', () => {
  it('exports the current revision as object, canonical JSON, and UTF-8 bytes', async () => {
    const editorRef = createRef<CwlEditorHandle>();
    render(
      <CwlEditor
        ref={editorRef}
        mode="markdown"
        defaultValue="Exported revision"
      />,
    );
    await waitFor(() =>
      expect(editorRef.current?.getEditor()).not.toBeNull(),
    );

    const handle = editorRef.current!;
    const envelope = handle.getDocumentEnvelope({ maxJsonValues: 32 });
    expect(envelope).toMatchObject({
      schemaId: DOCUMENT_ENVELOPE_SCHEMA_ID,
      schemaVersion: DOCUMENT_ENVELOPE_SCHEMA_VERSION,
    });
    expect(Object.isFrozen(envelope)).toBe(true);
    expect(Object.isFrozen(envelope!.documentJson)).toBe(true);

    const canonicalJson = handle.getDocumentEnvelopeJson({
      maxJsonValues: 32,
    });
    expect(JSON.parse(canonicalJson)).toEqual(envelope);
    expect(
      new TextDecoder().decode(
        handle.getDocumentEnvelopeBytes({ maxJsonValues: 32 }),
      ),
    ).toBe(canonicalJson);
  });

  it('preflights and atomically restores object and byte envelopes', async () => {
    const editorRef = createRef<CwlEditorHandle>();
    const onChange = vi.fn();
    render(
      <CwlEditor
        ref={editorRef}
        mode="markdown"
        defaultValue="Before"
        onChange={onChange}
      />,
    );
    await waitFor(() =>
      expect(editorRef.current?.getEditor()).not.toBeNull(),
    );
    const handle = editorRef.current!;
    onChange.mockClear();

    const objectEnvelope = createDocumentEnvelope(
      createParagraphDocument('Object restore'),
    );
    expect(handle.validateDocumentEnvelope(objectEnvelope)).toBe(true);
    let restoredObject;
    act(() => {
      restoredObject = handle.restoreDocumentEnvelope(objectEnvelope);
    });
    expect(restoredObject).toEqual(objectEnvelope);
    expect(handle.getHTML()).toContain('Object restore');
    expect(onChange).not.toHaveBeenCalled();

    const byteEnvelope = createDocumentEnvelope(
      createParagraphDocument('Byte restore'),
    );
    const bytes = encodeDocumentEnvelope(byteEnvelope);
    expect(handle.validateDocumentEnvelopeBytes(bytes)).toBe(true);
    let restoredBytes;
    act(() => {
      restoredBytes = handle.restoreDocumentEnvelopeBytes(bytes);
    });
    expect(restoredBytes).toEqual(byteEnvelope);
    expect(handle.getHTML()).toContain('Byte restore');
    expect(onChange).not.toHaveBeenCalled();

    const incompatibleEnvelope = createDocumentEnvelope({
      type: 'doc',
      content: [{ type: 'unsupported_node' }],
    });
    const beforeFailure = handle.getHTML();
    expect(handle.validateDocumentEnvelope(incompatibleEnvelope)).toBe(false);
    expect(
      handle.validateDocumentEnvelopeBytes(
        encodeDocumentEnvelope(incompatibleEnvelope),
      ),
    ).toBe(false);
    expect(() =>
      handle.restoreDocumentEnvelope(incompatibleEnvelope),
    ).toThrow(DocumentSchemaError);
    expect(handle.getHTML()).toBe(beforeFailure);
    expect(onChange).not.toHaveBeenCalled();
  });
});
"""
)

Path("docs/imperative-envelope-persistence.md").write_text(
    """# Imperative document-envelope persistence

Inkspan 0.5.21 exposes the complete versioned persistence round trip on
`CwlEditorHandle`. Hosts no longer need to reach through `getEditor()` or
manually compose envelope, canonicalization, schema-validation, and restore
functions for ordinary autosave and load workflows.

## Export the current revision

```tsx
const editorRef = createRef<CwlEditorHandle>();

const envelope = editorRef.current?.getDocumentEnvelope();
const canonicalJson = editorRef.current?.getDocumentEnvelopeJson();
const canonicalBytes = editorRef.current?.getDocumentEnvelopeBytes();
```

All three methods read one current TipTap/ProseMirror document revision. The
object envelope is detached and deeply frozen. JSON follows Inkspan's
deterministic RFC 8785 representation, and bytes are strict UTF-8 without a
byte-order mark. Optional `DocumentEnvelopeLimits` can enforce product-tier
ceilings during export.

Before client hydration or after editor destruction, object export returns
`null`, JSON export returns `''`, and byte export returns an empty
`Uint8Array`. These values are lifecycle fallbacks, not valid persisted
documents.

## Validate and restore

```tsx
const limits = {
  maxUtf8Bytes: 8 * 1024 * 1024,
  maxJsonValues: 250_000,
};

if (editorRef.current?.validateDocumentEnvelopeBytes(storedBytes, limits)) {
  editorRef.current.restoreDocumentEnvelopeBytes(storedBytes, limits);
}
```

Object and JSON-text inputs use `validateDocumentEnvelope()` and
`restoreDocumentEnvelope()`. Strict UTF-8 inputs use the corresponding
`...Bytes` methods. Validation is non-mutating. Restore completes duplicate
object-name detection, resource checks, schema/version routing, hostile-value
detachment, and full active ProseMirror schema reconstruction before one
`setContent(..., false)` mutation. A failure leaves the current document
unchanged.

Successful restore suppresses normal change callbacks because loading an
already-persisted revision must not immediately schedule another autosave.
Hosts should update their own saved-revision, dirty-state, and optimistic-
concurrency records after the method returns.

## Collaboration authorization

`CollaborativeCwlEditor` exposes the same handle because both surfaces share
the implementation. Restoring into a collaborative editor replaces the
Yjs-backed document and can affect other participants. Inkspan validates
content compatibility but does not grant permission. The CWL or naruon host
must authorize the document, tenant, user, and expected revision before
invoking restore and must coordinate awareness, audit, and conflict UX.

## Security and MSA boundary

The convenience methods preserve all lower-level guarantees: redacted typed
errors, duplicate-name rejection, configurable resource ceilings, strict UTF-8
decoding, canonical serialization, active-schema validation, and
unchanged-document failure behavior.

They do not replace gateway byte limits, decompression limits, timeouts,
rate/concurrency controls, migration routing, tenant isolation, encryption,
signatures, key management, retention, audit, or optimistic concurrency.
Persist descriptive nonnumeric document, tenant, user, and revision identifiers
in host metadata rather than extending the strict envelope with ad hoc fields.

## Primary references

- RFC 8785, JSON Canonicalization Scheme
- RFC 8259, The JavaScript Object Notation Data Interchange Format
- WHATWG Encoding Standard, UTF-8 decoding
- TipTap editor commands and persistence guidance
- ProseMirror `Node.fromJSON` schema reconstruction
"""
)
