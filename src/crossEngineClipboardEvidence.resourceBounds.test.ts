import { describe, expect, it } from 'vitest';
import {
  assertCrossEngineClipboardConsensus,
  type CrossEngineClipboardEngine,
  type CrossEngineClipboardObservation,
} from './crossEngineClipboardEvidence.js';

const RESOURCE_BOUNDARY_ERROR =
  'Cross-engine clipboard document evidence exceeds the supported structure boundary.';
const ENGINE_COUNT_ERROR =
  'Cross-engine clipboard evidence requires exactly one observation from chromium, firefox, and webkit.';

function observation(
  engine: CrossEngineClipboardEngine,
  documentJson: unknown,
): CrossEngineClipboardObservation {
  return {
    caseId: 'active-script',
    engine,
    sanitizedHtml: '<p>safe</p>',
    documentJson,
    errorCode: null,
  };
}

function allEngines(documentJson: unknown): readonly CrossEngineClipboardObservation[] {
  return [
    observation('chromium', documentJson),
    observation('firefox', documentJson),
    observation('webkit', documentJson),
  ];
}

describe('cross-engine clipboard consensus resource boundary', () => {
  it('rejects invalid observation counts before reading caller-controlled entries', () => {
    let extraObservationReads = 0;
    const observations = [
      observation('chromium', { type: 'doc' }),
      observation('firefox', { type: 'doc' }),
      observation('webkit', { type: 'doc' }),
      observation('chromium', { type: 'doc' }),
    ];
    Object.defineProperty(observations, '3', {
      enumerable: true,
      configurable: true,
      get() {
        extraObservationReads += 1;
        throw new Error('extra observation must not be read');
      },
    });

    expect(() => assertCrossEngineClipboardConsensus(observations)).toThrow(
      ENGINE_COUNT_ERROR,
    );
    expect(extraObservationReads).toBe(0);
  });

  it('fails closed with a stable redacted error for cyclic document evidence', () => {
    const cyclic: Record<string, unknown> = { type: 'doc' };
    cyclic.self = cyclic;

    expect(() => assertCrossEngineClipboardConsensus(allEngines(cyclic))).toThrow(
      RESOURCE_BOUNDARY_ERROR,
    );
  });

  it('fails closed before canonicalizing document evidence beyond the supported nesting depth', () => {
    let nested: unknown = { type: 'paragraph' };
    for (let depth = 0; depth < 129; depth += 1) {
      nested = { content: [nested] };
    }
    const documentJson = { type: 'doc', content: [nested] };

    expect(() => assertCrossEngineClipboardConsensus(allEngines(documentJson))).toThrow(
      RESOURCE_BOUNDARY_ERROR,
    );
  });

  it('fails closed with the same stable error for non-JSON scalar evidence', () => {
    for (const privateValue of [1n, undefined, Number.NaN, Number.POSITIVE_INFINITY]) {
      const documentJson = {
        type: 'doc',
        content: [{ type: 'paragraph', attrs: { privateValue } }],
      };

      expect(() => assertCrossEngineClipboardConsensus(allEngines(documentJson))).toThrow(
        RESOURCE_BOUNDARY_ERROR,
      );
    }
  });

  it('rejects accessor-backed evidence without invoking caller code', () => {
    let getterCalls = 0;
    const attrs: Record<string, unknown> = {};
    Object.defineProperty(attrs, 'privateValue', {
      enumerable: true,
      get() {
        getterCalls += 1;
        throw new Error('private getter must not execute');
      },
    });
    const documentJson = { type: 'doc', attrs };

    expect(() => assertCrossEngineClipboardConsensus(allEngines(documentJson))).toThrow(
      RESOURCE_BOUNDARY_ERROR,
    );
    expect(getterCalls).toBe(0);
  });

  it('rejects array accessors without invoking caller code', () => {
    let getterCalls = 0;
    const content: unknown[] = [];
    Object.defineProperty(content, '0', {
      enumerable: true,
      configurable: true,
      get() {
        getterCalls += 1;
        throw new Error('private array getter must not execute');
      },
    });
    content.length = 1;

    expect(() =>
      assertCrossEngineClipboardConsensus(allEngines({ type: 'doc', content })),
    ).toThrow(RESOURCE_BOUNDARY_ERROR);
    expect(getterCalls).toBe(0);
  });

  it('rejects hidden and symbol own properties instead of dropping them', () => {
    const hiddenObject: Record<string, unknown> = { type: 'doc' };
    Object.defineProperty(hiddenObject, 'privateHidden', {
      enumerable: false,
      value: 'must-not-be-dropped',
    });

    const symbolObject: Record<string, unknown> = { type: 'doc' };
    Object.defineProperty(symbolObject, Symbol('privateObject'), {
      enumerable: true,
      value: 'must-not-be-dropped',
    });

    const hiddenArray: unknown[] = [{ type: 'paragraph' }];
    Object.defineProperty(hiddenArray, 'privateHidden', {
      enumerable: false,
      value: 'must-not-be-dropped',
    });

    const symbolArray: unknown[] = [{ type: 'paragraph' }];
    Object.defineProperty(symbolArray, Symbol('privateArray'), {
      enumerable: true,
      value: 'must-not-be-dropped',
    });

    for (const documentJson of [
      hiddenObject,
      symbolObject,
      { type: 'doc', content: hiddenArray },
      { type: 'doc', content: symbolArray },
    ]) {
      expect(() => assertCrossEngineClipboardConsensus(allEngines(documentJson))).toThrow(
        RESOURCE_BOUNDARY_ERROR,
      );
    }
  });

  it('rejects exotic and lossy array containers instead of normalizing them', () => {
    expect(() =>
      assertCrossEngineClipboardConsensus(
        allEngines({ type: 'doc', attrs: new Date(0) }),
      ),
    ).toThrow(RESOURCE_BOUNDARY_ERROR);

    const sparse: unknown[] = [];
    sparse.length = 2;
    sparse[1] = { type: 'paragraph' };
    expect(() =>
      assertCrossEngineClipboardConsensus(allEngines({ type: 'doc', content: sparse })),
    ).toThrow(RESOURCE_BOUNDARY_ERROR);

    const extra = [{ type: 'paragraph' }] as unknown[] & { privateMarker?: string };
    extra.privateMarker = 'must-not-be-dropped';
    expect(() =>
      assertCrossEngineClipboardConsensus(allEngines({ type: 'doc', content: extra })),
    ).toThrow(RESOURCE_BOUNDARY_ERROR);

    const disguisedSparse = [] as unknown[] & { privateMarker?: string };
    disguisedSparse.length = 2;
    disguisedSparse[1] = { type: 'paragraph' };
    disguisedSparse.privateMarker = 'must-not-substitute-for-index-zero';
    expect(() =>
      assertCrossEngineClipboardConsensus(
        allEngines({ type: 'doc', content: disguisedSparse }),
      ),
    ).toThrow(RESOURCE_BOUNDARY_ERROR);
  });

  it('preserves ordinary dense arrays and null-prototype JSON objects', () => {
    const attrs = Object.create(null) as Record<string, unknown>;
    attrs.role = 'presentation';
    const documentJson = {
      type: 'doc',
      content: [{ type: 'paragraph', attrs }],
    };

    expect(() => assertCrossEngineClipboardConsensus(allEngines(documentJson))).not.toThrow();
  });
});
