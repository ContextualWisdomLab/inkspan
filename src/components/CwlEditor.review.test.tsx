import {
  act,
  cleanup,
  fireEvent,
  render,
  renderHook,
  screen,
  waitFor,
} from '@testing-library/react';
import { createRef } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type {
  CwlEditorDocumentRevision,
  DocumentEnvelopeDigestProvider,
} from '../documentEnvelopeRevision.js';
import type {
  CwlEditorReviewOperationResult,
  CwlEditorReviewSuggestion,
  CwlEditorReviewTarget,
} from '../review/contract.js';
import type { CwlEditorHandle } from '../types.js';
import { EditorState, TextSelection } from '@tiptap/pm/state';
import { Schema } from '@tiptap/pm/model';
import { CwlEditor } from './CwlEditor.js';
import {
  applyReviewOperation,
  createReviewMarkerPlugin,
  findReviewRange,
  useReviewActions,
} from './reviewOperations.js';

afterEach(cleanup);

function digestProvider(): DocumentEnvelopeDigestProvider {
  return {
    digest: async (_algorithm, source) => {
      const bytes = source as Uint8Array;
      const digest = new Uint8Array(32);
      for (let index = 0; index < bytes.length; index += 1) {
        digest[index % digest.length] ^= bytes[index]!;
      }
      return digest.buffer;
    },
  };
}

function revision(fill: number): CwlEditorDocumentRevision {
  const digestHex = fill.toString(16).padStart(2, '0').repeat(32);
  return Object.freeze({
    algorithm: 'SHA-256',
    digestHex,
    strongEntityTag: `"sha256-${digestHex}"`,
  });
}

function suggestion(
  id: string,
  target: CwlEditorReviewTarget,
  kind: 'insert' | 'delete',
  expectedRevision = target.revision,
): CwlEditorReviewSuggestion {
  return kind === 'insert'
    ? {
        suggestionId: id,
        kind,
        state: 'pending',
        expectedRevision,
        target,
        text: 'X',
      }
    : {
        suggestionId: id,
        kind,
        state: 'pending',
        expectedRevision,
        target,
      };
}

describe('CwlEditor provider-neutral review integration', () => {
  it('accepts an exact insert once through the imperative handle', async () => {
    const editorRef = createRef<CwlEditorHandle>();
    render(<CwlEditor ref={editorRef} defaultValue="Hello" />);
    await waitFor(() => expect(editorRef.current?.getEditor()).not.toBeNull());

    const handle = editorRef.current!;
    const editor = handle.getEditor()!;
    act(() => {
      editor.view.dispatch(
        editor.state.tr.setSelection(
          TextSelection.create(editor.state.doc, editor.state.doc.content.size - 1),
        ),
      );
    });
    const evidence = await handle.getTextPositionSelectorEvidence(
      undefined,
      digestProvider(),
    );
    const reviewSuggestion = suggestion(
      'insert-once',
      {
        revision: evidence!.revision,
        selector: evidence!.selector,
        textProjection: evidence!.textProjection,
      },
      'insert',
    );

    let result: CwlEditorReviewOperationResult | null | undefined;
    await act(async () => {
      result = await handle.acceptReviewSuggestion(
        reviewSuggestion,
        undefined,
        digestProvider(),
      );
    });
    expect((result as CwlEditorReviewOperationResult).status).toBe('accepted');
    expect(handle.getHTML()).toContain('HelloX');
    await act(async () => {
      await expect(
        handle.acceptReviewSuggestion(reviewSuggestion, undefined, digestProvider()),
      ).rejects.toMatchObject({ code: 'operation_already_final' });
    });
  });

  it('rejects without mutation and returns stale without re-anchoring', async () => {
    const editorRef = createRef<CwlEditorHandle>();
    render(<CwlEditor ref={editorRef} defaultValue="Hello" />);
    await waitFor(() => expect(editorRef.current?.getEditor()).not.toBeNull());
    const handle = editorRef.current!;
    const editor = handle.getEditor()!;

    act(() => editor.commands.setTextSelection({ from: 1, to: 2 }));
    const evidence = await handle.getTextPositionSelectorEvidence(
      undefined,
      digestProvider(),
    );
    const deleteSuggestion = suggestion(
      'delete-reject',
      {
        revision: evidence!.revision,
        selector: evidence!.selector,
        textProjection: evidence!.textProjection,
      },
      'delete',
    );
    const rejected = await handle.rejectReviewSuggestion(
      deleteSuggestion,
      undefined,
      digestProvider(),
    );
    expect(rejected?.status).toBe('rejected');
    expect(handle.getHTML()).toContain('Hello');

    act(() => handle.setValue('Changed elsewhere'));
    const stale = await handle.acceptReviewSuggestion(
      suggestion(
        'stale-insert',
        {
          revision: evidence!.revision,
          selector: { ...evidence!.selector, start: 0, end: 0 },
          textProjection: evidence!.textProjection,
        },
        'insert',
      ),
      undefined,
      digestProvider(),
    );
    expect(stale?.status).toBe('stale');
    expect(handle.getHTML()).toContain('Changed elsewhere');
  });

  it('accepts a delete through the editor transaction boundary', async () => {
    const editorRef = createRef<CwlEditorHandle>();
    render(<CwlEditor ref={editorRef} defaultValue="Hello" />);
    await waitFor(() => expect(editorRef.current?.getEditor()).not.toBeNull());
    const handle = editorRef.current!;
    const editor = handle.getEditor()!;
    act(() => editor.commands.setTextSelection({ from: 1, to: 2 }));
    const evidence = await handle.getTextPositionSelectorEvidence(
      undefined,
      digestProvider(),
    );
    const resultBox: { value: CwlEditorReviewOperationResult | null } = { value: null };
    await act(async () => {
      resultBox.value = await handle.acceptReviewSuggestion(
        suggestion(
          'delete-once',
          {
            revision: evidence!.revision,
            selector: evidence!.selector,
            textProjection: evidence!.textProjection,
          },
          'delete',
        ),
        undefined,
        digestProvider(),
      );
    });
    expect(resultBox.value?.status).toBe('accepted');
    expect(handle.getHTML()).toContain('ello');
  });

  it('rejects a transaction that claims to accept without changing the document', async () => {
    const editorRef = createRef<CwlEditorHandle>();
    render(<CwlEditor ref={editorRef} defaultValue="Hello" />);
    await waitFor(() => expect(editorRef.current?.getEditor()).not.toBeNull());
    const handle = editorRef.current!;
    const editor = handle.getEditor()!;
    const evidence = await handle.getTextPositionSelectorEvidence(
      undefined,
      digestProvider(),
    );
    const transaction = {
      doc: editor.state.doc,
      docChanged: false,
      insertText: vi.fn(),
      delete: vi.fn(),
    };
    const fakeEditor = {
      getJSON: () => editor.getJSON(),
      state: { doc: editor.state.doc, tr: transaction },
      view: { dispatch: vi.fn() },
    } as unknown as typeof editor;
    await expect(
      applyReviewOperation(
        fakeEditor,
        {
          suggestion: suggestion(
            'no-change',
            {
              revision: evidence!.revision,
              selector: evidence!.selector,
              textProjection: evidence!.textProjection,
            },
            'insert',
          ),
          action: 'accept',
        },
        undefined,
        digestProvider(),
      ),
    ).rejects.toMatchObject({ code: 'operation_must_change_document' });
    await expect(
      applyReviewOperation(
        fakeEditor,
        {
          suggestion: suggestion(
            'out-of-range',
            {
              revision: evidence!.revision,
              selector: { ...evidence!.selector, start: 99, end: 99 },
              textProjection: evidence!.textProjection,
            },
            'insert',
          ),
          action: 'accept',
        },
        undefined,
        digestProvider(),
      ),
    ).rejects.toMatchObject({ code: 'selector_out_of_range' });
  });

  it('renders accessible panel and inline markers and reports stale actions', async () => {
    const onOperation = vi.fn();
    let readyEditor: ReturnType<CwlEditorHandle['getEditor']> = null;
    const staleTarget = {
      revision: revision(9),
      selector: { type: 'TextPositionSelector' as const, start: 0, end: 0 },
      textProjection: { id: 'inkspan-prosemirror-text' as const, version: 1 as const },
    };
    const threadTarget = {
      ...staleTarget,
      selector: { type: 'TextPositionSelector' as const, start: 0, end: 1 },
    };
    render(
      <CwlEditor
        defaultValue="Hi"
        onReady={(editor) => {
          readyEditor = editor;
        }}
        review={{
          threads: [
            {
              threadId: 'thread-1',
              target: threadTarget,
              state: 'open',
              replyCount: 1,
            },
          ],
          suggestions: [
            suggestion('stale-ui', staleTarget, 'insert'),
            suggestion('inline-ui', threadTarget, 'delete'),
          ],
          onOperation,
        }}
      />,
    );

    await waitFor(() => {
      expect(readyEditor).not.toBeNull();
      expect(findReviewRange(readyEditor!.state, staleTarget.selector)).toEqual({
        from: 1,
        to: 1,
      });
      expect(findReviewRange(readyEditor!.state, threadTarget.selector)).toEqual({
        from: 1,
        to: 2,
      });
      expect(screen.getByRole('region', { name: 'Document review' })).toBeInTheDocument();
      expect(document.querySelector('.cwl-review-marker--thread')).toBeTruthy();
      expect(document.querySelector('[data-review-id="stale-ui"]')).toBeTruthy();
      expect(document.querySelector('[data-review-id="inline-ui"]')).toBeTruthy();
    });
    fireEvent.click(screen.getAllByRole('button', { name: 'Accept' })[0]!);
    await waitFor(() => expect(onOperation).toHaveBeenCalledWith(
      expect.objectContaining({ status: 'stale', suggestionId: 'stale-ui' }),
    ));
    expect(document.querySelector('.cwl-editor__content')).toHaveTextContent('Hi');
  });

  it('fails closed for an unmappable accepted target and selects mapped review targets', async () => {
    const editorRef = createRef<CwlEditorHandle>();
    const onError = vi.fn();
    const target = {
      revision: revision(9),
      selector: { type: 'TextPositionSelector' as const, start: 99, end: 99 },
      textProjection: { id: 'inkspan-prosemirror-text' as const, version: 1 as const },
    };
    render(
      <CwlEditor
        ref={editorRef}
        defaultValue="Hi"
        review={{
          suggestions: [suggestion('unmappable', target, 'insert')],
          onError,
        }}
      />,
    );
    await waitFor(() => expect(editorRef.current?.getEditor()).not.toBeNull());
    fireEvent.click(screen.getByRole('button', { name: /unmappable/ }));
    await waitFor(() => expect(onError).toHaveBeenCalledWith(
      expect.objectContaining({ code: 'selector_out_of_range' }),
    ));
  });

  it('keeps exact-once state across panel retries and redacts host callback failures', async () => {
    const editorRef = createRef<CwlEditorHandle>();
    const onError = vi.fn();
    const rendered = render(
      <CwlEditor ref={editorRef} defaultValue="Hi" onReady={() => undefined} />,
    );
    await waitFor(() => expect(editorRef.current?.getEditor()).not.toBeNull());
    const currentRevision = await editorRef.current!.getDocumentEnvelopeRevision();
    const target = {
      revision: currentRevision!,
      selector: { type: 'TextPositionSelector' as const, start: 0, end: 0 },
      textProjection: { id: 'inkspan-prosemirror-text' as const, version: 1 as const },
    };
    const reviewSuggestion = suggestion('exact-once', target, 'insert');
    rendered.rerender(
      <CwlEditor
        ref={editorRef}
        defaultValue="Hi"
        review={{ suggestions: [reviewSuggestion], onError }}
      />,
    );
    await waitFor(() => expect(screen.getByRole('region', { name: 'Document review' })).toBeInTheDocument());
    fireEvent.click(screen.getByRole('button', { name: /exact-once/ }));
    fireEvent.click(screen.getAllByRole('button', { name: 'Accept' })[0]!);
    await waitFor(() => expect(editorRef.current!.getHTML()).toContain('XHi'));
    fireEvent.click(screen.getAllByRole('button', { name: 'Accept' })[0]!);
    await waitFor(() => expect(onError).toHaveBeenCalledWith(
      expect.objectContaining({ code: 'operation_already_final' }),
    ));
  });

  it('redacts errors from host callbacks and covers invalid structural boundaries', async () => {
    const onError = vi.fn(() => { throw new Error('presentation failed'); });
    const onOperation = vi.fn(() => { throw new Error('host failed'); });
    let readyEditor: ReturnType<CwlEditorHandle['getEditor']> = null;
    const target = {
      revision: revision(9),
      selector: { type: 'TextPositionSelector' as const, start: 0, end: 0 },
      textProjection: { id: 'inkspan-prosemirror-text' as const, version: 1 as const },
    };
    render(
      <CwlEditor
        defaultValue="😀"
        onReady={(editor) => { readyEditor = editor; }}
        review={{ suggestions: [suggestion('host-failure', target, 'insert')], onOperation, onError }}
      />,
    );
    await waitFor(() => expect(screen.getByRole('region', { name: 'Document review' })).toBeInTheDocument());
    expect(findReviewRange(
      readyEditor!.state,
      { type: 'TextPositionSelector', start: 0, end: 0 },
    )).toEqual({ from: 1, to: 1 });
    fireEvent.click(screen.getByRole('button', { name: 'Accept' }));
    await waitFor(() => expect(onOperation).toHaveBeenCalled());
  });

  it('handles review actions safely while the editor is unavailable', async () => {
    const onError = vi.fn();
    const { result } = renderHook(() => useReviewActions(null, { onError }));
    const emptySuggestion = suggestion('unavailable', {
      revision: revision(1),
      selector: { type: 'TextPositionSelector', start: 0, end: 0 },
      textProjection: { id: 'inkspan-prosemirror-text', version: 1 },
    }, 'insert');
    await act(async () => {
      await result.current.onReviewAction(emptySuggestion, 'accept');
    });
    act(() => result.current.onReviewSelect(emptySuggestion.target));
    expect(onError).not.toHaveBeenCalled();
  });

  it('returns an empty decoration set when plugin state is not installed', () => {
    const plugin = createReviewMarkerPlugin({});
    const schema = new Schema({
      nodes: {
        doc: { content: 'block+' },
        paragraph: { content: 'inline*', group: 'block' },
        text: { group: 'inline' },
      },
    });
    const state = EditorState.create({
      schema,
      doc: schema.node('doc', null, [schema.node('paragraph', null, [schema.text('Hi')])]),
    });
    expect(plugin.spec.state?.init?.({}, state)).toBeDefined();
    expect(plugin.props.decorations?.call(plugin, {} as never)).toBeDefined();
  });
});
