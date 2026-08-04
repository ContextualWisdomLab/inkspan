import { act, render, waitFor } from '@testing-library/react';
import { createRef } from 'react';
import { describe, expect, it } from 'vitest';
import { CwlEditor } from './components/CwlEditor.js';
import {
  createDocumentEnvelope,
  type CwlEditorDocumentEnvelope,
} from './documentEnvelope.js';
import {
  createDocumentEnvelopeRevision,
  type CwlEditorDocumentRevision,
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

async function renderEvidenceEditor(): Promise<CwlEditorHandle> {
  const editorRef = createRef<CwlEditorHandle>();
  render(
    <CwlEditor
      ref={editorRef}
      mode="markdown"
      defaultValue="Conflict evidence document"
    />,
  );
  await waitFor(() => expect(editorRef.current?.getEditor()).toBeTruthy());
  return editorRef.current!;
}

function createParagraphEnvelope(text: string): CwlEditorDocumentEnvelope {
  return createDocumentEnvelope({
    type: 'doc',
    content: [
      {
        type: 'paragraph',
        content: [{ type: 'text', text }],
      },
    ],
  });
}

async function expectMatchingEvidence(
  envelope: CwlEditorDocumentEnvelope,
  revision: CwlEditorDocumentRevision,
): Promise<void> {
  expect(Object.isFrozen(envelope)).toBe(true);
  await expect(
    createDocumentEnvelopeRevision(envelope, undefined, DIGEST_PROVIDER),
  ).resolves.toEqual(revision);
}

describe('atomic revision-envelope conflict evidence', () => {
  it('returns the stable current envelope with its revision without reading the source', async () => {
    const handle = await renderEvidenceEditor();
    const editor = handle.getEditor()!;
    const currentEnvelope = handle.getDocumentEnvelope()!;
    const currentRevision = await createDocumentEnvelopeRevision(
      currentEnvelope,
      undefined,
      DIGEST_PROVIDER,
    );
    const differentRevision = await createDocumentEnvelopeRevision(
      createParagraphEnvelope('Different expected revision'),
      undefined,
      DIGEST_PROVIDER,
    );
    const hostileSource = Object.defineProperty({}, 'schemaId', {
      enumerable: true,
      get() {
        throw new Error('mismatched-source-must-not-be-read');
      },
    });

    const result = await restoreDocumentEnvelopeIfMatch(
      editor,
      differentRevision.strongEntityTag,
      hostileSource,
      undefined,
      DIGEST_PROVIDER,
    );

    expect(result).toEqual({
      status: 'conflict',
      currentRevision,
      currentEnvelope,
    });
    expect(Object.isFrozen(result)).toBe(true);
    if (result.status !== 'conflict' || result.currentRevision === null) {
      throw new Error('Expected a stable conflict with revision evidence');
    }
    await expectMatchingEvidence(result.currentEnvelope, result.currentRevision);
    expect(handle.getMarkdown()).toBe('Conflict evidence document');
  });

  it('returns the exact previous envelope paired with the successful guard revision', async () => {
    const handle = await renderEvidenceEditor();
    const editor = handle.getEditor()!;
    const previousEnvelope = handle.getDocumentEnvelope()!;
    const previousRevision = await createDocumentEnvelopeRevision(
      previousEnvelope,
      undefined,
      DIGEST_PROVIDER,
    );
    const incomingEnvelope = createParagraphEnvelope('Applied next revision');
    let result = await restoreDocumentEnvelopeIfMatch(
      editor,
      previousRevision.strongEntityTag,
      previousEnvelope,
      undefined,
      DIGEST_PROVIDER,
    );

    await act(async () => {
      result = await restoreDocumentEnvelopeIfMatch(
        editor,
        previousRevision.strongEntityTag,
        incomingEnvelope,
        undefined,
        DIGEST_PROVIDER,
      );
    });

    expect(result).toEqual({
      status: 'restored',
      previousRevision,
      previousEnvelope,
      envelope: incomingEnvelope,
    });
    expect(Object.isFrozen(result)).toBe(true);
    if (result.status !== 'restored') {
      throw new Error('Expected a restored result with previous evidence');
    }
    await expectMatchingEvidence(
      result.previousEnvelope,
      result.previousRevision,
    );
    expect(handle.getMarkdown()).toBe('Applied next revision');
  });
});
