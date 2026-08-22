import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { CwlReviewThreadList } from './index.js';

afterEach(cleanup);

function target(digest: string) {
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

function presentation(threadKey: string, digest: string) {
  return {
    contractVersion: 1,
    threadKey,
    target: target(digest),
    state: 'unresolved',
    commentCount: 1,
    selected: false,
    canReply: false,
    canResolve: false,
  };
}

const labels = {
  region: 'Document review',
  thread: (_thread: unknown, index: number) => `Thread ${index + 1}`,
  reply: 'Reply',
  resolve: 'Resolve',
};

describe('CwlReviewThreadList keyboard traversal', () => {
  it('moves focus between thread targets without committing host selection', () => {
    const onSelectThread = vi.fn();
    render(
      <CwlReviewThreadList
        presentations={[
          presentation('thread_1', 'a'),
          presentation('thread_2', 'b'),
        ]}
        labels={labels}
        onSelectThread={onSelectThread}
      />,
    );

    const first = screen.getByRole('button', { name: 'Thread 1' });
    const second = screen.getByRole('button', { name: 'Thread 2' });

    first.focus();
    fireEvent.keyDown(first, { key: 'Tab' });
    expect(first).toHaveFocus();

    fireEvent.keyDown(first, { key: 'ArrowDown' });
    expect(second).toHaveFocus();
    expect(onSelectThread).not.toHaveBeenCalled();

    fireEvent.keyDown(second, { key: 'ArrowUp' });
    expect(first).toHaveFocus();

    fireEvent.keyDown(first, { key: 'End' });
    expect(second).toHaveFocus();

    fireEvent.keyDown(second, { key: 'Home' });
    expect(first).toHaveFocus();
  });
});
