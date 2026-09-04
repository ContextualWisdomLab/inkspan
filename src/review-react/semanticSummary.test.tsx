import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { CwlReviewPresentationError } from '../review/index.js';
import {
  CwlReviewThreadList,
  type CwlReviewThreadListLabels,
} from './index.js';

afterEach(cleanup);

function presentation(
  threadKey: string,
  state: 'unresolved' | 'resolved',
  commentCount: number,
) {
  const digestHex = (threadKey === 'thread_1' ? 'a' : 'b').repeat(64);
  return {
    contractVersion: 1,
    threadKey,
    target: {
      contractVersion: 1,
      revision: {
        algorithm: 'SHA-256',
        digestHex,
        strongEntityTag: `"sha256-${digestHex}"`,
      },
      selector: {
        type: 'TextPositionSelector',
        start: 3,
        end: 8,
      },
      projection: {
        id: 'inkspan-prosemirror-text',
        version: 1,
      },
    },
    state,
    commentCount,
    selected: false,
    canReply: true,
    canResolve: state === 'unresolved',
  };
}

const labels = {
  region: 'Document review',
  thread: (_thread: unknown, index: number) => `Thread ${index + 1}`,
  status: (thread: { readonly state: 'unresolved' | 'resolved' }) =>
    thread.state === 'resolved' ? 'Resolved' : 'Unresolved',
  comments: (thread: { readonly commentCount: number }) =>
    `${thread.commentCount} comments`,
  reply: 'Reply',
  resolve: 'Resolve',
} as unknown as CwlReviewThreadListLabels;

describe('CwlReviewThreadList semantic summaries', () => {
  it('renders host-localized status and count text as the accessible description for each thread and action', () => {
    render(
      <CwlReviewThreadList
        presentations={[
          presentation('thread_1', 'unresolved', 2),
          presentation('thread_2', 'resolved', 5),
        ]}
        labels={labels}
        onSelectThread={vi.fn()}
        onReplyThread={vi.fn()}
        onResolveThread={vi.fn()}
      />,
    );

    const firstThread = screen.getByRole('button', { name: 'Thread 1' });
    const secondThread = screen.getByRole('button', { name: 'Thread 2' });
    expect(firstThread).toHaveAccessibleDescription('Unresolved 2 comments');
    expect(secondThread).toHaveAccessibleDescription('Resolved 5 comments');
    expect(screen.getByText('Unresolved')).toBeVisible();
    expect(screen.getByText('Resolved')).toBeVisible();
    expect(screen.getByText('2 comments')).toBeVisible();
    expect(screen.getByText('5 comments')).toBeVisible();

    expect(
      screen.getByRole('button', { name: 'Reply — Thread 1' }),
    ).toHaveAccessibleDescription('Unresolved 2 comments');
    expect(
      screen.getByRole('button', { name: 'Resolve — Thread 1' }),
    ).toHaveAccessibleDescription('Unresolved 2 comments');
  });

  it('fails closed when only one semantic-summary label factory is supplied', () => {
    const incompleteLabels = {
      region: 'Document review',
      thread: () => 'Thread 1',
      status: () => 'Unresolved',
      reply: 'Reply',
      resolve: 'Resolve',
    } as unknown as CwlReviewThreadListLabels;

    expect(() =>
      render(
        <CwlReviewThreadList
          presentations={[presentation('thread_1', 'unresolved', 2)]}
          labels={incompleteLabels}
          onSelectThread={vi.fn()}
        />,
      ),
    ).toThrow('Review presentation metadata is invalid.');
  });

  it('normalizes a thrown semantic-summary label failure to the public presentation error', () => {
    const privateFailureLabels = {
      ...labels,
      status: () => {
        throw new Error('private host localization failure');
      },
    } as unknown as CwlReviewThreadListLabels;

    expect(() =>
      render(
        <CwlReviewThreadList
          presentations={[presentation('thread_1', 'unresolved', 2)]}
          labels={privateFailureLabels}
          onSelectThread={vi.fn()}
        />,
      ),
    ).toThrowError(CwlReviewPresentationError);
  });
});
