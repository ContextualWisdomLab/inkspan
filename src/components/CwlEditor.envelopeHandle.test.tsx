import { act, cleanup, render, waitFor } from '@testing-library/react';
import { createRef } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  createDocumentEnvelope,
  DOCUMENT_ENVELOPE_SCHEMA_ID,
  DOCUMENT_ENVELOPE_SCHEMA_VERSION,
} from '../documentEnvelope.js';
import { encodeDocumentEnvelope } from '../documentEnvelopeCanonical.js';
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
