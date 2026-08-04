import { render, waitFor } from '@testing-library/react';
import { createRef } from 'react';
import { describe, expect, it } from 'vitest';
import { CwlEditor } from './components/CwlEditor.js';
import { createDocumentEnvelope } from './documentEnvelope.js';
import {
  createDocumentEnvelopeRevision,
  type DocumentEnvelopeDigestProvider,
} from './documentEnvelopeRevision.js';
import { restoreDocumentEnvelopeIfMatch } from './documentEnvelopeIfMatch.js';
import { DocumentEnvelopeRestoreError } from './documentEnvelopeRestore.js';
import type { CwlEditorHandle } from './types.js';

const DIGEST_PROVIDER: DocumentEnvelopeDigestProvider = {
  async digest() {
    return new ArrayBuffer(32);
  },
};

describe('revision-guarded restore editor policy', () => {
  it('never reports success when a transaction policy rejects the envelope', async () => {
    const editorRef = createRef<CwlEditorHandle>();
    render(<CwlEditor ref={editorRef} defaultValue="Keep current document" />);
    await waitFor(() => expect(editorRef.current?.getEditor()).toBeTruthy());

    const handle = editorRef.current!;
    const editor = handle.getEditor()!;
    const revision = await createDocumentEnvelopeRevision(
      handle.getDocumentEnvelope()!,
      undefined,
      DIGEST_PROVIDER,
    );
    const rejectedSource = 'https://tracker.example/pixel.png';
    const policyRejected = createDocumentEnvelope({
      type: 'doc',
      content: [
        {
          type: 'image',
          attrs: {
            src: rejectedSource,
            alt: 'Remote tracking image',
            title: null,
          },
        },
      ],
    });

    let caught: unknown;
    try {
      await restoreDocumentEnvelopeIfMatch(
        editor,
        revision.strongEntityTag,
        policyRejected,
        undefined,
        DIGEST_PROVIDER,
      );
    } catch (error) {
      caught = error;
    }

    expect(caught).toBeInstanceOf(DocumentEnvelopeRestoreError);
    expect(String(caught)).not.toContain(rejectedSource);
    expect(handle.getMarkdown()).toBe('Keep current document');
  });
});
