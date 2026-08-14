import { describe, expect, it } from 'vitest';
import {
  assertCrossEngineClipboardConsensus,
  type CrossEngineClipboardEngine,
  type CrossEngineClipboardObservation,
} from './crossEngineClipboardEvidence.js';

const RESOURCE_BOUNDARY_ERROR =
  'Cross-engine clipboard document evidence exceeds the supported structure boundary.';

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
