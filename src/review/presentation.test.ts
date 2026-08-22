import { describe, expect, it } from 'vitest';
import * as reviewModule from './index.js';

interface ReviewPresentationSurface {
  readonly CwlReviewPresentationError: new () => Error & {
    readonly code: 'invalid_presentation';
  };
  readonly createReviewThreadPresentation: (source: unknown) => unknown;
}

function reviewPresentationSurface(): ReviewPresentationSurface {
  return reviewModule as unknown as ReviewPresentationSurface;
}

function target() {
  const digestHex = 'a'.repeat(64);
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

function presentation(overrides: Record<string, unknown> = {}) {
  return {
    contractVersion: 1,
    threadKey: 'thread_123',
    target: target(),
    state: 'unresolved',
    commentCount: 2,
    selected: true,
    canReply: true,
    canResolve: true,
    ...overrides,
  };
}

describe('review thread presentation contract', () => {
  it('detaches and freezes bounded host presentation metadata without comment bodies', () => {
    const { createReviewThreadPresentation } = reviewPresentationSurface();
    const source = presentation();
    const result = createReviewThreadPresentation(source) as {
      readonly threadKey: string;
      readonly target: {
        readonly selector: { readonly start: number; readonly end: number };
      };
      readonly state: string;
      readonly commentCount: number;
      readonly selected: boolean;
      readonly canReply: boolean;
      readonly canResolve: boolean;
    };

    expect(result).toEqual(source);
    expect(result).not.toBe(source);
    expect(result.target).not.toBe(source.target);
    expect(Object.isFrozen(result)).toBe(true);
    expect(Object.isFrozen(result.target)).toBe(true);
    expect(Object.isFrozen(result.target.selector)).toBe(true);
    expect(JSON.stringify(result)).not.toContain('commentBody');
  });

  it('supports resolved and permission-disabled presentation without inventing actor authority', () => {
    const { createReviewThreadPresentation } = reviewPresentationSurface();
    const result = createReviewThreadPresentation(
      presentation({
        state: 'resolved',
        selected: false,
        canReply: false,
        canResolve: false,
      }),
    ) as Record<string, unknown>;

    expect(result).toMatchObject({
      state: 'resolved',
      selected: false,
      canReply: false,
      canResolve: false,
    });
    expect(result).not.toHaveProperty('actorId');
    expect(result).not.toHaveProperty('authorized');
  });

  it('fails closed on body-like or otherwise unsupported presentation fields', () => {
    const {
      createReviewThreadPresentation,
      CwlReviewPresentationError,
    } = reviewPresentationSurface();
    const privateBody = 'private-review-body-must-not-leak';

    expect(() =>
      createReviewThreadPresentation(
        presentation({ commentBody: privateBody }),
      ),
    ).toThrow(CwlReviewPresentationError);
    try {
      createReviewThreadPresentation(presentation({ commentBody: privateBody }));
    } catch (error) {
      expect(error).toMatchObject({ code: 'invalid_presentation' });
      expect(String(error)).not.toContain(privateBody);
    }
  });

  it('bounds opaque host thread keys and comment counts', () => {
    const { createReviewThreadPresentation } = reviewPresentationSurface();

    expect(() =>
      createReviewThreadPresentation(presentation({ threadKey: '' })),
    ).toThrow();
    expect(() =>
      createReviewThreadPresentation(
        presentation({ threadKey: `thread_${'x'.repeat(122)}` }),
      ),
    ).toThrow();
    expect(() =>
      createReviewThreadPresentation(presentation({ commentCount: 0 })),
    ).toThrow();
    expect(() =>
      createReviewThreadPresentation(presentation({ commentCount: 10_001 })),
    ).toThrow();
  });

  it('rejects hostile accessors without invoking them', () => {
    const { createReviewThreadPresentation } = reviewPresentationSurface();
    let reads = 0;
    const source = presentation();
    Object.defineProperty(source, 'threadKey', {
      enumerable: true,
      configurable: true,
      get() {
        reads += 1;
        throw new Error('private accessor payload');
      },
    });

    expect(() => createReviewThreadPresentation(source)).toThrow();
    expect(reads).toBe(0);
  });
});
