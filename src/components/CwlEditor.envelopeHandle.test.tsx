import { act, cleanup, render, waitFor } from '@testing-library/react';
import { createRef } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  createDocumentEnvelope,
  DOCUMENT_ENVELOPE_SCHEMA_ID,
  DOCUMENT_ENVELOPE_SCHEMA_VERSION,
} from '../documentEnvelope.js';
import { encodeDocumentEnvelope } from '../documentEnvelopeCanonical.js';
import {
  createDocumentEnvelopeRevision,
  type DocumentEnvelopeDigestProvider,
} from '../documentEnvelopeRevision.js';
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
  it('exports the current revision as object, canonical JSON, bytes, and a strong validator', async () => {
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

    const digestProvider: DocumentEnvelopeDigestProvider = {
      digest: async () => new Uint8Array(32).fill(0xef).buffer,
    };
    const revision = await handle.getDocumentEnvelopeRevision(
      { maxJsonValues: 32 },
      digestProvider,
    );
    expect(revision).toEqual(
      await createDocumentEnvelopeRevision(
        envelope,
        { maxJsonValues: 32 },
        digestProvider,
      ),
    );
    expect(revision?.digestHex).toBe('ef'.repeat(32));
    expect(revision?.strongEntityTag).toBe(
      `"sha256-${revision?.digestHex}"`,
    );
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

  it('applies object and byte envelopes only when the handle revision matches', async () => {
    const editorRef = createRef<CwlEditorHandle>();
    const onChange = vi.fn();
    render(
      <CwlEditor
        ref={editorRef}
        mode="markdown"
        defaultValue="Conditional before"
        onChange={onChange}
      />,
    );
    await waitFor(() =>
      expect(editorRef.current?.getEditor()).not.toBeNull(),
    );
    const handle = editorRef.current!;
    onChange.mockClear();
    const digestProvider: DocumentEnvelopeDigestProvider = {
      digest: vi.fn(async () => new Uint8Array(32).fill(0xef).buffer),
    };
    const revision = await handle.getDocumentEnvelopeRevision(
      { maxJsonValues: 32 },
      digestProvider,
    );
    const objectEnvelope = createDocumentEnvelope(
      createParagraphDocument('Conditional object'),
    );

    const objectResult = await act(async () =>
      handle.restoreDocumentEnvelopeIfMatch(
        revision!.strongEntityTag,
        objectEnvelope,
        { maxJsonValues: 32 },
        digestProvider,
      ),
    );

    expect(objectResult).toEqual({
      status: 'restored',
      previousRevision: revision,
      envelope: objectEnvelope,
    });
    expect(handle.getHTML()).toContain('Conditional object');
    expect(onChange).not.toHaveBeenCalled();

    const beforeConflict = handle.getHTML();
    const conflict = await handle.restoreDocumentEnvelopeIfMatch(
      `"sha256-${'00'.repeat(32)}"`,
      createDocumentEnvelope(createParagraphDocument('Must not apply')),
      undefined,
      digestProvider,
    );
    expect(conflict).toEqual({
      status: 'conflict',
      currentRevision: revision,
    });
    expect(handle.getHTML()).toBe(beforeConflict);

    const byteEnvelope = createDocumentEnvelope(
      createParagraphDocument('Conditional bytes'),
    );
    const byteResult = await act(async () =>
      handle.restoreDocumentEnvelopeBytesIfMatch(
        revision!.strongEntityTag,
        encodeDocumentEnvelope(byteEnvelope),
        undefined,
        digestProvider,
      ),
    );
    expect(byteResult).toMatchObject({
      status: 'restored',
      previousRevision: revision,
      envelope: byteEnvelope,
    });
    expect(handle.getHTML()).toContain('Conditional bytes');
    expect(onChange).not.toHaveBeenCalled();
  });
});
