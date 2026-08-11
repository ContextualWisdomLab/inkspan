import { describe, expect, it } from 'vitest';
import {
  assertCrossEngineClipboardConsensus,
  type CrossEngineClipboardObservation,
} from './crossEngineClipboardEvidence.js';

const RELEASE_EVIDENCE_ERROR =
  'Cross-engine clipboard document evidence must be bounded acyclic JSON.';

function observations(documentJson: unknown): CrossEngineClipboardObservation[] {
  return (['chromium', 'firefox', 'webkit'] as const).map((engine) => ({
    caseId: 'active-script',
    engine,
    sanitizedHtml: '<p>safe</p>',
    documentJson,
    errorCode: null,
  }));
}

describe('cross-engine clipboard evidence resource boundary', () => {
  it('fails closed on cyclic object evidence with one stable diagnostic', () => {
    const cyclic: Record<string, unknown> = { type: 'doc' };
    cyclic.content = cyclic;

    expect(() =>
      assertCrossEngineClipboardConsensus(observations(cyclic)),
    ).toThrowError(new Error(RELEASE_EVIDENCE_ERROR));
  });

  it('fails closed on cyclic array evidence with the same diagnostic', () => {
    const cyclic: unknown[] = [];
    cyclic.push(cyclic);

    expect(() =>
      assertCrossEngineClipboardConsensus(observations(cyclic)),
    ).toThrowError(new Error(RELEASE_EVIDENCE_ERROR));
  });

  it('fails closed before recursively canonicalizing excessive nesting', () => {
    let deep: unknown = null;
    for (let depth = 0; depth < 130; depth += 1) deep = [deep];

    expect(() =>
      assertCrossEngineClipboardConsensus(observations(deep)),
    ).toThrowError(new Error(RELEASE_EVIDENCE_ERROR));
  });

  it('fails closed before canonicalizing an excessive JSON value count', () => {
    const oversized = Array.from({ length: 10_001 }, () => null);

    expect(() =>
      assertCrossEngineClipboardConsensus(observations(oversized)),
    ).toThrowError(new Error(RELEASE_EVIDENCE_ERROR));
  });

  it('fails closed when top-level evidence is not serializable JSON', () => {
    expect(() =>
      assertCrossEngineClipboardConsensus(observations(undefined)),
    ).toThrowError(new Error(RELEASE_EVIDENCE_ERROR));
  });

  it('accepts repeated non-cyclic object references as equivalent JSON values', () => {
    const shared = { text: 'same' };
    const documentJson = { left: shared, right: shared };

    expect(() =>
      assertCrossEngineClipboardConsensus(observations(documentJson)),
    ).not.toThrow();
  });
});
