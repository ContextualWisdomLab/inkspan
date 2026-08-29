import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { createReviewThreadPresentation } from '../review/index.js';
import { CwlReviewTargetMarker } from './index.js';

afterEach(cleanup);

function presentation(overrides: Record<string, unknown> = {}) {
  const digestHex = 'a'.repeat(64);
  return {
    contractVersion: 1,
    threadKey: 'thread_1',
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
    state: 'unresolved',
    commentCount: 2,
    selected: true,
    canReply: true,
    canResolve: true,
    ...overrides,
  };
}

describe('CwlReviewTargetMarker', () => {
  it('renders one accessible controlled inline target marker and emits only a detached host intent', () => {
    const source = presentation();
    const onSelectThread = vi.fn();

    render(
      <CwlReviewTargetMarker
        presentation={source}
        label="Review target: unresolved, 2 comments"
        onSelectThread={onSelectThread}
      />,
    );

    const marker = screen.getByRole('button', {
      name: 'Review target: unresolved, 2 comments',
    });
    expect(marker).toHaveAttribute('aria-pressed', 'true');
    expect(marker).toHaveAttribute('data-cwl-review-state', 'unresolved');

    fireEvent.click(marker);
    expect(onSelectThread).toHaveBeenCalledTimes(1);
    const selected = onSelectThread.mock.calls[0]?.[0] as ReturnType<
      typeof createReviewThreadPresentation
    >;
    expect(selected.threadKey).toBe('thread_1');
    expect(selected).not.toBe(source);
    expect(Object.isFrozen(selected)).toBe(true);
  });

  it('fails closed before rendering invalid labels or callbacks', () => {
    expect(() =>
      render(
        <CwlReviewTargetMarker
          presentation={presentation()}
          label=""
          onSelectThread={vi.fn()}
        />,
      ),
    ).toThrow('Review presentation metadata is invalid.');

    expect(() =>
      render(
        <CwlReviewTargetMarker
          presentation={presentation()}
          label="Review target"
          onSelectThread={undefined as unknown as () => void}
        />,
      ),
    ).toThrow('Review presentation metadata is invalid.');
  });
});
