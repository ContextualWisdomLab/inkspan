import type { Node as ProseMirrorNode } from '@tiptap/pm/model';
import type { Selection } from '@tiptap/pm/state';
import type { CwlEditorDocumentRevision } from './documentEnvelopeRevision.js';

/** Stable identity of Inkspan's first W3C-compatible logical text projection. */
export const TEXT_POSITION_PROJECTION_ID = 'inkspan-prosemirror-text' as const;

/** Version of the logical text projection used by text-position evidence. */
export const TEXT_POSITION_PROJECTION_VERSION = 1 as const;

const BLOCK_SEPARATOR = '\n';
const LEAF_TEXT = '\uFFFC';

/** Stable failure codes for text-position evidence construction. */
export type TextPositionSelectorEvidenceErrorCode =
  | 'grapheme_boundary'
  | 'segmenter_unavailable';

/** W3C Web Annotation text-position selector for one projected text range. */
export interface CwlEditorTextPositionSelector {
  /** W3C selector class name. */
  readonly type: 'TextPositionSelector';
  /** Inclusive Unicode-code-point offset in the versioned text projection. */
  readonly start: number;
  /** Exclusive Unicode-code-point offset in the versioned text projection. */
  readonly end: number;
}

/** Identity of the deterministic text stream indexed by selector offsets. */
export interface CwlEditorTextProjectionIdentity {
  /** Stable projection family identifier. */
  readonly id: typeof TEXT_POSITION_PROJECTION_ID;
  /** Version whose separator and leaf-node semantics define this text stream. */
  readonly version: typeof TEXT_POSITION_PROJECTION_VERSION;
}

/** Privacy-minimized W3C selector evidence bound to one exact Inkspan revision. */
export interface CwlEditorTextPositionSelectorEvidence {
  /** SHA-256 content revision for the same immutable editor state. */
  readonly revision: CwlEditorDocumentRevision;
  /** Text range expressed in Unicode code points for `textProjection`. */
  readonly selector: CwlEditorTextPositionSelector;
  /** Projection identity required to interpret `selector` positions. */
  readonly textProjection: CwlEditorTextProjectionIdentity;
}

/** Raised when a structural selection cannot safely become text-position evidence. */
export class TextPositionSelectorEvidenceError extends Error {
  /** Stable public failure classification. */
  readonly code: TextPositionSelectorEvidenceErrorCode;

  constructor(code: TextPositionSelectorEvidenceErrorCode) {
    super(
      code === 'grapheme_boundary'
        ? 'Text-position evidence requires grapheme-cluster selection boundaries.'
        : 'Text-position evidence requires Unicode grapheme segmentation support.',
    );
    this.name = 'TextPositionSelectorEvidenceError';
    this.code = code;
  }
}

interface GraphemeSegment {
  readonly index: number;
}

interface GraphemeSegmenter {
  segment(input: string): Iterable<GraphemeSegment>;
}

interface GraphemeSegmenterConstructor {
  new (
    locales?: string | readonly string[],
    options?: { readonly granularity: 'grapheme' },
  ): GraphemeSegmenter;
}

/** Project a prefix of one ProseMirror document under the versioned v1 rules. */
function projectDocumentPrefix(documentNode: ProseMirrorNode, to: number): string {
  return documentNode.textBetween(0, to, BLOCK_SEPARATOR, LEAF_TEXT);
}

/** Count Unicode code points without materializing a second prefix-sized array. */
function codePointLength(value: string): number {
  let length = 0;
  for (const codePoint of value) {
    if (codePoint.length > 0) length += 1;
  }
  return length;
}

/** Require both positions to coincide with Unicode grapheme-cluster boundaries. */
function assertGraphemeBoundaries(
  text: string,
  startCodeUnitOffset: number,
  endCodeUnitOffset: number,
): void {
  const Segmenter = (
    Intl as unknown as { Segmenter?: GraphemeSegmenterConstructor }
  ).Segmenter;
  if (typeof Segmenter !== 'function') {
    throw new TextPositionSelectorEvidenceError('segmenter_unavailable');
  }

  let startIsBoundary =
    startCodeUnitOffset === 0 || startCodeUnitOffset === text.length;
  let endIsBoundary = endCodeUnitOffset === 0 || endCodeUnitOffset === text.length;
  if (startIsBoundary && endIsBoundary) return;

  for (const segment of new Segmenter(undefined, { granularity: 'grapheme' }).segment(
    text,
  )) {
    if (!startIsBoundary) {
      if (segment.index === startCodeUnitOffset) {
        startIsBoundary = true;
      } else if (segment.index > startCodeUnitOffset) {
        throw new TextPositionSelectorEvidenceError('grapheme_boundary');
      }
    }

    if (!endIsBoundary) {
      if (segment.index === endCodeUnitOffset) {
        endIsBoundary = true;
      } else if (segment.index > endCodeUnitOffset) {
        throw new TextPositionSelectorEvidenceError('grapheme_boundary');
      }
    }

    if (startIsBoundary && endIsBoundary) return;
  }

  throw new TextPositionSelectorEvidenceError('grapheme_boundary');
}

/**
 * Convert one ProseMirror structural selection into a deterministic W3C text range.
 *
 * Projection version 1 uses logical ProseMirror document order, `\n` between
 * blocks, and U+FFFC OBJECT REPLACEMENT CHARACTER for non-text leaf nodes. The
 * returned offsets count Unicode code points. Selection boundaries must also be
 * Unicode grapheme-cluster boundaries; runtimes without `Intl.Segmenter` fail
 * closed instead of publishing ambiguous evidence. The caller must bind the
 * result to the same immutable document revision; this helper contains no
 * selected text.
 */
export function createTextPositionSelector(
  documentNode: ProseMirrorNode,
  selection: Selection,
): Readonly<{
  selector: CwlEditorTextPositionSelector;
  textProjection: CwlEditorTextProjectionIdentity;
}> {
  const fullText = projectDocumentPrefix(documentNode, documentNode.content.size);
  const startPrefix = projectDocumentPrefix(documentNode, selection.from);
  const endPrefix = projectDocumentPrefix(documentNode, selection.to);

  assertGraphemeBoundaries(fullText, startPrefix.length, endPrefix.length);

  const selector = Object.freeze({
    type: 'TextPositionSelector' as const,
    start: codePointLength(startPrefix),
    end: codePointLength(endPrefix),
  });
  const textProjection = Object.freeze({
    id: TEXT_POSITION_PROJECTION_ID,
    version: TEXT_POSITION_PROJECTION_VERSION,
  });
  return Object.freeze({ selector, textProjection });
}
