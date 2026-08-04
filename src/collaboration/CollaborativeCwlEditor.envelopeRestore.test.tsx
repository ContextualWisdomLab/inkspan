import { act, cleanup, render, waitFor } from '@testing-library/react';
import { createRef } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import * as Y from 'yjs';
import { createDocumentEnvelope } from '../documentEnvelope.js';
import type { DocumentEnvelopeDigestProvider } from '../documentEnvelopeRevision.js';
import type { CwlEditorIfMatchRestoreResult } from '../documentEnvelopeIfMatch.js';
import type { CwlEditorHandle } from '../types.js';
import { CollaborativeCwlEditor } from './CollaborativeCwlEditor.js';

const openDocuments: Y.Doc[] = [];

const DIGEST_PROVIDER: DocumentEnvelopeDigestProvider = {
  async digest() {
    return new Uint8Array(32).fill(0xab).buffer;
  },
};

afterEach(() => {
  cleanup();
  for (const document of openDocuments.splice(0)) document.destroy();
});

describe('collaborative revision-guarded envelope restore', () => {
  it('applies an exact prepared document through the Yjs-backed editor policy', async () => {
    const collaborationDocument = new Y.Doc();
    openDocuments.push(collaborationDocument);
    const editorRef = createRef<CwlEditorHandle>();
    const onChange = vi.fn();
    render(
      <CollaborativeCwlEditor
        ref={editorRef}
        document={collaborationDocument}
        mode="markdown"
        onChange={onChange}
        hideToolbar
      />,
    );
    await waitFor(() => expect(editorRef.current?.getEditor()).toBeTruthy());

    const handle = editorRef.current!;
    const revision = await handle.getDocumentEnvelopeRevision(
      undefined,
      DIGEST_PROVIDER,
    );
    const envelope = createDocumentEnvelope({
      type: 'doc',
      content: [
        {
          type: 'paragraph',
          content: [{ type: 'text', text: 'Collaborative restored content' }],
        },
      ],
    });
    onChange.mockClear();
    let result!: CwlEditorIfMatchRestoreResult | null;

    await act(async () => {
      result = await handle.restoreDocumentEnvelopeIfMatch(
        revision!.strongEntityTag,
        envelope,
        undefined,
        DIGEST_PROVIDER,
      );
    });

    expect(result).toEqual({
      status: 'restored',
      previousRevision: revision,
      envelope,
    });
    expect(handle.getMarkdown()).toBe('Collaborative restored content');
    expect(onChange).not.toHaveBeenCalled();
    expect(
      collaborationDocument.getXmlFragment('default').toJSON(),
    ).toContain('Collaborative restored content');
  });
});
