import { cleanup, render } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { CwlReviewThreadList } from './index.js';

afterEach(cleanup);

function presentation(threadKey = 'thread_1') {
  const digestHex = 'a'.repeat(64);
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
    state: 'unresolved',
    commentCount: 1,
    selected: false,
    canReply: true,
    canResolve: true,
  };
}

const labels = {
  region: 'Document review',
  thread: () => 'Thread',
  reply: 'Reply',
  resolve: 'Resolve',
};

function renderPresentations(presentations: readonly unknown[]) {
  return () =>
    render(
      <CwlReviewThreadList
        presentations={presentations}
        labels={labels}
        onSelectThread={vi.fn()}
      />,
    );
}

describe('CwlReviewThreadList presentation collection boundary', () => {
  it('rejects accessor-backed array entries without invoking the accessor', () => {
    let getterCalls = 0;
    const presentations: unknown[] = [];
    Object.defineProperty(presentations, '0', {
      enumerable: true,
      configurable: true,
      get() {
        getterCalls += 1;
        return presentation();
      },
    });

    expect(renderPresentations(presentations)).toThrow(
      'Review presentation metadata is invalid.',
    );
    expect(getterCalls).toBe(0);
  });

  it('rejects oversized collections before inspecting any presentation entry', () => {
    let getterCalls = 0;
    const presentations = new Array<unknown>(1_025);
    Object.defineProperty(presentations, '0', {
      enumerable: true,
      configurable: true,
      get() {
        getterCalls += 1;
        return presentation();
      },
    });

    expect(renderPresentations(presentations)).toThrow(
      'Review presentation metadata is invalid.',
    );
    expect(getterCalls).toBe(0);
  });

  it('rejects sparse presentation arrays instead of silently skipping holes', () => {
    expect(renderPresentations(new Array<unknown>(1))).toThrow(
      'Review presentation metadata is invalid.',
    );
  });

  it('rejects non-enumerable presentation entries before value validation', () => {
    const presentations: unknown[] = [];
    Object.defineProperty(presentations, '0', {
      enumerable: false,
      configurable: true,
      writable: true,
      value: presentation(),
    });

    expect(renderPresentations(presentations)).toThrow(
      'Review presentation metadata is invalid.',
    );
  });
});
