import { describe, expect, it } from 'vitest';
import * as reviewModule from './index.js';

interface ReviewTargetFactorySurface {
  readonly CwlReviewTargetError: new () => Error & { readonly code: 'invalid_target' };
  readonly createReviewTarget: (source: unknown) => unknown;
}

function reviewSurface(): ReviewTargetFactorySurface {
  return reviewModule as unknown as ReviewTargetFactorySurface;
}

const digestHex = 'a'.repeat(64);
const revision = Object.freeze({
  algorithm: 'SHA-256',
  digestHex,
  strongEntityTag: `"sha256-${digestHex}"`,
});
const selector = Object.freeze({
  type: 'TextPositionSelector',
  start: 2,
  end: 5,
});
const projection = Object.freeze({
  id: 'inkspan-prosemirror-text',
  version: 1,
});

function validTarget(): Record<string, unknown> {
  return {
    contractVersion: 1,
    revision,
    selector,
    projection,
  };
}

function expectInvalid(source: unknown): void {
  const { createReviewTarget, CwlReviewTargetError } = reviewSurface();
  let failure: unknown;
  try {
    createReviewTarget(source);
  } catch (error) {
    failure = error;
  }
  expect(failure).toBeInstanceOf(CwlReviewTargetError);
  expect(failure).toMatchObject({ code: 'invalid_target' });
  expect(String(failure)).not.toContain(digestHex);
}

describe('provider-neutral review target contract', () => {
  it('creates one detached deeply frozen exact-revision target', () => {
    const { createReviewTarget } = reviewSurface();
    const source = validTarget();
    const target = createReviewTarget(source) as {
      readonly contractVersion: 1;
      readonly revision: typeof revision;
      readonly selector: typeof selector;
      readonly projection: typeof projection;
    };

    expect(target).toEqual(source);
    expect(target).not.toBe(source);
    expect(target.revision).not.toBe(revision);
    expect(target.selector).not.toBe(selector);
    expect(target.projection).not.toBe(projection);
    expect(Object.isFrozen(target)).toBe(true);
    expect(Object.isFrozen(target.revision)).toBe(true);
    expect(Object.isFrozen(target.selector)).toBe(true);
    expect(Object.isFrozen(target.projection)).toBe(true);
  });

  it('rejects malformed contract versions and target shapes', () => {
    expectInvalid(null);
    expectInvalid({ ...validTarget(), contractVersion: 2 });
    expectInvalid({ ...validTarget(), unexpected: true });
    expectInvalid({
      ...validTarget(),
      [Symbol('hidden authority')]: true,
    });

    const sameWidthUnknownKey = validTarget();
    delete sameWidthUnknownKey.contractVersion;
    sameWidthUnknownKey.unexpected = 1;
    expectInvalid(sameWidthUnknownKey);

    const sameWidthSymbolKey = validTarget();
    delete sameWidthSymbolKey.contractVersion;
    Object.defineProperty(sameWidthSymbolKey, Symbol('hidden authority'), {
      value: 1,
      enumerable: true,
    });
    expectInvalid(sameWidthSymbolKey);

    const accessorTarget = validTarget();
    let getterCalls = 0;
    Object.defineProperty(accessorTarget, 'revision', {
      enumerable: true,
      get() {
        getterCalls += 1;
        return revision;
      },
    });
    expectInvalid(accessorTarget);
    expect(getterCalls).toBe(0);

    const nonEnumerableTarget = validTarget();
    Object.defineProperty(nonEnumerableTarget, 'projection', {
      value: projection,
      enumerable: false,
    });
    expectInvalid(nonEnumerableTarget);
  });

  it('rejects malformed revision, selector, and projection metadata', () => {
    expectInvalid({
      ...validTarget(),
      revision: { ...revision, algorithm: 'MD5' },
    });
    expectInvalid({
      ...validTarget(),
      revision: { ...revision, digestHex: 'A'.repeat(64) },
    });
    expectInvalid({
      ...validTarget(),
      revision: { ...revision, digestHex: 'a'.repeat(63) },
    });
    expectInvalid({
      ...validTarget(),
      revision: { ...revision, strongEntityTag: '"sha256-wrong"' },
    });
    expectInvalid({
      ...validTarget(),
      selector: { ...selector, type: 'CssSelector' },
    });
    expectInvalid({
      ...validTarget(),
      selector: { ...selector, start: -1 },
    });
    expectInvalid({
      ...validTarget(),
      selector: { ...selector, start: 1.5 },
    });
    expectInvalid({
      ...validTarget(),
      selector: { ...selector, end: Number.MAX_SAFE_INTEGER + 1 },
    });
    expectInvalid({
      ...validTarget(),
      selector: { ...selector, start: 6, end: 5 },
    });
    expectInvalid({
      ...validTarget(),
      projection: { ...projection, id: 'dom-text' },
    });
    expectInvalid({
      ...validTarget(),
      projection: { ...projection, version: 2 },
    });
  });

  it('rejects malformed nested property shapes without invoking accessors', () => {
    for (const key of ['revision', 'selector', 'projection'] as const) {
      const source = validTarget();
      const nested = { ...(source[key] as Record<string, unknown>) };
      let getterCalls = 0;
      const firstKey = Object.keys(nested)[0]!;
      Object.defineProperty(nested, firstKey, {
        enumerable: true,
        get() {
          getterCalls += 1;
          return undefined;
        },
      });
      source[key] = nested;
      expectInvalid(source);
      expect(getterCalls).toBe(0);
    }
  });

  it('normalizes hostile reflection failures without leaking private causes', () => {
    const secret = 'private-review-reflection-value';
    const target = new Proxy(validTarget(), {
      ownKeys() {
        throw new Error(secret);
      },
    });
    const { createReviewTarget, CwlReviewTargetError } = reviewSurface();
    let failure: unknown;
    try {
      createReviewTarget(target);
    } catch (error) {
      failure = error;
    }
    expect(failure).toBeInstanceOf(CwlReviewTargetError);
    expect(String(failure)).not.toContain(secret);
  });
});
