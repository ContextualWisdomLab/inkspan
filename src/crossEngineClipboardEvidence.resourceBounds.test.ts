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
    const documentJson = {
      type: 'doc',
      content: [{ type: 'paragraph', attrs: { privateValue: 1n } }],
    };

    expect(() => assertCrossEngineClipboardConsensus(allEngines(documentJson))).toThrow(
      RESOURCE_BOUNDARY_ERROR,
    );
  });
});
