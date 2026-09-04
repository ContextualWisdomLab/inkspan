import { act, cleanup, render, waitFor } from '@testing-library/react';
import { createRef } from 'react';
import { afterEach, describe, expect, it } from 'vitest';
import type { DocumentEnvelopeDigestProvider } from '../documentEnvelopeRevision.js';
import type { CwlReviewSuggestion } from '../review/index.js';
import type { CwlEditorHandle } from '../types.js';
import { CwlEditor } from './CwlEditor.js';

afterEach(cleanup);

async function reviewFixture(defaultValue = 'Alpha beta') {
  const editorRef = createRef<CwlEditorHandle>();
  render(<CwlEditor ref={editorRef} mode="markdown" defaultValue={defaultValue} />);
  await waitFor(() => expect(editorRef.current?.getEditor()).not.toBeNull());
  const handle = editorRef.current!;
  const revision = await handle.getDocumentEnvelopeRevision();
  return { handle, revision: revision! };
}

function suggestion(
  revision: Awaited<ReturnType<CwlEditorHandle['getDocumentEnvelopeRevision']>>,
  kind: 'insert' | 'delete',
): CwlReviewSuggestion {
  const target = {
    contractVersion: 1 as const,
    revision: revision!,
    selector: {
      type: 'TextPositionSelector' as const,
      start: 6,
      end: kind === 'insert' ? 6 : 10,
    },
    projection: { id: 'inkspan-prosemirror-text' as const, version: 1 as const },
  };
  return kind === 'insert'
    ? { contractVersion: 1, kind, target, text: 'new ' }
    : { contractVersion: 1, kind, target };
}

describe('CwlEditor review suggestion decisions', () => {
  it.each([
    ['insert', '<p>Alpha new beta</p>'],
    ['delete', '<p>Alpha </p>'],
  ] as const)('accepts %s once and keeps it in undo/redo history', async (kind, html) => {
    const { handle, revision } = await reviewFixture();

    await act(async () => {
      await handle.applyReviewSuggestionDecision(suggestion(revision, kind), 'accept');
    });
    expect(handle.getHTML()).toBe(html);

    act(() => handle.getEditor()!.commands.undo());
    expect(handle.getHTML()).toBe('<p>Alpha beta</p>');
    act(() => handle.getEditor()!.commands.redo());
    expect(handle.getHTML()).toBe(html);

    await expect(
      handle.applyReviewSuggestionDecision(suggestion(revision, kind), 'accept'),
    ).rejects.toMatchObject({ code: 'stale_operation' });
  });

  it('rejects deterministically without creating document history', async () => {
    const { handle, revision } = await reviewFixture();
    const proposal = suggestion(revision, 'delete');

    const first = await handle.applyReviewSuggestionDecision(proposal, 'reject');
    const retry = await handle.applyReviewSuggestionDecision(proposal, 'reject');

    expect(first).toEqual(retry);
    expect(first).toMatchObject({ action: 'reject', status: 'rejected' });
    expect(handle.getHTML()).toBe('<p>Alpha beta</p>');
    let undone = true;
    act(() => {
      undone = handle.getEditor()!.commands.undo();
    });
    expect(undone).toBe(false);
  });

  it('fails stale when the editor changes while revision hashing is pending', async () => {
    const { handle, revision } = await reviewFixture();
    let release!: () => void;
    const blocked = new Promise<void>((resolve) => {
      release = resolve;
    });
    let started!: () => void;
    const hashing = new Promise<void>((resolve) => {
      started = resolve;
    });
    const provider: DocumentEnvelopeDigestProvider = {
      async digest(_algorithm, source) {
        started();
        await blocked;
        return crypto.subtle.digest('SHA-256', source);
      },
    };

    const decision = handle.applyReviewSuggestionDecision(
      suggestion(revision, 'insert'),
      'accept',
      undefined,
      provider,
    );
    await hashing;
    act(() => handle.setValue('Newer document'));
    release();

    await expect(decision).rejects.toMatchObject({ code: 'stale_operation' });
    expect(handle.getHTML()).toBe('<p>Newer document</p>');
  });

  it('does not mutate when accepted-operation evidence cannot be created', async () => {
    const { handle, revision } = await reviewFixture();
    const provider: DocumentEnvelopeDigestProvider = {
      async digest() {
        throw new Error('private digest failure');
      },
    };

    await expect(
      handle.applyReviewSuggestionDecision(
        suggestion(revision, 'insert'),
        'accept',
        undefined,
        provider,
      ),
    ).rejects.toThrow('Document envelope SHA-256 digest could not be created');
    expect(handle.getHTML()).toBe('<p>Alpha beta</p>');
  });

  it('fails stale when the editor changes while accepted evidence is created', async () => {
    const { handle, revision } = await reviewFixture();
    let digestCount = 0;
    const provider: DocumentEnvelopeDigestProvider = {
      async digest(_algorithm, source) {
        digestCount += 1;
        const digest = await crypto.subtle.digest('SHA-256', source);
        if (digestCount === 3) {
          act(() => handle.setValue('Newer document'));
        }
        return digest;
      },
    };

    await expect(
      handle.applyReviewSuggestionDecision(
        suggestion(revision, 'insert'),
        'accept',
        undefined,
        provider,
      ),
    ).rejects.toMatchObject({ code: 'stale_operation' });
    expect(handle.getHTML()).toBe('<p>Newer document</p>');
  });

  it('maps Unicode code-point offsets without splitting graphemes', async () => {
    const { handle, revision } = await reviewFixture('A😀B');
    const proposal = suggestion(revision, 'insert');
    const unicodeProposal = {
      ...proposal,
      target: {
        ...proposal.target,
        selector: { type: 'TextPositionSelector' as const, start: 2, end: 2 },
      },
    };

    await act(async () => {
      await handle.applyReviewSuggestionDecision(unicodeProposal, 'accept');
    });
    expect(handle.getHTML()).toBe('<p>A😀new B</p>');
  });

  it('maps the start of the document into its first text block', async () => {
    const { handle, revision } = await reviewFixture();
    const proposal = suggestion(revision, 'insert');

    await act(async () => {
      await handle.applyReviewSuggestionDecision(
        {
          ...proposal,
          target: {
            ...proposal.target,
            selector: { type: 'TextPositionSelector', start: 0, end: 0 },
          },
        },
        'accept',
      );
    });
    expect(handle.getHTML()).toBe('<p>new Alpha beta</p>');
  });

  it('maps offsets after a projected block separator', async () => {
    const { handle, revision } = await reviewFixture('Alpha\n\nBeta');
    const proposal = suggestion(revision, 'insert');

    await act(async () => {
      await handle.applyReviewSuggestionDecision(
        {
          ...proposal,
          target: {
            ...proposal.target,
            selector: { type: 'TextPositionSelector', start: 6, end: 6 },
          },
        },
        'accept',
      );
    });
    expect(handle.getHTML()).toBe('<p>Alpha</p><p>new Beta</p>');
  });

  it('rejects unsupported decisions and out-of-range projection offsets', async () => {
    const { handle, revision } = await reviewFixture();
    await expect(
      handle.applyReviewSuggestionDecision(
        suggestion(revision, 'insert'),
        'cancel' as 'accept',
      ),
    ).rejects.toMatchObject({ code: 'invalid_operation' });

    const proposal = suggestion(revision, 'insert');
    await expect(
      handle.applyReviewSuggestionDecision(
        {
          ...proposal,
          target: {
            ...proposal.target,
            selector: {
              type: 'TextPositionSelector',
              start: 100,
              end: 100,
            },
          },
        },
        'accept',
      ),
    ).rejects.toMatchObject({ code: 'invalid_operation' });
    expect(handle.getHTML()).toBe('<p>Alpha beta</p>');
  });
});
