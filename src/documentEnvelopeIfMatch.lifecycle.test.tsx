import { render, waitFor } from '@testing-library/react';
import { createRef } from 'react';
import { describe, expect, it, vi } from 'vitest';
import { CwlEditor } from './components/CwlEditor.js';
import type { DocumentEnvelopeDigestProvider } from './documentEnvelopeRevision.js';
import { restoreDocumentEnvelopeIfMatch } from './documentEnvelopeIfMatch.js';
import type { CwlEditorHandle } from './types.js';

function createDeferredDigestProvider(): {
  provider: DocumentEnvelopeDigestProvider;
  resolve: () => void;
} {
  let resolveDigest!: (value: ArrayBuffer) => void;
  const digestPromise = new Promise<ArrayBuffer>((resolve) => {
    resolveDigest = resolve;
  });
  return {
    provider: { digest: vi.fn(() => digestPromise) },
    resolve: () => resolveDigest(new ArrayBuffer(32)),
  };
}

function createHostileSource(): object {
  return Object.defineProperty({}, 'schemaId', {
    enumerable: true,
    get() {
      throw new Error('destroyed-editor-source-must-not-be-read');
    },
  });
}

async function renderLifecycleEditor(): Promise<{
  editor: NonNullable<ReturnType<CwlEditorHandle['getEditor']>>;
  unmount: () => void;
}> {
  const editorRef = createRef<CwlEditorHandle>();
  const rendered = render(
    <CwlEditor
      ref={editorRef}
      mode="markdown"
      defaultValue="Editor lifecycle document"
    />,
  );
  await waitFor(() => expect(editorRef.current?.getEditor()).toBeTruthy());
  return {
    editor: editorRef.current!.getEditor()!,
    unmount: rendered.unmount,
  };
}

describe('revision-guarded restore lifecycle', () => {
  it('returns a conflict without reading input when the editor is destroyed during hashing', async () => {
    const { editor, unmount } = await renderLifecycleEditor();
    const deferred = createDeferredDigestProvider();
    const expectedStrongEntityTag = `"sha256-${'00'.repeat(32)}"`;

    const pending = restoreDocumentEnvelopeIfMatch(
      editor,
      expectedStrongEntityTag,
      createHostileSource(),
      undefined,
      deferred.provider,
    );

    unmount();
    await waitFor(() => expect(editor.isDestroyed).toBe(true));
    deferred.resolve();

    await expect(pending).resolves.toEqual({
      status: 'conflict',
      currentRevision: null,
      currentEnvelope: null,
    });
  });

  it('returns a conflict before hashing or source access for an already destroyed editor', async () => {
    const { editor, unmount } = await renderLifecycleEditor();
    const digestProvider: DocumentEnvelopeDigestProvider = {
      digest: vi.fn(async () => new ArrayBuffer(32)),
    };
    const expectedStrongEntityTag = `"sha256-${'00'.repeat(32)}"`;
    unmount();
    await waitFor(() => expect(editor.isDestroyed).toBe(true));

    await expect(
      restoreDocumentEnvelopeIfMatch(
        editor,
        expectedStrongEntityTag,
        createHostileSource(),
        undefined,
        digestProvider,
      ),
    ).resolves.toEqual({
      status: 'conflict',
      currentRevision: null,
      currentEnvelope: null,
    });
    expect(digestProvider.digest).not.toHaveBeenCalled();
  });
});
