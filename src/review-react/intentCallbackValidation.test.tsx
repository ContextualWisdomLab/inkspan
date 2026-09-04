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

function expectRedactedIntentFailure(
  action: () => void,
  privateSentinel: string,
): void {
  const observedErrors: unknown[] = [];
  const handleWindowError = (event: ErrorEvent): void => {
    observedErrors.push(event.error);
    event.preventDefault();
  };

  window.addEventListener('error', handleWindowError);
  try {
    action();
  } finally {
    window.removeEventListener('error', handleWindowError);
  }

  // React's development event guard can report the same thrown handler error
  // more than once through JSDOM's window boundary. Cardinality is a test
  // harness detail; the contract is that every externally observed error is
  // the stable, redacted Inkspan presentation error.
  expect(observedErrors.length).toBeGreaterThan(0);
  for (const error of observedErrors) {
    expect(error).toBeInstanceOf(CwlReviewPresentationError);
    expect(error).toMatchObject({
      code: 'invalid_presentation',
      message: 'Review presentation metadata is invalid.',
    });
    expect(String(error)).not.toContain(privateSentinel);
  }
}

async function expectRedactedAsyncIntentFailure(
  action: () => void,
): Promise<void> {
  const unhandledReasons: unknown[] = [];
  const handleUnhandledRejection = (event: PromiseRejectionEvent): void => {
    unhandledReasons.push(event.reason);
    event.preventDefault();
  };

  window.addEventListener('unhandledrejection', handleUnhandledRejection);
  try {
    action();
    await new Promise((resolve) => setTimeout(resolve, 0));
  } finally {
    window.removeEventListener('unhandledrejection', handleUnhandledRejection);
  }

  expect(unhandledReasons).toEqual([]);
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
    const callback = vi.fn(() => {
      throw new Error('private selection sentinel');
    });
    renderWithCallbacks({ onSelectThread: callback });

    expectRedactedIntentFailure(() => {
      fireEvent.click(screen.getByRole('button', { name: 'Thread 1' }));
    }, 'private selection sentinel');
    expect(callback).toHaveBeenCalledTimes(1);
  });

  it('redacts a private host reply callback failure at the presentation boundary', () => {
    const callback = vi.fn(() => {
      throw new Error('private reply sentinel');
    });
    renderWithCallbacks({ onReplyThread: callback });

    expectRedactedIntentFailure(() => {
      fireEvent.click(screen.getByRole('button', { name: 'Reply — Thread 1' }));
    }, 'private reply sentinel');
    expect(callback).toHaveBeenCalledTimes(1);
  });

  it('redacts a private host resolve callback failure at the presentation boundary', () => {
    const callback = vi.fn(() => {
      throw new Error('private resolve sentinel');
    });
    renderWithCallbacks({ onResolveThread: callback });

    expectRedactedIntentFailure(() => {
      fireEvent.click(screen.getByRole('button', { name: 'Resolve — Thread 1' }));
    }, 'private resolve sentinel');
    expect(callback).toHaveBeenCalledTimes(1);
  });

  it('redacts a rejected async host callback at the presentation boundary', async () => {
    const callback = vi.fn(async () => {
      throw new Error('private async selection sentinel');
    });
    renderWithCallbacks({ onSelectThread: callback });

    await expectRedactedAsyncIntentFailure(() => {
      fireEvent.click(screen.getByRole('button', { name: 'Thread 1' }));
    });
    expect(callback).toHaveBeenCalledTimes(1);
  });
});
