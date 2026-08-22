import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { createReviewThreadPresentation } from '../review/index.js';
import { CwlReviewThreadList } from './index.js';

afterEach(cleanup);

function target(digest = 'a') {
  const digestHex = digest.repeat(64);
  return {
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
  };
}

function presentation(
  threadKey: string,
  overrides: Record<string, unknown> = {},
) {
  return {
    contractVersion: 1,
    threadKey,
    target: target(threadKey === 'thread_1' ? 'a' : 'b'),
    state: 'unresolved',
    commentCount: 2,
    selected: false,
    canReply: true,
    canResolve: true,
    ...overrides,
  };
}

const labels = {
  region: 'Document review',
  thread: (thread: ReturnType<typeof createReviewThreadPresentation>, index: number) =>
    `Thread ${index + 1}: ${thread.state}, ${thread.commentCount} comments`,
  reply: 'Reply',
  resolve: 'Resolve',
};

function expectInvalidLabels(candidate: unknown) {
  expect(() =>
    render(
      <CwlReviewThreadList
        presentations={[presentation('thread_1')]}
        labels={candidate as typeof labels}
        onSelectThread={vi.fn()}
      />,
    ),
  ).toThrow('Review presentation metadata is invalid.');
}

describe('CwlReviewThreadList', () => {
  it('renders a controlled accessible thread list and emits detached presentation intents', () => {
    const onSelectThread = vi.fn();
    const onReplyThread = vi.fn();
    const onResolveThread = vi.fn();
    const first = presentation('thread_1', { selected: true });
    const second = presentation('thread_2', {
      state: 'resolved',
      canReply: false,
      canResolve: true,
    });

    render(
      <CwlReviewThreadList
        presentations={[first, second]}
        labels={labels}
        onSelectThread={onSelectThread}
        onReplyThread={onReplyThread}
        onResolveThread={onResolveThread}
      />,
    );

    const region = screen.getByRole('region', { name: 'Document review' });
    expect(region).toBeInTheDocument();

    const firstThread = screen.getByRole('button', {
      name: 'Thread 1: unresolved, 2 comments',
    });
    const secondThread = screen.getByRole('button', {
      name: 'Thread 2: resolved, 2 comments',
    });
    expect(firstThread).toHaveAttribute('aria-pressed', 'true');
    expect(secondThread).toHaveAttribute('aria-pressed', 'false');

    fireEvent.click(secondThread);
    expect(onSelectThread).toHaveBeenCalledTimes(1);
    const selected = onSelectThread.mock.calls[0]?.[0] as ReturnType<
      typeof createReviewThreadPresentation
    >;
    expect(selected.threadKey).toBe('thread_2');
    expect(selected).not.toBe(second);
    expect(Object.isFrozen(selected)).toBe(true);

    const replyButtons = screen.getAllByRole('button', { name: 'Reply' });
    const resolveButtons = screen.getAllByRole('button', { name: 'Resolve' });
    expect(replyButtons[0]).toBeEnabled();
    expect(replyButtons[1]).toBeDisabled();
    expect(resolveButtons[0]).toBeEnabled();
    expect(resolveButtons[1]).toBeDisabled();

    fireEvent.click(replyButtons[0]!);
    fireEvent.click(resolveButtons[0]!);
    expect(onReplyThread).toHaveBeenCalledWith(expect.objectContaining({ threadKey: 'thread_1' }));
    expect(onResolveThread).toHaveBeenCalledWith(
      expect.objectContaining({ threadKey: 'thread_1' }),
    );
  });

  it('keeps capability booleans presentation-only when host action callbacks are absent', () => {
    render(
      <CwlReviewThreadList
        presentations={[presentation('thread_1')]}
        labels={labels}
        onSelectThread={vi.fn()}
      />,
    );

    expect(screen.getByRole('button', { name: 'Reply' })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Resolve' })).toBeDisabled();
  });

  it('fails closed before rendering duplicate host thread keys', () => {
    const first = presentation('thread_1');
    const duplicate = presentation('thread_1', { selected: true });

    expect(() =>
      render(
        <CwlReviewThreadList
          presentations={[first, duplicate]}
          labels={labels}
          onSelectThread={vi.fn()}
        />,
      ),
    ).toThrow(/Review presentation metadata is invalid/u);
    expect(screen.queryByRole('region', { name: 'Document review' })).not.toBeInTheDocument();
  });

  it('fails closed before invoking malformed presentation collection behavior', () => {
    const privateSentinel = 'private-presentation-collection-must-not-leak';
    const hostileCollection = Object.defineProperty({}, 'map', {
      enumerable: true,
      get() {
        throw new Error(privateSentinel);
      },
    }) as unknown as readonly unknown[];

    expect(() =>
      render(
        <CwlReviewThreadList
          presentations={hostileCollection}
          labels={labels}
          onSelectThread={vi.fn()}
        />,
      ),
    ).toThrow('Review presentation metadata is invalid.');
    expect(screen.queryByRole('region', { name: 'Document review' })).not.toBeInTheDocument();
  });

  it('fails closed through the review contract before rendering hostile thread metadata', () => {
    const hostile = presentation('thread_1', {
      commentBody: 'private-body-must-not-render',
    });

    expect(() =>
      render(
        <CwlReviewThreadList
          presentations={[hostile]}
          labels={labels}
          onSelectThread={vi.fn()}
        />,
      ),
    ).toThrow(/Review presentation metadata is invalid/u);
    expect(screen.queryByText('private-body-must-not-render')).not.toBeInTheDocument();
  });

  it('fails closed before invoking accessor-backed or inaccessible host labels', () => {
    const privateSentinel = 'private-review-label-must-not-leak';
    let regionGetterCalls = 0;
    const hostileLabels = {
      thread: labels.thread,
      reply: labels.reply,
      resolve: labels.resolve,
    } as Record<string, unknown>;
    Object.defineProperty(hostileLabels, 'region', {
      enumerable: true,
      get() {
        regionGetterCalls += 1;
        throw new Error(privateSentinel);
      },
    });

    expectInvalidLabels(hostileLabels);
    expect(regionGetterCalls).toBe(0);
    expect(screen.queryByRole('region')).not.toBeInTheDocument();

    expectInvalidLabels({ ...labels, region: '' });
    expectInvalidLabels({ ...labels, region: 'x'.repeat(513) });
  });

  it('rejects malformed host label containers and descriptor shapes', () => {
    expectInvalidLabels(null);
    expectInvalidLabels({
      region: labels.region,
      thread: labels.thread,
      reply: labels.reply,
      unexpected: labels.resolve,
    });
    expectInvalidLabels({
      region: labels.region,
      thread: labels.thread,
      reply: labels.reply,
      [Symbol('resolve')]: labels.resolve,
    });
    expectInvalidLabels({ ...labels, thread: 'not-a-function' });

    const hiddenRegion = { ...labels };
    Object.defineProperty(hiddenRegion, 'region', {
      configurable: true,
      enumerable: false,
      value: labels.region,
    });
    expectInvalidLabels(hiddenRegion);

    const missingDescriptor = new Proxy(
      {},
      {
        ownKeys: () => ['region', 'thread', 'reply', 'resolve'],
        getOwnPropertyDescriptor: () => undefined,
      },
    );
    expectInvalidLabels(missingDescriptor);
  });

  it('fails closed on invalid or throwing per-thread accessible labels', () => {
    expectInvalidLabels({ ...labels, thread: () => '' });

    const privateSentinel = 'private-thread-label-must-not-leak';
    expectInvalidLabels({
      ...labels,
      thread() {
        throw new Error(privateSentinel);
      },
    });
  });
});
