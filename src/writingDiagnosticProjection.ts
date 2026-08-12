import type { Node as ProseMirrorNode } from '@tiptap/pm/model';
import { classifyGraphemeBoundary } from './graphemeBoundary.js';
import {
  TEXT_POSITION_PROJECTION_ID,
  TEXT_POSITION_PROJECTION_VERSION,
  type CwlEditorTextPositionSelector,
  type CwlEditorTextProjectionIdentity,
} from './textPositionSelectorEvidence.js';

const BLOCK_SEPARATOR = '\n';
const LEAF_TEXT = '\uFFFC';
const PROJECTION_FIELDS = Object.freeze(['id', 'version'] as const);
const SELECTOR_FIELDS = Object.freeze(['type', 'start', 'end'] as const);

/** Stable failure codes for inverse writing-diagnostic text projection. */
export type WritingDiagnosticProjectionErrorCode =
  | 'projection'
  | 'selector'
  | 'grapheme_boundary'
  | 'segmenter_unavailable'
  | 'ambiguous_boundary';

const ERROR_MESSAGES: Readonly<
  Record<WritingDiagnosticProjectionErrorCode, string>
> = Object.freeze({
  projection: 'Writing diagnostic text projection is unsupported.',
  selector: 'Writing diagnostic text selector is invalid.',
  grapheme_boundary:
    'Writing diagnostic selectors require grapheme-cluster boundaries.',
  segmenter_unavailable:
    'Writing diagnostic selectors require Unicode grapheme segmentation support.',
  ambiguous_boundary:
    'Writing diagnostic selector boundary is structurally ambiguous.',
});

/** Raised when a projected selector cannot map to one exact structural range. */
export class WritingDiagnosticProjectionError extends RangeError {
  /** Stable redacted public failure classification. */
  readonly code: WritingDiagnosticProjectionErrorCode;

  constructor(code: WritingDiagnosticProjectionErrorCode) {
    super(ERROR_MESSAGES[code]);
    this.name = 'WritingDiagnosticProjectionError';
    this.code = code;
  }
}

/**
 * One deterministic projection plus an inverse boundary map.
 *
 * `boundaryPositions[n]` is the exact ProseMirror position for Unicode-code-point
 * boundary `n`, or `null` when no single structural position can represent that
 * projected boundary. Invalid offsets are repeated in
 * `ambiguousBoundaryOffsets` for bounded diagnostics and operator evidence.
 */
export interface CwlWritingDiagnosticTextProjectionMap {
  /** Exact v1 projected text emitted by ProseMirror `textBetween`. */
  readonly text: string;
  /** ProseMirror position for every Unicode-code-point boundary. */
  readonly boundaryPositions: readonly (number | null)[];
  /** Projection offsets that do not have exactly one structural position. */
  readonly ambiguousBoundaryOffsets: readonly number[];
}

/**
 * Build the exact inverse map for Inkspan text-projection version 1.
 *
 * The traversal mirrors ProseMirror's `Fragment.textBetween` contract: logical
 * document order, `\n` before a block when prior emitted content has not yet
 * been separated, and U+FFFC for non-text leaf nodes. One scalar-or-null slot is
 * retained per projected boundary instead of a Set per code point, keeping the
 * map linear and bounded by the projected text length. The implementation does
 * not search for text, repair selectors, inspect language semantics, or mutate
 * the document.
 */
export function buildTextProjectionMap(
  documentNode: ProseMirrorNode,
): Readonly<CwlWritingDiagnosticTextProjectionMap> {
  const textParts: string[] = [];
  const boundaryCandidates: Array<number | null | undefined> = [undefined];
  let codePointOffset = 0;
  let separated = true;

  const addBoundaryCandidate = (position: number): void => {
    const existing = boundaryCandidates[codePointOffset];
    if (existing === undefined) {
      boundaryCandidates[codePointOffset] = position;
    } else if (existing !== position) {
      boundaryCandidates[codePointOffset] = null;
    }
  };

  const appendProjectedCodePoint = (value: string): void => {
    textParts.push(value);
    codePointOffset += 1;
    boundaryCandidates.push(undefined);
  };

  documentNode.descendants((node, position) => {
    if (!separated && node.isBlock) {
      appendProjectedCodePoint(BLOCK_SEPARATOR);
      separated = true;
    }

    if (node.isText) {
      const text = node.text!;
      let codeUnitOffset = 0;
      for (const character of text) {
        addBoundaryCandidate(position + codeUnitOffset);
        appendProjectedCodePoint(character);
        codeUnitOffset += character.length;
        addBoundaryCandidate(position + codeUnitOffset);
      }
      separated = false;
      return false;
    }

    if (node.isLeaf) {
      addBoundaryCandidate(position);
      appendProjectedCodePoint(LEAF_TEXT);
      addBoundaryCandidate(position + node.nodeSize);
      separated = false;
      return false;
    }

    if (node.inlineContent) {
      addBoundaryCandidate(position + 1);
    }
    return true;
  });

  const boundaryPositions = boundaryCandidates.map((candidate) =>
    candidate === undefined ? null : candidate,
  );
  const ambiguousBoundaryOffsets = boundaryPositions.flatMap(
    (candidate, offset) => (candidate === null ? [offset] : []),
  );

  return Object.freeze({
    text: textParts.join(''),
    boundaryPositions: Object.freeze(boundaryPositions),
    ambiguousBoundaryOffsets: Object.freeze(ambiguousBoundaryOffsets),
  });
}

/**
 * Resolve one revision-scoped W3C text-position selector to ProseMirror positions.
 *
 * Callers must still verify the diagnostic's declared strong document revision
 * against the same immutable document snapshot. This function reads only exact
 * own enumerable data properties from the untrusted selector/projection values,
 * validates grapheme boundaries, and fails closed when an offset cannot map to
 * one exact position. It never performs nearest-text or semantic fallback.
 */
export function resolveTextPositionSelector(
  documentNode: ProseMirrorNode,
  selector: CwlEditorTextPositionSelector,
  textProjection: CwlEditorTextProjectionIdentity,
): Readonly<{ from: number; to: number }> {
  const projectionRecord = readExactDataObject(
    textProjection,
    PROJECTION_FIELDS,
    'projection',
  );
  if (
    projectionRecord.id !== TEXT_POSITION_PROJECTION_ID ||
    projectionRecord.version !== TEXT_POSITION_PROJECTION_VERSION
  ) {
    throw new WritingDiagnosticProjectionError('projection');
  }

  const selectorRecord = readExactDataObject(
    selector,
    SELECTOR_FIELDS,
    'selector',
  );
  const start = selectorRecord.start;
  const end = selectorRecord.end;
  if (
    selectorRecord.type !== 'TextPositionSelector' ||
    !Number.isSafeInteger(start) ||
    !Number.isSafeInteger(end) ||
    (start as number) < 0 ||
    (end as number) < (start as number)
  ) {
    throw new WritingDiagnosticProjectionError('selector');
  }

  const projection = buildTextProjectionMap(documentNode);
  if ((end as number) >= projection.boundaryPositions.length) {
    throw new WritingDiagnosticProjectionError('selector');
  }

  const codeUnitBoundaries = codePointBoundaryCodeUnits(projection.text);
  assertProjectedGraphemeBoundary(
    projection.text,
    codeUnitBoundaries[start as number]!,
  );
  assertProjectedGraphemeBoundary(
    projection.text,
    codeUnitBoundaries[end as number]!,
  );

  const from = projection.boundaryPositions[start as number];
  const to = projection.boundaryPositions[end as number];
  if (from === null || to === null) {
    throw new WritingDiagnosticProjectionError('ambiguous_boundary');
  }
  if (from > to) {
    throw new WritingDiagnosticProjectionError('ambiguous_boundary');
  }
  return Object.freeze({ from, to });
}

/** Return UTF-16 offsets for every Unicode-code-point boundary in one string. */
function codePointBoundaryCodeUnits(text: string): readonly number[] {
  const offsets = [0];
  let codeUnitOffset = 0;
  for (const character of text) {
    codeUnitOffset += character.length;
    offsets.push(codeUnitOffset);
  }
  return offsets;
}

/** Convert the shared grapheme classifier into this module's public error type. */
function assertProjectedGraphemeBoundary(
  text: string,
  codeUnitOffset: number,
): void {
  const boundaryState = classifyGraphemeBoundary(text, codeUnitOffset);
  if (boundaryState === 'unavailable') {
    throw new WritingDiagnosticProjectionError('segmenter_unavailable');
  }
  if (boundaryState !== 'boundary') {
    throw new WritingDiagnosticProjectionError('grapheme_boundary');
  }
}

/** Read one exact own-data object without invoking inherited or accessor code. */
function readExactDataObject<K extends string>(
  value: unknown,
  expectedFields: readonly K[],
  errorCode: Extract<
    WritingDiagnosticProjectionErrorCode,
    'projection' | 'selector'
  >,
): Readonly<Record<K, unknown>> {
  let isArray: boolean;
  let prototype: object | null;
  let keys: PropertyKey[];
  try {
    isArray = Array.isArray(value);
    if (typeof value !== 'object' || value === null || isArray) {
      throw new WritingDiagnosticProjectionError(errorCode);
    }
    prototype = Object.getPrototypeOf(value);
    keys = Reflect.ownKeys(value);
  } catch (error) {
    if (error instanceof WritingDiagnosticProjectionError) {
      throw error;
    }
    throw new WritingDiagnosticProjectionError(errorCode);
  }

  if (prototype !== Object.prototype && prototype !== null) {
    throw new WritingDiagnosticProjectionError(errorCode);
  }
  if (keys.length !== expectedFields.length) {
    throw new WritingDiagnosticProjectionError(errorCode);
  }

  const expected = new Set<string>(expectedFields);
  const result = {} as Record<K, unknown>;
  for (const key of keys) {
    if (typeof key !== 'string' || !expected.has(key)) {
      throw new WritingDiagnosticProjectionError(errorCode);
    }
    let descriptor: PropertyDescriptor | undefined;
    try {
      descriptor = Object.getOwnPropertyDescriptor(value, key);
    } catch {
      throw new WritingDiagnosticProjectionError(errorCode);
    }
    if (
      descriptor === undefined ||
      descriptor.enumerable !== true ||
      !Object.prototype.hasOwnProperty.call(descriptor, 'value')
    ) {
      throw new WritingDiagnosticProjectionError(errorCode);
    }
    Object.defineProperty(result, key, {
      value: descriptor.value,
      enumerable: true,
      configurable: true,
      writable: true,
    });
  }
  for (const field of expectedFields) {
    if (!Object.prototype.hasOwnProperty.call(result, field)) {
      throw new WritingDiagnosticProjectionError(errorCode);
    }
  }
  return result;
}
