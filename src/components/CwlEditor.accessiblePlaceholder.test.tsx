import { cleanup, render, screen, waitFor } from '@testing-library/react';
import { createRef } from 'react';
import { afterEach, describe, expect, it } from 'vitest';
import * as Y from 'yjs';
import { CollaborativeCwlEditor } from '../collaboration/CollaborativeCwlEditor.js';
import type { CwlEditorHandle } from '../types.js';
import { CwlEditor } from './CwlEditor.js';

afterEach(cleanup);

const visualPlaceholder = (textbox: HTMLElement): string | null =>
  textbox.querySelector('[data-placeholder]')?.getAttribute('data-placeholder') ??
  null;

describe('accessible editor placeholder semantics', () => {
  it('keeps standalone visual and semantic placeholder guidance normalized together', async () => {
    const editorRef = createRef<CwlEditorHandle>();
    const { rerender } = render(
      <CwlEditor
        ref={editorRef}
        ariaLabel="Report editor"
        placeholder="  Start the report…  "
      />,
    );

    const textbox = await screen.findByRole('textbox', { name: 'Report editor' });
    await waitFor(() => expect(editorRef.current?.getEditor()).not.toBeNull());
    const editor = editorRef.current!.getEditor();
    expect(textbox).toHaveAttribute('aria-placeholder', 'Start the report…');
    expect(visualPlaceholder(textbox)).toBe('Start the report…');

    rerender(
      <CwlEditor
        ref={editorRef}
        ariaLabel="Report editor"
        placeholder="Continue with evidence…"
      />,
    );
    await waitFor(() =>
      expect(textbox).toHaveAttribute(
        'aria-placeholder',
        'Continue with evidence…',
      ),
    );
    expect(visualPlaceholder(textbox)).toBe('Continue with evidence…');
    expect(editorRef.current!.getEditor()).toBe(editor);

    rerender(
      <CwlEditor
        ref={editorRef}
        ariaLabel="Report editor"
        placeholder="   "
      />,
    );
    await waitFor(() => expect(textbox).not.toHaveAttribute('aria-placeholder'));
    expect(visualPlaceholder(textbox)).toBeNull();
    expect(editorRef.current!.getEditor()).toBe(editor);
  });

  it('keeps collaborative visual and semantic placeholder updates Yjs-preserving', async () => {
    const collaborationDocument = new Y.Doc();
    const editorRef = createRef<CwlEditorHandle>();
    try {
      const { rerender } = render(
        <CollaborativeCwlEditor
          ref={editorRef}
          document={collaborationDocument}
          ariaLabel="Shared report editor"
          placeholder="  Shared report…  "
          hideToolbar
        />,
      );

      const textbox = await screen.findByRole('textbox', {
        name: 'Shared report editor',
      });
      await waitFor(() => expect(editorRef.current?.getEditor()).not.toBeNull());
      const editor = editorRef.current!.getEditor();
      const sharedFragment = collaborationDocument.getXmlFragment('default');
      expect(textbox).toHaveAttribute('aria-placeholder', 'Shared report…');
      expect(visualPlaceholder(textbox)).toBe('Shared report…');

      rerender(
        <CollaborativeCwlEditor
          ref={editorRef}
          document={collaborationDocument}
          ariaLabel="Shared report editor"
          placeholder="Review together…"
          hideToolbar
        />,
      );
      await waitFor(() =>
        expect(textbox).toHaveAttribute('aria-placeholder', 'Review together…'),
      );
      expect(visualPlaceholder(textbox)).toBe('Review together…');
      expect(editorRef.current!.getEditor()).toBe(editor);
      expect(collaborationDocument.getXmlFragment('default')).toBe(sharedFragment);
    } finally {
      collaborationDocument.destroy();
    }
  });
});
