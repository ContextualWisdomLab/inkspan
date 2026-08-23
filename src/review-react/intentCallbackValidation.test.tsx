import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { CwlReviewPresentationError } from '../review/index.js';
import {
  CwlReviewThreadList,
  type CwlReviewThreadListProps,
} from './index.js';

afterEach(cleanup);

function presentation() {
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
    commentCount: 1,
    selected: false,
    canReply: true,
    canResolve: true,
  };
}

const labels = {
  region: 'Document review',
  thread: () => 'Thread 1',
  reply: 'Reply',
  resolve: 'Resolve',
};

function expectInvalidIntentCallbacks(
  overrides: Record<string, unknown>,
): void {
  const props = {
    presentations: [presentation()],
    labels,
    onSelectThread: vi.fn(),
    ...overrides,
  } as unknown as CwlReviewThreadListProps;

  expect(() => render(<CwlReviewThreadList {...props} />)).toThrow(
    'Review presentation metadata is invalid.',
  );
}

function renderWithCallbacks(
  overrides: Partial<CwlReviewThreadListProps>,
): void {
  render(
    <CwlReviewThreadList
      presentations={[presentation()]}
      labels={labels}
      onSelectThread={vi.fn()}
      {...overrides}
    />,
  );
}

function expectRedactedIntentFailure(action: () => void): void {
  expect(action).toThrow(CwlReviewPresentationError);
  expect(action).toThrow('Review presentation metadata is invalid.');
}

describe('CwlReviewThreadList intent callback validation', () => {
  it('fails closed before rendering when the required selection callback is malformed', () => {
    expectInvalidIntentCallbacks({ onSelectThread: null });
  });

  it('fails closed before rendering when an optional reply callback is malformed', () => {
    expectInvalidIntentCallbacks({ onReplyThread: 'not-a-function' });
  });

  it('fails closed before rendering when an optional resolve callback is malformed', () => {
    expectInvalidIntentCallbacks({ onResolveThread: 42 });
  });

  it('redacts a private host selection callback failure at the presentation boundary', () => {
    renderWithCallbacks({
      onSelectThread: () => {
        throw new Error('private selection sentinel');
      },
    });

    expectRedactedIntentFailure(() => {
      fireEvent.click(screen.getByRole('button', { name: 'Thread 1' }));
    });
  });

  it('redacts a private host reply callback failure at the presentation boundary', () => {
    renderWithCallbacks({
      onReplyThread: () => {
        throw new Error('private reply sentinel');
      },
    });

    expectRedactedIntentFailure(() => {
      fireEvent.click(screen.getByRole('button', { name: 'Reply — Thread 1' }));
    });
  });

  it('redacts a private host resolve callback failure at the presentation boundary', () => {
    renderWithCallbacks({
      onResolveThread: () => {
        throw new Error('private resolve sentinel');
      },
    });

    expectRedactedIntentFailure(() => {
      fireEvent.click(screen.getByRole('button', { name: 'Resolve — Thread 1' }));
    });
  });
});
