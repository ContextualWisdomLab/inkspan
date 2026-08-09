import type { ClipboardSanitizationErrorCode } from './extensions/SafeClipboard.js';

/** Browser engines that must independently pass the rich-clipboard release gate. */
export type CrossEngineClipboardEngine = 'chromium' | 'firefox' | 'webkit';

/** Security/semantic risk families exercised by the shared browser corpus. */
export type CrossEngineClipboardRiskFamily =
  | 'active-content'
  | 'hidden-content'
  | 'unsafe-link'
  | 'malformed-markup'
  | 'table-list'
  | 'svg-mathml'
  | 'parser-edge';

/** One immutable public fixture in the cross-engine rich-clipboard corpus. */
export interface CrossEngineClipboardCase {
  readonly id: string;
  readonly riskFamily: CrossEngineClipboardRiskFamily;
  readonly sourceHtml: string;
  readonly expectedSanitizedHtml: string;
}

/** One browser observation used by the fail-closed release consensus oracle. */
export interface CrossEngineClipboardObservation {
  readonly caseId: string;
  readonly engine: CrossEngineClipboardEngine;
  readonly sanitizedHtml: string | null;
  readonly documentJson: unknown | null;
  readonly errorCode: ClipboardSanitizationErrorCode | null;
}

const CORPUS: readonly CrossEngineClipboardCase[] = [
  {
    id: 'active-script',
    riskFamily: 'active-content',
    sourceHtml: '<p>safe<script>alert(1)</script></p>',
    expectedSanitizedHtml: '<p>safe</p>',
  },
  {
    id: 'active-resource-and-form',
    riskFamily: 'active-content',
    sourceHtml:
      '<div>before<iframe src="https://example.invalid/"></iframe><img src="https://example.invalid/x"><form><input value="secret"></form>after</div>',
    expectedSanitizedHtml: '<div>beforeafter</div>',
  },
  {
    id: 'hidden-display-and-aria',
    riskFamily: 'hidden-content',
    sourceHtml:
      '<p>visible<span style="display:none">display</span><span aria-hidden="true">aria</span>end</p>',
    expectedSanitizedHtml: '<p>visibleend</p>',
  },
  {
    id: 'hidden-office-eof-comment',
    riskFamily: 'hidden-content',
    sourceHtml:
      '<p>before<span style="mso-hide: all !important; /* office comment">secret</span>after</p>',
    expectedSanitizedHtml: '<p>beforeafter</p>',
  },
  {
    id: 'hidden-content-visibility-popover',
    riskFamily: 'hidden-content',
    sourceHtml:
      '<div>one<span style="content-visibility: h\\69dden">two</span><span popover>three</span>four</div>',
    expectedSanitizedHtml: '<div>onefour</div>',
  },
  {
    id: 'unsafe-javascript-link',
    riskFamily: 'unsafe-link',
    sourceHtml: '<a href="javascript:alert(1)" onclick="alert(2)">click</a>',
    expectedSanitizedHtml: 'click',
  },
  {
    id: 'safe-https-link',
    riskFamily: 'unsafe-link',
    sourceHtml: '<a href="https://example.com/path">safe</a>',
    expectedSanitizedHtml:
      '<a href="https://example.com/path" rel="noopener noreferrer nofollow">safe</a>',
  },
  {
    id: 'malformed-formatting',
    riskFamily: 'malformed-markup',
    sourceHtml: '<b><i>text</b></i>',
    expectedSanitizedHtml: '<strong><em>text</em></strong>',
  },
  {
    id: 'malformed-paragraph',
    riskFamily: 'malformed-markup',
    sourceHtml: '<p>one<p>two',
    expectedSanitizedHtml: '<p>one</p><p>two</p>',
  },
  {
    id: 'table-parser-repair',
    riskFamily: 'table-list',
    sourceHtml: '<table><tr><td colspan="2">cell</td></tr></table>',
    expectedSanitizedHtml:
      '<table><tbody><tr><td colspan="2">cell</td></tr></tbody></table>',
  },
  {
    id: 'ordered-list-repair',
    riskFamily: 'table-list',
    sourceHtml: '<ol start="3"><li>one<li>two</ol>',
    expectedSanitizedHtml: '<ol start="3"><li>one</li><li>two</li></ol>',
  },
  {
    id: 'svg-and-mathml-subtrees',
    riskFamily: 'svg-mathml',
    sourceHtml:
      '<p>a<svg><script>alert(1)</script><text>x</text></svg>b<math><mtext>y</mtext></math>c</p>',
    expectedSanitizedHtml: '<p>abc</p>',
  },
  {
    id: 'closed-details-summary',
    riskFamily: 'parser-edge',
    sourceHtml: '<details><summary>label</summary><p>secret</p></details>',
    expectedSanitizedHtml: 'label',
  },
  {
    id: 'dialog-and-native-widget-fallback',
    riskFamily: 'parser-edge',
    sourceHtml:
      '<dialog>closed</dialog><dialog open><p>open</p></dialog><datalist><option>hidden</option></datalist><p>end</p>',
    expectedSanitizedHtml: '<p>open</p><p>end</p>',
  },
  {
    id: 'semantic-style-reconstruction',
    riskFamily: 'parser-edge',
    sourceHtml:
      '<span style="font-weight:700;font-style:italic;text-decoration:underline line-through">styled</span>',
    expectedSanitizedHtml: '<strong><em><u><s>styled</s></u></em></strong>',
  },
] as const;

/** Immutable adversarial corpus shared by every required browser project. */
export const SAFE_CLIPBOARD_CROSS_ENGINE_CORPUS: readonly CrossEngineClipboardCase[] =
  Object.freeze(CORPUS.map((testCase) => Object.freeze({ ...testCase })));

const REQUIRED_ENGINES: readonly CrossEngineClipboardEngine[] = Object.freeze([
  'chromium',
  'firefox',
  'webkit',
]);

/**
 * Require exact rich-clipboard parity across one observation from every engine.
 *
 * The default gate intentionally contains no broad normalization or difference
 * allowlist. A future standards-permitted engine exception must first add a
 * focused corpus case, threat rationale, explicit comparison rule, and rollback
 * note rather than being silently normalized here.
 */
export function assertCrossEngineClipboardConsensus(
  observations: readonly CrossEngineClipboardObservation[],
): void {
  const engines = observations.map((item) => item.engine);
  if (
    observations.length !== REQUIRED_ENGINES.length ||
    REQUIRED_ENGINES.some(
      (engine) => engines.filter((candidate) => candidate === engine).length !== 1,
    )
  ) {
    throw new Error(
      'Cross-engine clipboard evidence requires exactly one observation from chromium, firefox, and webkit.',
    );
  }

  const [reference, ...others] = observations;
  if (!reference) {
    throw new Error(
      'Cross-engine clipboard evidence requires exactly one observation from chromium, firefox, and webkit.',
    );
  }
  if (others.some((item) => item.caseId !== reference.caseId)) {
    throw new Error(
      'Cross-engine clipboard evidence must describe the same corpus case.',
    );
  }
  if (others.some((item) => item.errorCode !== reference.errorCode)) {
    throw new Error(
      'Cross-engine clipboard rejection behavior differs across browser engines.',
    );
  }
  if (others.some((item) => item.sanitizedHtml !== reference.sanitizedHtml)) {
    throw new Error(
      'Cross-engine clipboard sanitized HTML differs across browser engines.',
    );
  }

  const referenceDocument = canonicalJson(reference.documentJson);
  if (others.some((item) => canonicalJson(item.documentJson) !== referenceDocument)) {
    throw new Error(
      'Cross-engine clipboard document structure differs across browser engines.',
    );
  }
}

function canonicalJson(value: unknown): string {
  return JSON.stringify(value);
}
