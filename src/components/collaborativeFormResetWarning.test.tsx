import { act, cleanup, render, waitFor } from '@testing-library/react';
import { createRef } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import * as Y from 'yjs';
import { CollaborativeCwlEditor } from '../collaboration/CollaborativeCwlEditor.js';
import type { CwlEditorHandle } from '../types.js';

afterEach(cleanup);

/** Dispatch one native reset and allow its deferred reset observer to settle. */
async function dispatchNativeReset(form: HTMLFormElement): Promise<boolean> {
  const allowed = form.dispatchEvent(
    new Event('reset', { bubbles: true, cancelable: true }),
  );
  await new Promise<void>((resolve) => setTimeout(resolve, 0));
  return allowed;
}

describe('collaborative native-form reset test boundary', () => {
  it('does not leak React act warnings while reporting a host-owned reset', async () => {
    const collaborationDocument = new Y.Doc();
    const editorRef = createRef<CwlEditorHandle>();
    const onFormReset = vi.fn();
    const { container, unmount } = render(
      <form>
        <CollaborativeCwlEditor
          ref={editorRef}
          document={collaborationDocument}
          mode="markdown"
          hideToolbar
          formFieldName="shared_body"
          onFormReset={onFormReset}
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

    const consoleError = vi.spyOn(console, 'error');
    try {
      expect(await dispatchNativeReset(form)).toBe(true);
      expect(onFormReset).toHaveBeenCalledTimes(1);
      expect(editorRef.current!.getValue()).toContain('Shared body');

      const emittedErrors = consoleError.mock.calls
        .flat()
        .map((value) => String(value))
        .join('\n');
      expect(emittedErrors).not.toContain('not wrapped in act');
    } finally {
      consoleError.mockRestore();
      unmount();
      collaborationDocument.destroy();
    }
  });
});
