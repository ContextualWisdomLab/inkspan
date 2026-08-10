import { act, cleanup, render, waitFor } from '@testing-library/react';
import { createRef } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import * as Y from 'yjs';
import { CollaborativeCwlEditor } from '../collaboration/CollaborativeCwlEditor.js';
import type { CwlEditorHandle } from '../types.js';

afterEach(cleanup);

describe('collaborative native-form reset test boundary', () => {
  it('does not emit a React act warning while observing the reset lifecycle', async () => {
    const collaborationDocument = new Y.Doc();
    const editorRef = createRef<CwlEditorHandle>();
    const consoleError = vi
      .spyOn(console, 'error')
      .mockImplementation(() => undefined);

    try {
      const { container, unmount } = render(
        <form>
          <CollaborativeCwlEditor
            ref={editorRef}
            document={collaborationDocument}
            mode="markdown"
            hideToolbar
            formFieldName="shared_body"
            onFormReset={() => undefined}
          />
        </form>,
      );
      const form = container.querySelector('form')!;

      await waitFor(() => expect(editorRef.current).toBeTruthy());
      act(() => {
        editorRef.current!.insertValue('Shared body');
      });
      await waitFor(() =>
        expect(new FormData(form).get('shared_body')).toContain('Shared body'),
      );

      form.dispatchEvent(
        new Event('reset', { bubbles: true, cancelable: true }),
      );
      await new Promise<void>((resolve) => setTimeout(resolve, 0));

      const diagnostics = consoleError.mock.calls.flat().join('\n');
      expect(diagnostics).not.toContain('not wrapped in act');

      unmount();
    } finally {
      consoleError.mockRestore();
      collaborationDocument.destroy();
    }
  });
});
