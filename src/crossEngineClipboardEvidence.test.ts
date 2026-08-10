import { describe, expect, it } from 'vitest';
import {
  SAFE_CLIPBOARD_CROSS_ENGINE_CORPUS,
  assertCrossEngineClipboardConsensus,
  type CrossEngineClipboardObservation,
} from './crossEngineClipboardEvidence.js';

const observation = (
  engine: 'chromium' | 'firefox' | 'webkit',
  overrides: Partial<CrossEngineClipboardObservation> = {},
): CrossEngineClipboardObservation => ({
  caseId: 'active-script',
  engine,
  sanitizedHtml: '<p>safe</p>',
  documentJson: { type: 'doc', content: [{ type: 'paragraph' }] },
  errorCode: null,
  ...overrides,
});

describe('cross-engine rich clipboard release oracle', () => {
  it('keeps one bounded adversarial corpus spanning the required semantic risk families', () => {
    const families = new Set(
      SAFE_CLIPBOARD_CROSS_ENGINE_CORPUS.map((testCase) => testCase.riskFamily),
    );

    expect(families).toEqual(
      new Set([
        'active-content',
        'hidden-content',
        'unsafe-link',
        'malformed-markup',
        'table-list',
        'svg-mathml',
        'parser-edge',
        'resource-limit',
      ]),
    );
    expect(SAFE_CLIPBOARD_CROSS_ENGINE_CORPUS.length).toBeGreaterThanOrEqual(18);
    expect(
      SAFE_CLIPBOARD_CROSS_ENGINE_CORPUS.every(
        (testCase) =>
          testCase.id.length > 0 &&
          testCase.sourceHtml.length > 0 &&
          testCase.expectedSanitizedHtml !== undefined,
      ),
    ).toBe(true);
  });

  it('accepts identical sanitized HTML, ProseMirror structure, and rejection behavior across all engines', () => {
    expect(() =>
      assertCrossEngineClipboardConsensus([
        observation('chromium'),
        observation('firefox'),
        observation('webkit'),
      ]),
    ).not.toThrow();
  });

  it('accepts semantically identical JSON objects with different key insertion order', () => {
    expect(() =>
      assertCrossEngineClipboardConsensus([
        observation('chromium', {
          documentJson: {
            type: 'doc',
            attrs: { zeta: 1, optional: null, alpha: 2 },
            content: [{ type: 'paragraph', attrs: { beta: true, alpha: false } }],
          },
        }),
        observation('firefox', {
          documentJson: {
            content: [{ attrs: { alpha: false, beta: true }, type: 'paragraph' }],
            attrs: { alpha: 2, optional: null, zeta: 1 },
            type: 'doc',
          },
        }),
        observation('webkit', {
          documentJson: {
            attrs: { zeta: 1, alpha: 2, optional: null },
            content: [{ attrs: { beta: true, alpha: false }, type: 'paragraph' }],
            type: 'doc',
          },
        }),
      ]),
    ).not.toThrow();
  });

  it('fails closed when one engine reconstructs unsafe or divergent HTML', () => {
    expect(() =>
      assertCrossEngineClipboardConsensus([
        observation('chromium'),
        observation('firefox'),
        observation('webkit', {
          sanitizedHtml: '<p>safe</p><script>alert(1)</script>',
        }),
      ]),
    ).toThrow(/sanitized HTML differs across browser engines/u);
  });

  it('fails closed when ProseMirror structure or rejection behavior diverges', () => {
    expect(() =>
      assertCrossEngineClipboardConsensus([
        observation('chromium'),
        observation('firefox'),
        observation('webkit', {
          documentJson: {
            type: 'doc',
            content: [{ type: 'heading', attrs: { level: 1 } }],
          },
        }),
      ]),
    ).toThrow(/document structure differs across browser engines/u);

    expect(() =>
      assertCrossEngineClipboardConsensus([
        observation('chromium'),
        observation('firefox'),
        observation('webkit', { errorCode: 'invalid_html' }),
      ]),
    ).toThrow(/rejection behavior differs across browser engines/u);
  });

  it('rejects incomplete, duplicate, or mixed-case observations instead of silently weakening the gate', () => {
    expect(() =>
      assertCrossEngineClipboardConsensus([
        observation('chromium'),
        observation('firefox'),
      ]),
    ).toThrow(/exactly one observation from chromium, firefox, and webkit/u);

    expect(() =>
      assertCrossEngineClipboardConsensus([
        observation('chromium'),
        observation('chromium'),
        observation('webkit'),
      ]),
    ).toThrow(/exactly one observation from chromium, firefox, and webkit/u);

    expect(() =>
      assertCrossEngineClipboardConsensus([
        observation('chromium'),
        observation('firefox', { caseId: 'different-case' }),
        observation('webkit'),
      ]),
    ).toThrow(/same corpus case/u);
  });
});
