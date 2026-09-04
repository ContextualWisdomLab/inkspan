import { describe, expect, it } from 'vitest';
import * as reviewModule from './index.js';

interface ReviewSuggestionFactorySurface {
  readonly CwlReviewSuggestionError: new () => Error & {
    readonly code: 'invalid_suggestion';
  };
  readonly createReviewSuggestion: (source: unknown) => unknown;
}

function reviewSuggestionSurface(): ReviewSuggestionFactorySurface {
  return reviewModule as unknown as ReviewSuggestionFactorySurface;
}

const digestHex = 'b'.repeat(64);
const revision = Object.freeze({
  algorithm: 'SHA-256',
  digestHex,
  strongEntityTag: `"sha256-${digestHex}"`,
});
const projection = Object.freeze({
  id: 'inkspan-prosemirror-text',
  version: 1,
});

function target(start: number, end: number): Record<string, unknown> {
  return {
    contractVersion: 1,
    revision,
    selector: {
      type: 'TextPositionSelector',
      start,
      end,
    },
    projection,
  };
}

function insertSuggestion(): Record<string, unknown> {
  return {
    contractVersion: 1,
    kind: 'insert',
    target: target(2, 2),
    text: '제안 👩🏽‍💻',
  };
}

function deleteSuggestion(): Record<string, unknown> {
  return {
    contractVersion: 1,
    kind: 'delete',
    target: target(2, 5),
  };
}

function expectInvalidSuggestion(source: unknown): void {
  const { createReviewSuggestion, CwlReviewSuggestionError } =
    reviewSuggestionSurface();
  let failure: unknown;
  try {
    createReviewSuggestion(source);
  } catch (error) {
    failure = error;
  }
  expect(failure).toBeInstanceOf(CwlReviewSuggestionError);
  expect(failure).toMatchObject({ code: 'invalid_suggestion' });
  expect(String(failure)).not.toContain(digestHex);
}

describe('provider-neutral review suggestion contract', () => {
  it('creates detached deeply frozen insertion and deletion proposals', () => {
    const { createReviewSuggestion } = reviewSuggestionSurface();
    const insertSource = insertSuggestion();
    const deleteSource = deleteSuggestion();

    const insert = createReviewSuggestion(insertSource) as {
      readonly contractVersion: 1;
      readonly kind: 'insert';
      readonly target: {
        readonly selector: { readonly start: number; readonly end: number };
      };
      readonly text: string;
    };
    const deletion = createReviewSuggestion(deleteSource) as {
      readonly contractVersion: 1;
      readonly kind: 'delete';
      readonly target: {
        readonly selector: { readonly start: number; readonly end: number };
      };
    };

    expect(insert).toEqual(insertSource);
    expect(insert).not.toBe(insertSource);
    expect(insert.target).not.toBe(insertSource.target);
    expect(insert.text).toBe('제안 👩🏽‍💻');
    expect(Object.isFrozen(insert)).toBe(true);
    expect(Object.isFrozen(insert.target)).toBe(true);
    expect(Object.isFrozen(insert.target.selector)).toBe(true);

    expect(deletion).toEqual(deleteSource);
    expect(deletion).not.toBe(deleteSource);
    expect(deletion.target).not.toBe(deleteSource.target);
    expect(Object.isFrozen(deletion)).toBe(true);
    expect(Object.isFrozen(deletion.target)).toBe(true);
  });

  it('requires exact bounded shapes before retaining suggestion proposal data', () => {
    expectInvalidSuggestion(null);
    expectInvalidSuggestion('not-a-suggestion');
    expectInvalidSuggestion({ contractVersion: 1, target: target(1, 1) });
    expectInvalidSuggestion({ ...insertSuggestion(), kind: 'replace' });
    expectInvalidSuggestion({ ...insertSuggestion(), contractVersion: 2 });
    expectInvalidSuggestion({ ...insertSuggestion(), unexpected: true });
    expectInvalidSuggestion({
      ...insertSuggestion(),
      [Symbol('hidden authority')]: true,
    });

    const accessorKind = insertSuggestion();
    let getterCalls = 0;
    Object.defineProperty(accessorKind, 'kind', {
      enumerable: true,
      get() {
        getterCalls += 1;
        return 'insert';
      },
    });
    expectInvalidSuggestion(accessorKind);
    expect(getterCalls).toBe(0);

    const hiddenKind = insertSuggestion();
    Object.defineProperty(hiddenKind, 'kind', {
      value: 'insert',
      enumerable: false,
    });
    expectInvalidSuggestion(hiddenKind);
  });

  it('requires insertion points and bounded non-empty insertion text', () => {
    expectInvalidSuggestion({
      ...insertSuggestion(),
      target: target(2, 3),
    });
    expectInvalidSuggestion({ ...insertSuggestion(), text: '' });
    expectInvalidSuggestion({ ...insertSuggestion(), text: 1 });
    expectInvalidSuggestion({
      ...insertSuggestion(),
      text: 'a'.repeat(65_537),
    });

    const exactLimit = {
      ...insertSuggestion(),
      text: 'a'.repeat(65_536),
    };
    const accepted = reviewSuggestionSurface().createReviewSuggestion(
      exactLimit,
    ) as { readonly text: string };
    expect(accepted.text).toHaveLength(65_536);
  });

  it('requires deletion suggestions to select existing projected text only', () => {
    expectInvalidSuggestion({
      ...deleteSuggestion(),
      target: target(2, 2),
    });
    expectInvalidSuggestion({ ...deleteSuggestion(), text: 'copied source text' });
    expectInvalidSuggestion({
      ...deleteSuggestion(),
      target: {
        ...target(2, 5),
        revision: { ...revision, algorithm: 'MD5' },
      },
    });
  });

  it('fails closed when hostile reflection changes or rejects kind evidence', () => {
    const privateValue = 'private-suggestion-reflection-value';
    let kindReads = 0;
    const changingKind = new Proxy(insertSuggestion(), {
      getOwnPropertyDescriptor(source, property) {
        const descriptor = Reflect.getOwnPropertyDescriptor(source, property);
        if (property !== 'kind' || descriptor === undefined) return descriptor;
        kindReads += 1;
        return {
          ...descriptor,
          value: kindReads === 1 ? 'insert' : 'delete',
        };
      },
    });
    expectInvalidSuggestion(changingKind);

    const hostileKeys = new Proxy(insertSuggestion(), {
      ownKeys() {
        throw new Error(privateValue);
      },
    });
    const { createReviewSuggestion, CwlReviewSuggestionError } =
      reviewSuggestionSurface();
    let failure: unknown;
    try {
      createReviewSuggestion(hostileKeys);
    } catch (error) {
      failure = error;
    }
    expect(failure).toBeInstanceOf(CwlReviewSuggestionError);
    expect(String(failure)).not.toContain(privateValue);
  });
});
