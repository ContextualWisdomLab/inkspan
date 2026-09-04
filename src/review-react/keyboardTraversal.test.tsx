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

function presentation(
  threadKey: string,
  digest: string,
  selected = false,
) {
  return {
    contractVersion: 1,
    threadKey,
    target: target(digest),
    state: 'unresolved',
    commentCount: 1,
    selected,
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

  it('clamps arrow traversal at the first and last thread without selecting either thread', () => {
    const onSelectThread = vi.fn();
    render(
      <CwlReviewThreadList
        presentations={[
          presentation('thread_1', 'a'),
          presentation('thread_2', 'b'),
          presentation('thread_3', 'c'),
        ]}
        labels={labels}
        onSelectThread={onSelectThread}
      />,
    );

    const first = screen.getByRole('button', { name: 'Thread 1' });
    const last = screen.getByRole('button', { name: 'Thread 3' });

    first.focus();
    fireEvent.keyDown(first, { key: 'ArrowUp' });
    expect(first).toHaveFocus();

    last.focus();
    fireEvent.keyDown(last, { key: 'ArrowDown' });
    expect(last).toHaveFocus();

    expect(onSelectThread).not.toHaveBeenCalled();
  });

  it('keeps exactly one thread-selection target in the tab order while arrow focus roves', () => {
    const onSelectThread = vi.fn();
    render(
      <CwlReviewThreadList
        presentations={[
          presentation('thread_1', 'a'),
          presentation('thread_2', 'b', true),
          presentation('thread_3', 'c'),
        ]}
        labels={labels}
        onSelectThread={onSelectThread}
      />,
    );

    const first = screen.getByRole('button', { name: 'Thread 1' });
    const second = screen.getByRole('button', { name: 'Thread 2' });
    const third = screen.getByRole('button', { name: 'Thread 3' });

    expect(first).toHaveAttribute('tabindex', '-1');
    expect(second).toHaveAttribute('tabindex', '0');
    expect(third).toHaveAttribute('tabindex', '-1');

    second.focus();
    fireEvent.keyDown(second, { key: 'ArrowDown' });
    expect(third).toHaveFocus();
    expect(second).toHaveAttribute('tabindex', '-1');
    expect(third).toHaveAttribute('tabindex', '0');

    fireEvent.keyDown(third, { key: 'Home' });
    expect(first).toHaveFocus();
    expect(first).toHaveAttribute('tabindex', '0');
    expect(third).toHaveAttribute('tabindex', '-1');
    expect(onSelectThread).not.toHaveBeenCalled();
  });

  it('re-homes the rover when the focused thread disappears from host presentation state', () => {
    const onSelectThread = vi.fn();
    const { rerender } = render(
      <CwlReviewThreadList
        presentations={[
          presentation('thread_1', 'a'),
          presentation('thread_2', 'b'),
          presentation('thread_3', 'c'),
        ]}
        labels={labels}
        onSelectThread={onSelectThread}
      />,
    );

    const second = screen.getByRole('button', { name: 'Thread 2' });
    fireEvent.focus(second);
    expect(second).toHaveAttribute('tabindex', '0');

    rerender(
      <CwlReviewThreadList
        presentations={[
          presentation('thread_1', 'a'),
          presentation('thread_3', 'c', true),
        ]}
        labels={labels}
        onSelectThread={onSelectThread}
      />,
    );

    const first = screen.getByRole('button', { name: 'Thread 1' });
    const selected = screen.getByRole('button', { name: 'Thread 2' });
    expect(first).toHaveAttribute('tabindex', '-1');
    expect(selected).toHaveAttribute('tabindex', '0');
    expect(onSelectThread).not.toHaveBeenCalled();
  });
});
