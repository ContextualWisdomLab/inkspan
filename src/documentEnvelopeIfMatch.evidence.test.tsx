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
  DocumentEnvelopeRevisionError,
  type CwlEditorDocumentRevision,
  type DocumentEnvelopeDigestProvider,
} from './documentEnvelopeRevision.js';
import {
  restoreDocumentEnvelopeIfMatch,
  type CwlEditorIfMatchRestoreResult,
} from './documentEnvelopeIfMatch.js';
import type { CwlEditorHandle } from './types.js';

function createDeterministicDigest(source: BufferSource): ArrayBuffer {
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
}

const DIGEST_PROVIDER: DocumentEnvelopeDigestProvider = {
  async digest(_algorithm, source) {
    return createDeterministicDigest(source);
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

  it('returns exact previous and resulting revision-envelope evidence after restore', async () => {
    const handle = await renderEvidenceEditor();
    const editor = handle.getEditor()!;
    const previousEnvelope = handle.getDocumentEnvelope()!;
    const previousRevision = await createDocumentEnvelopeRevision(
      previousEnvelope,
      undefined,
      DIGEST_PROVIDER,
    );
    const incomingEnvelope = createParagraphEnvelope('Applied next revision');
    const revision = await createDocumentEnvelopeRevision(
      incomingEnvelope,
      undefined,
      DIGEST_PROVIDER,
    );
    let result!: CwlEditorIfMatchRestoreResult;

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
      revision,
      envelope: incomingEnvelope,
    });
    expect(Object.isFrozen(result)).toBe(true);
    if (result.status !== 'restored') {
      throw new Error('Expected a restored result with transition evidence');
    }
    await expectMatchingEvidence(
      result.previousEnvelope,
      result.previousRevision,
    );
    await expectMatchingEvidence(result.envelope, result.revision);
    expect(handle.getDocumentEnvelope()).toEqual(result.envelope);
    expect(handle.getMarkdown()).toBe('Applied next revision');
  });

  it('derives resulting evidence from the active-schema document rather than ignored source fields', async () => {
    const handle = await renderEvidenceEditor();
    const editor = handle.getEditor()!;
    const previousEnvelope = handle.getDocumentEnvelope()!;
    const previousRevision = await createDocumentEnvelopeRevision(
      previousEnvelope,
      undefined,
      DIGEST_PROVIDER,
    );
    const incomingEnvelope = createDocumentEnvelope({
      type: 'doc',
      ignoredRootField: 'not part of the editor document',
      content: [
        {
          type: 'paragraph',
          ignoredNodeField: 'not part of the editor node',
          content: [{ type: 'text', text: 'Schema-normalized result' }],
        },
      ],
    });
    const appliedEnvelope = createParagraphEnvelope('Schema-normalized result');
    const revision = await createDocumentEnvelopeRevision(
      appliedEnvelope,
      undefined,
      DIGEST_PROVIDER,
    );
    let result!: CwlEditorIfMatchRestoreResult;

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
      revision,
      envelope: appliedEnvelope,
    });
    expect(result).not.toMatchObject({ envelope: incomingEnvelope });
    expect(handle.getDocumentEnvelope()).toEqual(appliedEnvelope);
  });

  it('stops before the resulting digest when source preparation changes the editor', async () => {
    const handle = await renderEvidenceEditor();
    const editor = handle.getEditor()!;
    const previousEnvelope = handle.getDocumentEnvelope()!;
    const previousRevision = await createDocumentEnvelopeRevision(
      previousEnvelope,
      undefined,
      DIGEST_PROVIDER,
    );
    const incomingEnvelope = createParagraphEnvelope('Must remain unapplied');
    let sourceTrapInvoked = false;
    const reentrantSource = new Proxy(incomingEnvelope, {
      ownKeys(target) {
        if (!sourceTrapInvoked) {
          sourceTrapInvoked = true;
          editor.commands.setContent(
            '<p>Newer document from source preparation</p>',
            false,
          );
        }
        return Reflect.ownKeys(target);
      },
    });
    const digestProvider: DocumentEnvelopeDigestProvider = {
      digest: vi.fn(async (_algorithm, source) =>
        createDeterministicDigest(source),
      ),
    };
    let result!: CwlEditorIfMatchRestoreResult;

    await act(async () => {
      result = await restoreDocumentEnvelopeIfMatch(
        editor,
        previousRevision.strongEntityTag,
        reentrantSource,
        undefined,
        digestProvider,
      );
    });

    expect(result).toEqual({
      status: 'conflict',
      currentRevision: null,
      currentEnvelope: null,
    });
    expect(sourceTrapInvoked).toBe(true);
    expect(digestProvider.digest).toHaveBeenCalledTimes(1);
    expect(handle.getMarkdown()).toBe(
      'Newer document from source preparation',
    );
  });

  it('does not apply a prepared envelope when the editor moves while its revision hashes', async () => {
    const handle = await renderEvidenceEditor();
    const editor = handle.getEditor()!;
    const previousEnvelope = handle.getDocumentEnvelope()!;
    const previousRevision = await createDocumentEnvelopeRevision(
      previousEnvelope,
      undefined,
      DIGEST_PROVIDER,
    );
    const incomingEnvelope = createParagraphEnvelope('Must remain unapplied');
    let announceNextDigest!: () => void;
    const nextDigestStarted = new Promise<void>((resolve) => {
      announceNextDigest = resolve;
    });
    let releaseNextDigest!: () => void;
    const nextDigestRelease = new Promise<void>((resolve) => {
      releaseNextDigest = resolve;
    });
    let digestCallCount = 0;
    const digestProvider: DocumentEnvelopeDigestProvider = {
      digest: vi.fn(async (_algorithm, source) => {
        digestCallCount += 1;
        if (digestCallCount === 1) return createDeterministicDigest(source);
        announceNextDigest();
        await nextDigestRelease;
        return createDeterministicDigest(source);
      }),
    };

    const pending = restoreDocumentEnvelopeIfMatch(
      editor,
      previousRevision.strongEntityTag,
      incomingEnvelope,
      undefined,
      digestProvider,
    );
    await nextDigestStarted;
    act(() => {
      editor.commands.setContent('<p>Newer local document</p>', false);
    });
    releaseNextDigest();

    await expect(pending).resolves.toEqual({
      status: 'conflict',
      currentRevision: null,
      currentEnvelope: null,
    });
    expect(digestProvider.digest).toHaveBeenCalledTimes(2);
    expect(handle.getMarkdown()).toBe('Newer local document');
  });

  it('preserves the current document when the resulting digest fails', async () => {
    const handle = await renderEvidenceEditor();
    const editor = handle.getEditor()!;
    const previousEnvelope = handle.getDocumentEnvelope()!;
    const previousRevision = await createDocumentEnvelopeRevision(
      previousEnvelope,
      undefined,
      DIGEST_PROVIDER,
    );
    let digestCallCount = 0;
    const digestProvider: DocumentEnvelopeDigestProvider = {
      digest: vi.fn(async (_algorithm, source) => {
        digestCallCount += 1;
        if (digestCallCount === 1) return createDeterministicDigest(source);
        throw new Error('resulting-digest-failed');
      }),
    };

    await expect(
      restoreDocumentEnvelopeIfMatch(
        editor,
        previousRevision.strongEntityTag,
        createParagraphEnvelope('Must not be applied after digest failure'),
        undefined,
        digestProvider,
      ),
    ).rejects.toThrow(DocumentEnvelopeRevisionError);
    expect(digestProvider.digest).toHaveBeenCalledTimes(2);
    expect(handle.getDocumentEnvelope()).toEqual(previousEnvelope);
    expect(handle.getMarkdown()).toBe('Conflict evidence document');
  });
});
