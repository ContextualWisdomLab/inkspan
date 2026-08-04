import { render, waitFor } from '@testing-library/react';
import { createRef } from 'react';
import { describe, expect, it, vi } from 'vitest';
import { CwlEditor } from './components/CwlEditor.js';
import {
  type DocumentEnvelopeDigestProvider,
} from './documentEnvelopeRevision.js';
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

describe('revision-guarded restore lifecycle', () => {
  it('returns a conflict without reading input when the editor is destroyed during hashing', async () => {
    const editorRef = createRef<CwlEditorHandle>();
    const { unmount } = render(
      <CwlEditor
        ref={editorRef}
        mode="markdown"
        defaultValue="Editor lifecycle document"
      />,
    );
    await waitFor(() => expect(editorRef.current?.getEditor()).toBeTruthy());

    const editor = editorRef.current!.getEditor()!;
    const deferred = createDeferredDigestProvider();
    const expectedStrongEntityTag = `"sha256-${'00'.repeat(32)}"`;
    const hostileSource = Object.defineProperty({}, 'schemaId', {
      enumerable: true,
      get() {
        throw new Error('destroyed-editor-source-must-not-be-read');
      },
    });

    const pending = restoreDocumentEnvelopeIfMatch(
      editor,
      expectedStrongEntityTag,
      hostileSource,
      undefined,
      deferred.provider,
    );

    unmount();
    expect(editor.isDestroyed).toBe(true);
    deferred.resolve();

    await expect(pending).resolves.toEqual({
      status: 'conflict',
      currentRevision: null,
    });
  });
});
