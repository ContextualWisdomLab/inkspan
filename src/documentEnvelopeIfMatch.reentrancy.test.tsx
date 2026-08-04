import { act, render, waitFor } from '@testing-library/react';
import { createRef } from 'react';
import { describe, expect, it } from 'vitest';
import { CwlEditor } from './components/CwlEditor.js';
import { createDocumentEnvelope } from './documentEnvelope.js';
import {
  createDocumentEnvelopeRevision,
  type DocumentEnvelopeDigestProvider,
} from './documentEnvelopeRevision.js';
import { restoreDocumentEnvelopeIfMatch } from './documentEnvelopeIfMatch.js';
import type { CwlEditorHandle } from './types.js';

const DIGEST_PROVIDER: DocumentEnvelopeDigestProvider = {
  async digest(_algorithm, source) {
    const bytes = ArrayBuffer.isView(source)
      ? new Uint8Array(source.buffer, source.byteOffset, source.byteLength)
      : new Uint8Array(source);
    const digest = new Uint8Array(32);
    for (let index = 0; index < bytes.length; index += 1) {
      const digestIndex = index % digest.length;
      digest[digestIndex] =
        (digest[digestIndex] + bytes[index] + index) % 256;
    }
    return digest.buffer;
  },
};

describe('revision-guarded restore reentrancy', () => {
  it('does not overwrite a document changed by hostile source reflection', async () => {
    const editorRef = createRef<CwlEditorHandle>();
    render(
      <CwlEditor
        ref={editorRef}
        mode="markdown"
        defaultValue="Original document"
      />,
    );
    await waitFor(() => expect(editorRef.current?.getEditor()).toBeTruthy());

    const handle = editorRef.current!;
    const editor = handle.getEditor()!;
    const currentEnvelope = handle.getDocumentEnvelope()!;
    const currentRevision = await createDocumentEnvelopeRevision(
      currentEnvelope,
      undefined,
      DIGEST_PROVIDER,
    );
    const incoming = createDocumentEnvelope({
      type: 'doc',
      content: [
        {
          type: 'paragraph',
          content: [{ type: 'text', text: 'Stale incoming document' }],
        },
      ],
    });
    let changed = false;
    const reentrantSource = new Proxy(incoming, {
      getPrototypeOf(target) {
        if (!changed) {
          changed = true;
          editor.commands.setContent('<p>Reentrant newer document</p>', false);
        }
        return Reflect.getPrototypeOf(target);
      },
    });

    let result;
    await act(async () => {
      result = await restoreDocumentEnvelopeIfMatch(
        editor,
        currentRevision.strongEntityTag,
        reentrantSource,
        undefined,
        DIGEST_PROVIDER,
      );
    });

    expect(result).toEqual({
      status: 'conflict',
      currentRevision: null,
    });
    expect(handle.getMarkdown()).toBe('Reentrant newer document');
  });
});
