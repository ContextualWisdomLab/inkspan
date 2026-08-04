import { act, render, waitFor } from '@testing-library/react';
import { createRef } from 'react';
import { describe, expect, it, vi } from 'vitest';
import {
  DocumentEnvelopeError,
  createDocumentEnvelope,
} from './documentEnvelope.js';
import { encodeDocumentEnvelope } from './documentEnvelopeCanonical.js';
import {
  restoreDocumentEnvelope,
  restoreDocumentEnvelopeBytes,
  validateDocumentEnvelopeBytesForEditor,
  validateDocumentEnvelopeForEditor,
} from './documentEnvelopeRestore.js';
import { DocumentSchemaError } from './documentSchema.js';
import type { CwlEditorHandle } from './types.js';
import { CwlEditor } from './components/CwlEditor.js';

describe('atomic document-envelope restore', () => {
  it('validates and restores object and canonical-byte envelopes atomically', async () => {
    const editorRef = createRef<CwlEditorHandle>();
    const onChange = vi.fn();
    render(
      <CwlEditor
        ref={editorRef}
        mode="markdown"
        defaultValue="Original"
        onChange={onChange}
      />,
    );
    await waitFor(() => expect(editorRef.current?.getEditor()).toBeTruthy());
    await waitFor(() => expect(onChange).toHaveBeenCalled());
    onChange.mockClear();

    const envelope = createDocumentEnvelope({
      type: 'doc',
      content: [
        {
          type: 'heading',
          attrs: { level: 2 },
          content: [{ type: 'text', text: 'Restored envelope' }],
        },
      ],
    });
    const bytes = encodeDocumentEnvelope(envelope);
    const editor = editorRef.current!.getEditor()!;

    expect(validateDocumentEnvelopeForEditor(editor, envelope)).toBe(true);
    expect(validateDocumentEnvelopeBytesForEditor(editor, bytes)).toBe(true);

    let restoredEnvelope = envelope;
    await act(async () => {
      restoredEnvelope = restoreDocumentEnvelope(editor, envelope);
    });
    expect(restoredEnvelope).toEqual(envelope);
    expect(Object.isFrozen(restoredEnvelope)).toBe(true);
    expect(editorRef.current!.getMarkdown()).toBe('## Restored envelope');
    expect(onChange).not.toHaveBeenCalled();

    await act(async () => {
      restoredEnvelope = restoreDocumentEnvelopeBytes(editor, bytes);
    });
    expect(restoredEnvelope).toEqual(envelope);
    expect(editorRef.current!.getSnapshot().documentJson).toEqual(
      envelope.documentJson,
    );
    expect(onChange).not.toHaveBeenCalled();
  });

  it('fails closed without changing the current editor document', async () => {
    const editorRef = createRef<CwlEditorHandle>();
    render(<CwlEditor ref={editorRef} defaultValue="Keep this document" />);
    await waitFor(() => expect(editorRef.current?.getEditor()).toBeTruthy());

    const editor = editorRef.current!.getEditor()!;
    const before = editorRef.current!.getSnapshot();
    const malformed = '{"tenantSecret":';
    expect(validateDocumentEnvelopeForEditor(editor, malformed)).toBe(false);
    expect(() => restoreDocumentEnvelope(editor, malformed)).toThrow(
      DocumentEnvelopeError,
    );

    const incompatible = createDocumentEnvelope({
      type: 'doc',
      content: [{ type: 'unsupportedEnterpriseWidget' }],
    });
    const incompatibleBytes = encodeDocumentEnvelope(incompatible);
    expect(validateDocumentEnvelopeBytesForEditor(editor, incompatibleBytes)).toBe(
      false,
    );
    expect(() =>
      restoreDocumentEnvelopeBytes(editor, incompatibleBytes),
    ).toThrow(DocumentSchemaError);

    expect(editorRef.current!.getSnapshot()).toEqual(before);
  });
});
