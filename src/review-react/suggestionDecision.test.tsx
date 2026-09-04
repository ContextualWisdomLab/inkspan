import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { CwlReviewSuggestionDecision } from './index.js';

afterEach(cleanup);

function suggestion() {
  const digestHex = 'a'.repeat(64);
  return {
    contractVersion: 1,
    kind: 'insert',
    target: {
      contractVersion: 1,
      revision: {
        algorithm: 'SHA-256',
        digestHex,
        strongEntityTag: `"sha256-${digestHex}"`,
      },
      selector: { type: 'TextPositionSelector', start: 3, end: 3 },
      projection: { id: 'inkspan-prosemirror-text', version: 1 },
    },
    text: 'Suggested text',
  };
}

describe('CwlReviewSuggestionDecision', () => {
  it('emits detached accept and reject intents with disambiguated names', () => {
    const onAccept = vi.fn();
    const onReject = vi.fn();
    const source = suggestion();
    render(
      <CwlReviewSuggestionDecision
        suggestion={source}
        label="Insert suggested wording"
        acceptLabel="Accept"
        rejectLabel="Reject"
        onAccept={onAccept}
        onReject={onReject}
      />,
    );

    fireEvent.click(
      screen.getByRole('button', { name: 'Accept — Insert suggested wording' }),
    );
    fireEvent.click(
      screen.getByRole('button', { name: 'Reject — Insert suggested wording' }),
    );
    expect(onAccept).toHaveBeenCalledTimes(1);
    expect(onReject).toHaveBeenCalledTimes(1);
    expect(onAccept.mock.calls[0]?.[0]).not.toBe(source);
    expect(Object.isFrozen(onAccept.mock.calls[0]?.[0])).toBe(true);
  });

  it('defaults to print exclusion and disables unavailable decisions', () => {
    const { rerender } = render(
      <CwlReviewSuggestionDecision
        suggestion={suggestion()}
        label="Insert suggested wording"
        acceptLabel="Accept"
        rejectLabel="Reject"
      />,
    );

    expect(screen.getByRole('group')).toHaveAttribute(
      'data-cwl-review-print',
      'exclude',
    );
    expect(screen.getByRole('button', { name: /Accept/u })).toBeDisabled();
    expect(screen.getByRole('button', { name: /Reject/u })).toBeDisabled();

    rerender(
      <CwlReviewSuggestionDecision
        suggestion={suggestion()}
        label="Insert suggested wording"
        acceptLabel="Accept"
        rejectLabel="Reject"
        printMode="include"
      />,
    );
    expect(screen.getByRole('group')).toHaveAttribute(
      'data-cwl-review-print',
      'include',
    );
  });

  it('fails closed on malformed suggestion decision inputs', () => {
    expect(() =>
      render(
        <CwlReviewSuggestionDecision
          suggestion={{}}
          label="Insert suggested wording"
          acceptLabel="Accept"
          rejectLabel="Reject"
        />,
      ),
    ).toThrow();
    expect(() =>
      render(
        <CwlReviewSuggestionDecision
          suggestion={suggestion()}
          label=" "
          acceptLabel="Accept"
          rejectLabel="Reject"
        />,
      ),
    ).toThrow('Review presentation metadata is invalid.');
    expect(() =>
      render(
        <CwlReviewSuggestionDecision
          suggestion={suggestion()}
          label="Insert suggested wording"
          acceptLabel="Accept"
          rejectLabel="Reject"
          onAccept={'invalid' as never}
        />,
      ),
    ).toThrow('Review presentation metadata is invalid.');
    expect(() =>
      render(
        <CwlReviewSuggestionDecision
          suggestion={suggestion()}
          label="Insert suggested wording"
          acceptLabel="Accept"
          rejectLabel="Reject"
          onReject={42 as never}
        />,
      ),
    ).toThrow('Review presentation metadata is invalid.');
  });
});
