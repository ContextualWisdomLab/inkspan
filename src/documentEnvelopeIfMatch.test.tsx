import { act, render, waitFor } from '@testing-library/react';
import { createRef, type RefObject } from 'react';
import { describe, expect, it, vi } from 'vitest';
import { CwlEditor } from './components/CwlEditor.js';
import {
  createDocumentEnvelope,
  type CwlEditorDocumentEnvelope,
} from './documentEnvelope.js';
import { encodeDocumentEnvelope } from './documentEnvelopeCanonical.js';
import {
  createDocumentEnvelopeRevision,
  DocumentEnvelopeRevisionError,
  type DocumentEnvelopeDigestProvider,
} from './documentEnvelopeRevision.js';
import {
  restoreDocumentEnvelopeBytesIfMatch,
  restoreDocumentEnvelopeIfMatch,
  type CwlEditorIfMatchRestoreResult,
} from './documentEnvelopeIfMatch.js';
import { DocumentSchemaError } from './documentSchema.js';
import type { CwlEditorHandle } from './types.js';

function createDigestProvider(): DocumentEnvelopeDigestProvider {
  return {
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
}

function createDeferredDigestProvider(fill = 0): {
  provider: DocumentEnvelopeDigestProvider;
  resolve: () => void;
} {
  let resolveDigest!: (value: ArrayBuffer) => void;
  const digestPromise = new Promise<ArrayBuffer>((resolve) => {
    resolveDigest = resolve;
  });
  return {
    provider: { digest: vi.fn(() => digestPromise) },
    resolve: () => {
      const digest = new ArrayBuffer(32);
      new Uint8Array(digest).fill(fill);
      resolveDigest(digest);
    },
  };
}

async function renderEditor(): Promise<{
  editorRef: RefObject<CwlEditorHandle>;
  onChange: ReturnType<typeof vi.fn>;
}> {
  const editorRef = createRef<CwlEditorHandle>();
  const onChange = vi.fn();
  render(
    <CwlEditor
      ref={editorRef}
      mode="markdown"
      defaultValue="Original document"
      onChange={onChange}
    />,
  );
  await waitFor(() => expect(editorRef.current?.getEditor()).toBeTruthy());
  await waitFor(() => expect(onChange).toHaveBeenCalled());
  onChange.mockClear();
  return { editorRef, onChange };
}

function incomingEnvelope(text = 'Restored under precondition'):
  CwlEditorDocumentEnvelope {
  return createDocumentEnvelope({
    type: 'doc',
    content: [
      {
        type: 'heading',
        attrs: { level: 2 },
        content: [{ type: 'text', text }],
      },
    ],
  });
}

describe('revision-guarded document-envelope restore', () => {
  it('restores object and strict UTF-8 inputs only under the matching tag', async () => {
    const { editorRef, onChange } = await renderEditor();
    const editor = editorRef.current!.getEditor()!;
    const digestProvider = createDigestProvider();
    const currentEnvelope = editorRef.current!.getDocumentEnvelope()!;
    const currentRevision = await createDocumentEnvelopeRevision(
      currentEnvelope,
      undefined,
      digestProvider,
    );
    const objectEnvelope = incomingEnvelope();
    let objectResult!: CwlEditorIfMatchRestoreResult;

    await act(async () => {
      objectResult = await restoreDocumentEnvelopeIfMatch(
        editor,
        currentRevision.strongEntityTag,
        objectEnvelope,
        undefined,
        digestProvider,
      );
    });

    expect(objectResult).toEqual({
      status: 'restored',
      previousRevision: currentRevision,
      previousEnvelope: currentEnvelope,
      envelope: objectEnvelope,
    });
    expect(Object.isFrozen(objectResult)).toBe(true);
    expect(editorRef.current!.getMarkdown()).toBe(
      '## Restored under precondition',
    );
    expect(onChange).not.toHaveBeenCalled();

    const restoredRevision = await createDocumentEnvelopeRevision(
      objectEnvelope,
      undefined,
      digestProvider,
    );
    const byteEnvelope = incomingEnvelope('Restored from bytes');
    let byteResult!: CwlEditorIfMatchRestoreResult;
    await act(async () => {
      byteResult = await restoreDocumentEnvelopeBytesIfMatch(
        editor,
        restoredRevision.strongEntityTag,
        encodeDocumentEnvelope(byteEnvelope),
        undefined,
        digestProvider,
      );
    });

    expect(byteResult.status).toBe('restored');
    expect(byteResult).toMatchObject({
      previousRevision: restoredRevision,
      previousEnvelope: objectEnvelope,
      envelope: byteEnvelope,
    });
    expect(editorRef.current!.getMarkdown()).toBe('## Restored from bytes');
    expect(onChange).not.toHaveBeenCalled();
  });

  it('returns a stable current revision on mismatch without inspecting the source', async () => {
    const { editorRef } = await renderEditor();
    const editor = editorRef.current!.getEditor()!;
    const digestProvider = createDigestProvider();
    const currentEnvelope = editorRef.current!.getDocumentEnvelope()!;
    const currentRevision = await createDocumentEnvelopeRevision(
      currentEnvelope,
      undefined,
      digestProvider,
    );
    const differentRevision = await createDocumentEnvelopeRevision(
      incomingEnvelope('Different expected revision'),
      undefined,
      digestProvider,
    );
    const hostileSource = Object.defineProperty({}, 'schemaId', {
      enumerable: true,
      get() {
        throw new Error('source-must-not-be-read');
      },
    });

    const result = await restoreDocumentEnvelopeIfMatch(
      editor,
      differentRevision.strongEntityTag,
      hostileSource,
      undefined,
      digestProvider,
    );

    expect(result).toEqual({
      status: 'conflict',
      currentRevision,
      currentEnvelope,
    });
    expect(Object.isFrozen(result)).toBe(true);
    expect(editorRef.current!.getMarkdown()).toBe('Original document');
  });

  it('returns an unversioned conflict when the document changes during hashing', async () => {
    const { editorRef } = await renderEditor();
    const editor = editorRef.current!.getEditor()!;
    const deferred = createDeferredDigestProvider();
    const expectedStrongEntityTag = `"sha256-${'00'.repeat(32)}"`;
    const hostileSource = Object.defineProperty({}, 'schemaId', {
      enumerable: true,
      get() {
        throw new Error('source-must-not-be-read');
      },
    });

    const pending = restoreDocumentEnvelopeIfMatch(
      editor,
      expectedStrongEntityTag,
      hostileSource,
      undefined,
      deferred.provider,
    );
    await act(async () => {
      editor.commands.setContent('<p>Newer local document</p>', false);
    });
    deferred.resolve();

    await expect(pending).resolves.toEqual({
      status: 'conflict',
      currentRevision: null,
      currentEnvelope: null,
    });
    expect(editorRef.current!.getMarkdown()).toBe('Newer local document');
  });

  it('does not treat a selection-only transaction as a document conflict', async () => {
    const { editorRef } = await renderEditor();
    const editor = editorRef.current!.getEditor()!;
    const deferred = createDeferredDigestProvider();
    const expectedStrongEntityTag = `"sha256-${'00'.repeat(32)}"`;
    const previousEnvelope = editorRef.current!.getDocumentEnvelope()!;
    const envelope = incomingEnvelope('Selection-safe restore');

    const pending = restoreDocumentEnvelopeIfMatch(
      editor,
      expectedStrongEntityTag,
      envelope,
      undefined,
      deferred.provider,
    );
    await act(async () => {
      editor.commands.setTextSelection(1);
    });
    let result!: CwlEditorIfMatchRestoreResult;
    await act(async () => {
      deferred.resolve();
      result = await pending;
    });

    expect(result).toMatchObject({
      status: 'restored',
      previousEnvelope,
    });
    expect(editorRef.current!.getMarkdown()).toBe('## Selection-safe restore');
  });

  it.each([
    42,
    'sha256-' + '0'.repeat(64),
    `W/"sha256-${'0'.repeat(64)}"`,
    `"sha256-${'A'.repeat(64)}"`,
    `"sha512-${'0'.repeat(64)}"`,
    `"sha256-${'0'.repeat(63)}"`,
    `"sha256-${'0'.repeat(64)}"\n`,
  ])('rejects malformed expected validators before hashing: %s', async (tag) => {
    const { editorRef } = await renderEditor();
    const digestProvider: DocumentEnvelopeDigestProvider = {
      digest: vi.fn(async () => new ArrayBuffer(32)),
    };

    await expect(
      restoreDocumentEnvelopeIfMatch(
        editorRef.current!.getEditor()!,
        tag as string,
        incomingEnvelope(),
        undefined,
        digestProvider,
      ),
    ).rejects.toThrow(DocumentEnvelopeRevisionError);
    expect(digestProvider.digest).not.toHaveBeenCalled();
  });

  it('preserves the current document when incoming schema validation fails', async () => {
    const { editorRef } = await renderEditor();
    const editor = editorRef.current!.getEditor()!;
    const digestProvider = createDigestProvider();
    const revision = await createDocumentEnvelopeRevision(
      editorRef.current!.getDocumentEnvelope()!,
      undefined,
      digestProvider,
    );
    const incompatible = createDocumentEnvelope({
      type: 'doc',
      content: [{ type: 'unsupportedEnterpriseWidget' }],
    });

    await expect(
      restoreDocumentEnvelopeIfMatch(
        editor,
        revision.strongEntityTag,
        incompatible,
        undefined,
        digestProvider,
      ),
    ).rejects.toThrow(DocumentSchemaError);
    expect(editorRef.current!.getMarkdown()).toBe('Original document');
  });
});
