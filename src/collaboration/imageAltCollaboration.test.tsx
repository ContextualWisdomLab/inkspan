import { act, cleanup, render, waitFor } from '@testing-library/react';
import { createRef } from 'react';
import { afterEach, describe, expect, it } from 'vitest';
import * as Y from 'yjs';
import type { CwlEditorHandle } from '../types.js';
import { CollaborativeCwlEditor } from './CollaborativeCwlEditor.js';

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

describe('collaborative image alternatives', () => {
  it('converges meaningful and decorative alt changes', async () => {
    const leftDocument = new Y.Doc();
    const rightDocument = new Y.Doc();
    const disconnect = connectDocuments(leftDocument, rightDocument);
    const leftRef = createRef<CwlEditorHandle>();
    const rightRef = createRef<CwlEditorHandle>();

    render(
      <div>
        <CollaborativeCwlEditor
          ref={leftRef}
          document={leftDocument}
          mode="html"
          hideToolbar
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
        '<img src="data:image/png;base64,AAAA" alt="Architecture diagram">',
      ),
    );
    await waitFor(() =>
      expect(rightRef.current!.getHTML()).toContain(
        'alt="Architecture diagram"',
      ),
    );

    act(() => {
      const editor = leftRef.current!.getEditor()!;
      editor.commands.setNodeSelection(0);
      editor.commands.updateAttributes('image', { alt: '' });
    });
    await waitFor(() =>
      expect(rightRef.current!.getHTML()).toContain('alt=""'),
    );
    disconnect();
  });
});
