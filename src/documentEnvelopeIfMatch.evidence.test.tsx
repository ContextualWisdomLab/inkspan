import { act, render, waitFor } from '@testing-library/react';
import { createRef } from 'react';
import { describe, expect, it, vi } from 'vitest';
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
import {
  restoreDocumentEnvelopeIfMatch,
  type CwlEditorIfMatchRestoreResult,
} from './documentEnvelopeIfMatch.js';
import type { CwlEditorHandle } from './types.js';

const ZERO_DIGEST_PROVIDER: DocumentEnvelopeDigestProvider = {
  async digest() {
    return new ArrayBuffer(32);
  },
};

type ConflictEvidenceResult = CwlEditorIfMatchRestoreResult & {
  readonly currentEnvelope: CwlEditorDocumentEnvelope | null;
};

type RestoredEvidenceResult = CwlEditorIfMatchRestoreResult & {
  readonly previousEnvelope: CwlEditorDocumentEnvelope;
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
    createDocumentEnvelopeRevision(
      envelope,
      undefined,
      ZERO_DIGEST_PROVIDER,
    ),
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
      ZERO_DIGEST_PROVIDER,
    );
    const hostileSource = Object.defineProperty({}, 'schemaId', {
      enumerable: true,
      get() {
        throw new Error('mismatched-source-must-not-be-read');
      },
    });

    const result = (await restoreDocumentEnvelopeIfMatch(
      editor,
      `"sha256-${'ff'.repeat(32)}"`,
      hostileSource,
      undefined,
      ZERO_DIGEST_PROVIDER,
    )) as ConflictEvidenceResult;

    expect(result).toEqual({
      status: 'conflict',
      currentRevision,
      currentEnvelope,
    });
    expect(Object.isFrozen(result)).toBe(true);
    await expectMatchingEvidence(result.currentEnvelope!, currentRevision);
    expect(handle.getMarkdown()).toBe('Conflict evidence document');
  });

  it('returns the exact previous envelope paired with the successful guard revision', async () => {
    const handle = await renderEvidenceEditor();
    const editor = handle.getEditor()!;
    const previousEnvelope = handle.getDocumentEnvelope()!;
    const previousRevision = await createDocumentEnvelopeRevision(
      previousEnvelope,
      undefined,
      ZERO_DIGEST_PROVIDER,
    );
    const incomingEnvelope = createParagraphEnvelope('Applied next revision');
    let result!: RestoredEvidenceResult;

    await act(async () => {
      result = (await restoreDocumentEnvelopeIfMatch(
        editor,
        previousRevision.strongEntityTag,
        incomingEnvelope,
        undefined,
        ZERO_DIGEST_PROVIDER,
      )) as RestoredEvidenceResult;
    });

    expect(result).toEqual({
      status: 'restored',
      previousRevision,
      previousEnvelope,
      envelope: incomingEnvelope,
    });
    expect(Object.isFrozen(result)).toBe(true);
    await expectMatchingEvidence(result.previousEnvelope, previousRevision);
    expect(handle.getMarkdown()).toBe('Applied next revision');
  });
});
