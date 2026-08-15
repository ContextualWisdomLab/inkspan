import type {
  ClipboardConfig,
  ClipboardSanitizationErrorCode,
} from './extensions/SafeClipboard.js';

/** Version of the release corpus and its interpretation contract. */
export const SAFE_CLIPBOARD_CROSS_ENGINE_CORPUS_VERSION = 1;

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
  | 'parser-edge'
  | 'resource-limit';

/** One immutable public fixture in the cross-engine rich-clipboard corpus. */
export interface CrossEngineClipboardCase {
  readonly id: string;
  readonly riskFamily: CrossEngineClipboardRiskFamily;
  readonly sourceHtml: string;
  readonly expectedSanitizedHtml: string;
  readonly expectedErrorCode: ClipboardSanitizationErrorCode | null;
  readonly clipboardConfig?: ClipboardConfig;
}

/** One browser observation used by the fail-closed release consensus oracle. */
export interface CrossEngineClipboardObservation {
  readonly caseId: string;
  readonly engine: CrossEngineClipboardEngine;
  readonly sanitizedHtml: string | null;
  readonly documentJson: unknown;
  readonly errorCode: ClipboardSanitizationErrorCode | null;
}

const CORPUS: readonly CrossEngineClipboardCase[] = [
  {
    id: 'active-script',
    riskFamily: 'active-content',
    sourceHtml: '<p>safe<script>alert(1)</script></p>',
    expectedSanitizedHtml: '<p>safe</p>',
    expectedErrorCode: null,
  },
  {
    id: 'active-resource-and-form',
    riskFamily: 'active-content',
    sourceHtml:
      '<div>before<iframe src="https://example.invalid/"></iframe><img src="https://example.invalid/x"><form><input value="secret"></form>after</div>',
    expectedSanitizedHtml: '<div>beforeafter</div>',
    expectedErrorCode: null,
  },
  {
    id: 'hidden-display-and-aria',
    riskFamily: 'hidden-content',
    sourceHtml:
      '<p>visible<span style="display:none">display</span><span aria-hidden="true">aria</span>end</p>',
    expectedSanitizedHtml: '<p>visibleend</p>',
    expectedErrorCode: null,
  },
  {
    id: 'hidden-office-eof-comment',
    riskFamily: 'hidden-content',
    sourceHtml:
      '<p>before<span style="mso-hide: all !important; /* office comment">secret</span>after</p>',
    expectedSanitizedHtml: '<p>beforeafter</p>',
    expectedErrorCode: null,
  },
  {
    id: 'hidden-content-visibility-popover',
    riskFamily: 'hidden-content',
    sourceHtml:
      '<div>one<span style="content-visibility: h\\69 dden">two</span><span popover>three</span>four</div>',
    expectedSanitizedHtml: '<div>onefour</div>',
    expectedErrorCode: null,
  },
  {
    id: 'unsafe-javascript-link',
    riskFamily: 'unsafe-link',
    sourceHtml: '<a href="javascript:alert(1)" onclick="alert(2)">click</a>',
    expectedSanitizedHtml: 'click',
    expectedErrorCode: null,
  },
  {
    id: 'safe-https-link',
    riskFamily: 'unsafe-link',
    sourceHtml: '<a href="https://example.com/path">safe</a>',
    expectedSanitizedHtml:
      '<a href="https://example.com/path" rel="noopener noreferrer nofollow">safe</a>',
    expectedErrorCode: null,
  },
  {
    id: 'malformed-formatting',
    riskFamily: 'malformed-markup',
    sourceHtml: '<b><i>text</b></i>',
    expectedSanitizedHtml: '<strong><em>text</em></strong>',
    expectedErrorCode: null,
  },
  {
    id: 'malformed-paragraph',
    riskFamily: 'malformed-markup',
    sourceHtml: '<p>one<p>two',
    expectedSanitizedHtml: '<p>one</p><p>two</p>',
    expectedErrorCode: null,
  },
  {
    id: 'table-parser-repair',
    riskFamily: 'table-list',
    sourceHtml: '<table><tr><td colspan="2">cell</td></tr></table>',
    expectedSanitizedHtml:
      '<table><tbody><tr><td colspan="2">cell</td></tr></tbody></table>',
    expectedErrorCode: null,
  },
  {
    id: 'ordered-list-repair',
    riskFamily: 'table-list',
    sourceHtml: '<ol start="3"><li>one<li>two</ol>',
    expectedSanitizedHtml: '<ol start="3"><li>one</li><li>two</li></ol>',
    expectedErrorCode: null,
  },
  {
    id: 'svg-and-mathml-subtrees',
    riskFamily: 'svg-mathml',
    sourceHtml:
      '<p>a<svg><script>alert(1)</script><text>x</text></svg>b<math><mtext>y</mtext></math>c</p>',
    expectedSanitizedHtml: '<p>abc</p>',
    expectedErrorCode: null,
  },
  {
    id: 'closed-details-summary',
    riskFamily: 'parser-edge',
    sourceHtml: '<details><summary>label</summary><p>secret</p></details>',
    expectedSanitizedHtml: 'label',
    expectedErrorCode: null,
  },
  {
    id: 'dialog-and-native-widget-fallback',
    riskFamily: 'parser-edge',
    sourceHtml:
      '<dialog>closed</dialog><dialog open><p>open</p></dialog><datalist><option>hidden</option></datalist><p>end</p>',
    expectedSanitizedHtml: '<p>open</p><p>end</p>',
    expectedErrorCode: null,
  },
  {
    id: 'semantic-style-reconstruction',
    riskFamily: 'parser-edge',
    sourceHtml:
      '<span style="font-weight:700;font-style:italic;text-decoration:underline line-through">styled</span>',
    expectedSanitizedHtml: '<strong><em><u><s>styled</s></u></em></strong>',
    expectedErrorCode: null,
  },
  {
    id: 'utf8-byte-ceiling',
    riskFamily: 'resource-limit',
    sourceHtml: '<p>private source</p>',
    expectedSanitizedHtml: '',
    expectedErrorCode: 'input_too_large',
    clipboardConfig: { maxHtmlBytes: 1 },
  },
  {
    id: 'node-ceiling',
    riskFamily: 'resource-limit',
    sourceHtml: '<p><span>one</span><span>two</span></p>',
    expectedSanitizedHtml: '',
    expectedErrorCode: 'node_limit_exceeded',
    clipboardConfig: { maxNodes: 2 },
  },
  {
    id: 'depth-ceiling',
    riskFamily: 'resource-limit',
    sourceHtml: '<div><div><p>deep</p></div></div>',
    expectedSanitizedHtml: '',
    expectedErrorCode: 'depth_limit_exceeded',
    clipboardConfig: { maxDepth: 1 },
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
const MAX_DOCUMENT_EVIDENCE_NESTING_DEPTH = 128;
const DOCUMENT_EVIDENCE_STRUCTURE_BOUNDARY_ERROR =
  'Cross-engine clipboard document evidence exceeds the supported structure boundary.';

/**
 * Require exact rich-clipboard parity across one observation from every engine.
 *
 * The gate compares JSON object semantics independent of member insertion order,
 * because JSON object member order carries no document-structure authority. It
 * otherwise contains no broad normalization or engine difference allowlist. A
 * future standards-permitted engine exception must first add a focused corpus
 * case, threat rationale, explicit comparison rule, and rollback note rather
 * than being silently normalized here.
 */
export function assertCrossEngineClipboardConsensus(
  observations: readonly CrossEngineClipboardObservation[],
): void {
  if (observations.length !== REQUIRED_ENGINES.length) {
    throw new Error(
      'Cross-engine clipboard evidence requires exactly one observation from chromium, firefox, and webkit.',
    );
  }

  const engines = observations.map((item) => item.engine);
  if (
    REQUIRED_ENGINES.some(
      (engine) => engines.filter((candidate) => candidate === engine).length !== 1,
    )
  ) {
    throw new Error(
      'Cross-engine clipboard evidence requires exactly one observation from chromium, firefox, and webkit.',
    );
  }

  const [reference, ...others] = observations as readonly [
    CrossEngineClipboardObservation,
    CrossEngineClipboardObservation,
    CrossEngineClipboardObservation,
  ];
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

/** Serialize JSON values with recursively sorted object member names. */
function canonicalJson(value: unknown): string {
  return JSON.stringify(canonicalizeJson(value, 0, new WeakSet<object>()));
}

/** Read one ordinary enumerable JSON data property without invoking its value. */
function readEnumerableJsonDataProperty(
  container: object,
  key: string,
): unknown {
  const descriptor = Object.getOwnPropertyDescriptor(container, key)!;
  if (!descriptor.enumerable || !('value' in descriptor)) {
    throw new Error(DOCUMENT_EVIDENCE_STRUCTURE_BOUNDARY_ERROR);
  }
  return descriptor.value;
}

/** Preserve array order and values while normalizing unordered JSON object members. */
function canonicalizeJson(
  value: unknown,
  depth: number,
  active: WeakSet<object>,
): unknown {
  if (depth > MAX_DOCUMENT_EVIDENCE_NESTING_DEPTH) {
    throw new Error(DOCUMENT_EVIDENCE_STRUCTURE_BOUNDARY_ERROR);
  }
  if (
    value === null ||
    typeof value === 'string' ||
    typeof value === 'boolean'
  ) {
    return value;
  }
  if (typeof value === 'number') {
    if (!Number.isFinite(value)) {
      throw new Error(DOCUMENT_EVIDENCE_STRUCTURE_BOUNDARY_ERROR);
    }
    return value;
  }
  if (typeof value !== 'object') {
    throw new Error(DOCUMENT_EVIDENCE_STRUCTURE_BOUNDARY_ERROR);
  }
  if (active.has(value)) {
    throw new Error(DOCUMENT_EVIDENCE_STRUCTURE_BOUNDARY_ERROR);
  }

  active.add(value);
  try {
    if (Array.isArray(value)) {
      const ownKeys = Reflect.ownKeys(value);
      if (
        ownKeys.length !== value.length + 1 ||
        ownKeys.some((key, index) =>
          index < value.length ? key !== String(index) : key !== 'length',
        )
      ) {
        throw new Error(DOCUMENT_EVIDENCE_STRUCTURE_BOUNDARY_ERROR);
      }
      const keys = ownKeys.slice(0, -1) as string[];
      return keys.map((key) =>
        canonicalizeJson(
          readEnumerableJsonDataProperty(value, key),
          depth + 1,
          active,
        ),
      );
    }

    const prototype = Object.getPrototypeOf(value);
    if (prototype !== Object.prototype && prototype !== null) {
      throw new Error(DOCUMENT_EVIDENCE_STRUCTURE_BOUNDARY_ERROR);
    }

    const record = value as Record<string, unknown>;
    const ownKeys = Reflect.ownKeys(record);
    if (ownKeys.some((key) => typeof key !== 'string')) {
      throw new Error(DOCUMENT_EVIDENCE_STRUCTURE_BOUNDARY_ERROR);
    }
    const keys = ownKeys as string[];
    return Object.fromEntries(
      keys
        .sort()
        .map((key) => [
          key,
          canonicalizeJson(
            readEnumerableJsonDataProperty(record, key),
            depth + 1,
            active,
          ),
        ]),
    );
  } finally {
    active.delete(value);
  }
}
