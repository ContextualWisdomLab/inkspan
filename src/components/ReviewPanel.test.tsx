import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import type { CwlEditorReviewProps } from '../types.js';
import type { CwlEditorReviewTarget } from '../review/contract.js';
import { ReviewPanel } from './ReviewPanel.js';

function target(): CwlEditorReviewTarget {
  const digestHex = '01'.repeat(32);
  return {
    revision: {
      algorithm: 'SHA-256',
      digestHex,
      strongEntityTag: `"sha256-${digestHex}"`,
    },
    selector: { type: 'TextPositionSelector', start: 0, end: 1 },
    textProjection: { id: 'inkspan-prosemirror-text', version: 1 },
  };
}

function panel(
  review: CwlEditorReviewProps,
  onAction: CwlEditorReviewProps['onOperation'] = vi.fn(),
  editable = true,
) {
  return render(
    <ReviewPanel
      review={review}
      editable={editable}
      onAction={async (suggestion, action) => {
        await onAction?.({
          schemaId: 'https://inkspan.io/schemas/review/v1',
          schemaVersion: 1,
          suggestionId: suggestion.suggestionId,
          action,
          status: action === 'accept' ? 'accepted' : 'rejected',
          beforeRevision: suggestion.expectedRevision,
        });
      }}
      onSelect={vi.fn()}
    />,
  );
}

describe('ReviewPanel', () => {
  it('selects comment targets through the host callback', () => {
    const onSelect = vi.fn();
    render(
      <ReviewPanel
        review={{
          threads: [{
            threadId: 'thread',
            target: target(),
            state: 'open',
            replyCount: 0,
          }],
        }}
        onAction={async () => undefined}
        onSelect={onSelect}
      />,
    );
    fireEvent.click(screen.getByRole('button', { name: /thread/ }));
    expect(onSelect).toHaveBeenCalledWith(expect.objectContaining({ selector: target().selector }));
  });

  it('renders empty state and disables finalized delete suggestions', () => {
    panel({
      suggestions: [{
        suggestionId: 'done-delete',
        kind: 'delete',
        state: 'accepted',
        expectedRevision: target().revision,
        target: target(),
      }],
    });
    expect(screen.queryByText('No suggestions.')).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Accept/ })).toBeDisabled();
    expect(screen.getByRole('button', { name: /Reject/ })).toBeDisabled();
  });

  it('renders the empty suggestions state and completes both action handlers', async () => {
    const onAction = vi.fn();
    const review: CwlEditorReviewProps = {
      suggestions: [
        {
          suggestionId: 'insert',
          kind: 'insert',
          state: 'pending',
          expectedRevision: target().revision,
          target: { ...target(), selector: { ...target().selector, end: 0 } },
          text: 'x',
        },
        {
          suggestionId: 'delete',
          kind: 'delete',
          state: 'pending',
          expectedRevision: target().revision,
          target: target(),
        },
      ],
    };
    const { rerender } = render(
      <ReviewPanel
        review={review}
        onAction={async (suggestion, action) => {
          onAction(suggestion.suggestionId, action);
        }}
        onSelect={vi.fn()}
      />,
    );
    fireEvent.click(screen.getAllByRole('button', { name: 'Accept' })[0]!);
    fireEvent.click(screen.getAllByRole('button', { name: 'Reject' })[1]!);
    await waitFor(() => expect(onAction).toHaveBeenCalledTimes(2));
    expect(onAction).toHaveBeenNthCalledWith(1, 'insert', 'accept');
    expect(onAction).toHaveBeenNthCalledWith(2, 'delete', 'reject');

    rerender(<ReviewPanel review={{}} onAction={async () => undefined} onSelect={vi.fn()} />);
    expect(screen.getByText('No suggestions.')).toBeInTheDocument();
  });

  it('marks an action busy until the host operation settles', async () => {
    let resolveAction: (() => void) | undefined;
    const onAction = vi.fn(() => new Promise<void>((resolve) => {
      resolveAction = resolve;
    }));
    const review: CwlEditorReviewProps = {
      suggestions: [{
        suggestionId: 'busy',
        kind: 'insert',
        state: 'pending',
        expectedRevision: target().revision,
        target: { ...target(), selector: { ...target().selector, end: 0 } },
        text: 'x',
      }],
    };
    render(
      <ReviewPanel
        review={review}
        onAction={onAction}
        onSelect={vi.fn()}
      />,
    );
    const accept = screen.getByRole('button', { name: 'Accept' });
    fireEvent.click(accept);
    await waitFor(() => expect(accept).toBeDisabled());
    resolveAction?.();
    await waitFor(() => expect(accept).not.toBeDisabled());
  });

  it('disables document-mutating review actions when the editor is read-only', () => {
    const onAction = vi.fn();
    panel({
      suggestions: [{
        suggestionId: 'permission-disabled',
        kind: 'insert',
        state: 'pending',
        expectedRevision: target().revision,
        target: { ...target(), selector: { ...target().selector, end: 0 } },
        text: 'x',
      }],
    }, onAction, false);

    const accept = screen.getByRole('button', { name: 'Accept' });
    const reject = screen.getByRole('button', { name: 'Reject' });
    expect(accept).toBeDisabled();
    expect(reject).toBeDisabled();
    fireEvent.click(accept);
    fireEvent.click(reject);
    expect(onAction).not.toHaveBeenCalled();
  });
});
