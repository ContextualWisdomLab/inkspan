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

describe('collaborative hyperlink policy', () => {
  it('rejects an unsafe direct mark before it reaches the shared Yjs document', async () => {
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
        '<p><a href="/documents/current">shared link</a></p>',
      ),
    );
    await waitFor(() =>
      expect(rightRef.current!.getHTML()).toContain(
        'href="/documents/current"',
      ),
    );

    act(() => {
      const editor = leftRef.current!.getEditor()!;
      const unsafeLink = editor.schema.marks.link.create({
        href: 'javascript:alert(1)',
      });
      editor.view.dispatch(editor.state.tr.addMark(1, 12, unsafeLink));
    });

    await waitFor(() => {
      expect(leftRef.current!.getHTML()).toContain(
        'href="/documents/current"',
      );
      expect(rightRef.current!.getHTML()).toContain(
        'href="/documents/current"',
      );
    });
    expect(leftRef.current!.getHTML()).not.toContain('javascript:');
    expect(rightRef.current!.getHTML()).not.toContain('javascript:');
    disconnect();
  });
});
