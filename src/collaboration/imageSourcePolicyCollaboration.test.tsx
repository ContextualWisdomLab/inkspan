import { act, cleanup, render, waitFor } from '@testing-library/react';
import { createRef } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import * as Y from 'yjs';
import { Base64ImageSourceError } from '../extensions/Base64Image.js';
import type { CwlEditorHandle } from '../types.js';
import { CollaborativeCwlEditor } from './CollaborativeCwlEditor.js';

const VALID_IMAGE = 'data:image/png;base64,AAAA';

afterEach(cleanup);

function connectDocuments(left: Y.Doc, right: Y.Doc): () => void {
  const forward = (update: Uint8Array, origin: unknown) => {
    if (origin !== right) Y.applyUpdate(right, update, left);
  };
  const reverse = (update: Uint8Array, origin: unknown) => {
    if (origin !== left) Y.applyUpdate(left, update, right);
  };
  left.on('update', forward);
  right.on('update', reverse);
  return () => {
    left.off('update', forward);
    right.off('update', reverse);
  };
}

describe('collaborative image source policy', () => {
  it('rejects an unsafe local source change before it reaches the shared Yjs document', async () => {
    const leftDocument = new Y.Doc();
    const rightDocument = new Y.Doc();
    const disconnect = connectDocuments(leftDocument, rightDocument);
    const leftRef = createRef<CwlEditorHandle>();
    const rightRef = createRef<CwlEditorHandle>();
    const onImageError = vi.fn();

    render(
      <div>
        <CollaborativeCwlEditor
          ref={leftRef}
          document={leftDocument}
          mode="html"
          hideToolbar
          onImageError={onImageError}
        />
        <CollaborativeCwlEditor
          ref={rightRef}
          document={rightDocument}
          mode="html"
          hideToolbar
        />
      </div>,
    );
    await waitFor(() => {
      expect(leftRef.current?.getEditor()).toBeTruthy();
      expect(rightRef.current?.getEditor()).toBeTruthy();
    });

    act(() =>
      leftRef.current!.setValue(
        `<img src="${VALID_IMAGE}" alt="Architecture diagram">`,
      ),
    );
    await waitFor(() =>
      expect(rightRef.current!.getHTML()).toContain(VALID_IMAGE),
    );

    act(() => {
      const editor = leftRef.current!.getEditor()!;
      editor.commands.setNodeSelection(0);
      editor.commands.updateAttributes('image', {
        src: 'https://tracker.example/pixel.png',
      });
    });

    await waitFor(() => {
      expect(leftRef.current!.getHTML()).toContain(VALID_IMAGE);
      expect(rightRef.current!.getHTML()).toContain(VALID_IMAGE);
    });
    expect(leftRef.current!.getHTML()).not.toContain('tracker.example');
    expect(rightRef.current!.getHTML()).not.toContain('tracker.example');
    expect(onImageError).toHaveBeenCalledWith(
      expect.any(Base64ImageSourceError),
    );
    disconnect();
  });
});
