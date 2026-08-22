import { act, cleanup, render, screen, waitFor } from '@testing-library/react';
import { createRef } from 'react';
import { afterEach, describe, expect, it } from 'vitest';
import * as Y from 'yjs';
import type { CwlEditorHandle } from '../types.js';
import type { CwlWritingDiagnostic } from '../writingDiagnostics.js';
import { CollaborativeCwlEditor } from './CollaborativeCwlEditor.js';

function diagnostic(
  revision: NonNullable<
    Awaited<ReturnType<CwlEditorHandle['getDocumentEnvelopeRevision']>>
  >,
): CwlWritingDiagnostic {
  return {
    diagnosticId: 'default-label-diagnostic',
    documentRevision: revision,
    textProjection: {
      id: 'inkspan-prosemirror-text',
      version: 1,
    },
    selector: {
      type: 'TextPositionSelector',
      start: 0,
      end: 5,
    },
    categoryCode: 'clarity',
    priority: 'advisory',
    title: 'Clarify the action',
    explanation: 'State the requested action explicitly.',
    provenance: {
      workflowId: 'email-writing-review',
      workflowVersion: '1',
      judgePolicyVersion: 'evaluation-only-1',
    },
  };
}

afterEach(cleanup);

describe('CollaborativeCwlEditor writing-diagnostic defaults', () => {
  it('uses the default accessible guidance label when the host omits one', async () => {
    const document = new Y.Doc();
    const editorRef = createRef<CwlEditorHandle>();
    const mounted = render(
      <CollaborativeCwlEditor ref={editorRef} document={document} mode="html" />,
    );
    await waitFor(() => expect(editorRef.current?.getEditor()).toBeTruthy());
    act(() => editorRef.current!.setValue('<p>Alpha beta gamma</p>'));
    const revision = await editorRef.current!.getDocumentEnvelopeRevision();
    expect(revision).not.toBeNull();

    mounted.rerender(
      <CollaborativeCwlEditor
        ref={editorRef}
        document={document}
        mode="html"
        writingDiagnostics={[diagnostic(revision!)]}
      />,
    );

    await waitFor(() =>
      expect(
        screen.getByRole('region', { name: 'Writing guidance' }),
      ).toHaveTextContent('1 writing diagnostics'),
    );
  });
});
