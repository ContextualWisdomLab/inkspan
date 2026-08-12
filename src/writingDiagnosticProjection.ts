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
 * been separated, and U+FFFC for non-text leaf nodes. The implementation does
 * not search for text, repair selectors, inspect language semantics, or mutate
 * the document.
 */
export function buildTextProjectionMap(
  documentNode: ProseMirrorNode,
): Readonly<CwlWritingDiagnosticTextProjectionMap> {
  const textParts: string[] = [];
  const boundaryCandidates: Set<number>[] = [new Set<number>()];
  let codePointOffset = 0;
  let separated = true;

  const currentCandidates = (): Set<number> =>
    boundaryCandidates[codePointOffset] ??
    (() => {
      const candidates = new Set<number>();
      boundaryCandidates[codePointOffset] = candidates;
      return candidates;
    })();

  const addBoundaryCandidate = (position: number): void => {
    currentCandidates().add(position);
  };

  const appendProjectedCodePoint = (value: string): void => {
    textParts.push(value);
    codePointOffset += 1;
    boundaryCandidates.push(new Set<number>());
  };

  documentNode.descendants((node, position) => {
    if (node.isText) {
      const text = node.text ?? '';
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

    if (!separated && node.isBlock) {
      appendProjectedCodePoint(BLOCK_SEPARATOR);
      separated = true;
    }
    if (node.inlineContent) {
      addBoundaryCandidate(position + 1);
    }
    return true;
  });

  const boundaryPositions = boundaryCandidates.map((candidates) =>
    candidates.size === 1 ? candidates.values().next().value ?? null : null,
  );
  const ambiguousBoundaryOffsets = boundaryCandidates.flatMap(
    (candidates, offset) => (candidates.size === 1 ? [] : [offset]),
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
 * against the same immutable document snapshot. This function validates the
 * projection and selector, requires grapheme boundaries, and fails closed when
 * an offset cannot map to one exact position. It never performs nearest-text or
 * semantic fallback.
 */
export function resolveTextPositionSelector(
  documentNode: ProseMirrorNode,
  selector: CwlEditorTextPositionSelector,
  textProjection: CwlEditorTextProjectionIdentity,
): Readonly<{ from: number; to: number }> {
  if (
    textProjection.id !== TEXT_POSITION_PROJECTION_ID ||
    textProjection.version !== TEXT_POSITION_PROJECTION_VERSION
  ) {
    throw new WritingDiagnosticProjectionError('projection');
  }
  if (
    selector.type !== 'TextPositionSelector' ||
    !Number.isSafeInteger(selector.start) ||
    !Number.isSafeInteger(selector.end) ||
    selector.start < 0 ||
    selector.end < selector.start
  ) {
    throw new WritingDiagnosticProjectionError('selector');
  }

  const projection = buildTextProjectionMap(documentNode);
  if (selector.end >= projection.boundaryPositions.length) {
    throw new WritingDiagnosticProjectionError('selector');
  }

  const codeUnitBoundaries = codePointBoundaryCodeUnits(projection.text);
  assertProjectedGraphemeBoundary(
    projection.text,
    codeUnitBoundaries[selector.start]!,
  );
  assertProjectedGraphemeBoundary(
    projection.text,
    codeUnitBoundaries[selector.end]!,
  );

  const from = projection.boundaryPositions[selector.start];
  const to = projection.boundaryPositions[selector.end];
  if (from === null || from === undefined || to === null || to === undefined) {
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
