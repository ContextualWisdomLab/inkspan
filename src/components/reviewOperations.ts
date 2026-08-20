import { useCallback, useRef } from 'react';
import { TextSelection, type EditorState } from '@tiptap/pm/state';
import { Plugin, PluginKey } from '@tiptap/pm/state';
import { Decoration, DecorationSet } from '@tiptap/pm/view';
import type { Editor } from '@tiptap/react';
import {
  createReviewOperationResult,
  ReviewContractError,
  validateReviewSuggestion,
  type CwlEditorReviewOperation,
  type CwlEditorReviewSuggestion,
  type CwlEditorReviewTarget,
} from '../review/contract.js';
import {
  createTextPositionSelector,
  type CwlEditorTextPositionSelector,
} from '../textPositionSelectorEvidence.js';
import {
  createDocumentEnvelope,
  type DocumentEnvelopeLimits,
} from '../documentEnvelope.js';
import {
  createDocumentEnvelopeRevision,
  type CwlEditorDocumentRevision,
  type DocumentEnvelopeDigestProvider,
} from '../documentEnvelopeRevision.js';
import type { CwlEditorReviewProps } from '../types.js';

interface ReviewRange {
  readonly from: number;
  readonly to: number;
}

export const REVIEW_MARKER_KEY = new PluginKey<DecorationSet>('cwl-review-markers');

/** Compare two immutable revision values without retaining source content. */
function sameRevision(
  left: CwlEditorDocumentRevision,
  right: CwlEditorDocumentRevision,
): boolean {
  return (
    left.algorithm === right.algorithm &&
    left.digestHex === right.digestHex &&
    left.strongEntityTag === right.strongEntityTag
  );
}

/** Convert a validated digest into the provider shape used for known revisions. */
function digestBuffer(revision: CwlEditorDocumentRevision): ArrayBuffer {
  const bytes = new Uint8Array(revision.digestHex.length / 2);
  for (let index = 0; index < bytes.length; index += 1) {
    bytes[index] = Number.parseInt(
      revision.digestHex.slice(index * 2, index * 2 + 2),
      16,
    );
  }
  return bytes.buffer;
}

/** Let the core result builder validate already-derived before/after revisions. */
function knownRevisionProvider(
  previous: CwlEditorDocumentRevision,
  resulting: CwlEditorDocumentRevision,
): DocumentEnvelopeDigestProvider {
  let index = 0;
  return {
    digest: async () => {
      const revision = index++ === 0 ? previous : resulting;
      return digestBuffer(revision);
    },
  };
}

/**
 * Find one exact structural range for a versioned logical-text selector.
 * ponytail: bounded structural scan; build a cached projection index only if
 * large-document profiling shows this O(document positions) lookup matters.
 */
export function findReviewRange(
  editorState: EditorState,
  selector: CwlEditorTextPositionSelector,
): ReviewRange | null {
  let from: number | undefined;
  let to: number | undefined;
  for (let position = 0; position <= editorState.doc.content.size; position += 1) {
    try {
      const resolved = editorState.doc.resolve(position);
      if (!resolved.parent.inlineContent) continue;
      const selection = TextSelection.create(editorState.doc, position, position);
      const projected = createTextPositionSelector(
        editorState.doc,
        selection,
      ).selector;
      if (from === undefined && projected.start === selector.start) {
        from = position;
      }
      if (projected.start === selector.end) {
        to = position;
      }
    } catch {
      // Invalid structural or grapheme boundaries are not selectable targets.
    }
  }
  return from === undefined || to === undefined || from > to
    ? null
    : { from, to };
}

/** Return a stale result without exposing document content or re-anchoring. */
function staleReviewResult(
  operation: CwlEditorReviewOperation,
  beforeRevision: CwlEditorDocumentRevision,
): Readonly<{
  readonly schemaId: 'https://inkspan.io/schemas/review/v1';
  readonly schemaVersion: 1;
  readonly suggestionId: string;
  readonly action: 'accept' | 'reject';
  readonly status: 'stale';
  readonly beforeRevision: CwlEditorDocumentRevision;
}> {
  return Object.freeze({
    schemaId: 'https://inkspan.io/schemas/review/v1' as const,
    schemaVersion: 1 as const,
    suggestionId: operation.suggestion.suggestionId,
    action: operation.action,
    status: 'stale' as const,
    beforeRevision,
  });
}

/** Apply one review operation through the real editor transaction boundary. */
export async function applyReviewOperation(
  editor: Editor,
  operation: CwlEditorReviewOperation,
  limits?: DocumentEnvelopeLimits,
  digestProvider?: DocumentEnvelopeDigestProvider | null,
) {
  const suggestion = validateReviewSuggestion(operation.suggestion);
  const previousEnvelope = createDocumentEnvelope(editor.getJSON(), limits);
  const previousRevision = await createDocumentEnvelopeRevision(
    previousEnvelope,
    limits,
    digestProvider,
  );
  if (!sameRevision(previousRevision, suggestion.expectedRevision)) {
    return staleReviewResult(operation, previousRevision);
  }

  const range = findReviewRange(editor.state, suggestion.target.selector);
  if (!range) throw new ReviewContractError('selector_out_of_range');

  const transaction = editor.state.tr;
  if (operation.action === 'accept') {
    if (suggestion.kind === 'insert') {
      transaction.insertText(suggestion.text, range.from, range.to);
    } else {
      transaction.delete(range.from, range.to);
    }
    if (!transaction.docChanged) {
      throw new ReviewContractError('operation_must_change_document');
    }
  }

  const resultingEnvelope = operation.action === 'accept'
    ? createDocumentEnvelope(transaction.doc.toJSON(), limits)
    : previousEnvelope;
  const resultingRevision = operation.action === 'accept'
    ? await createDocumentEnvelopeRevision(resultingEnvelope, limits, digestProvider)
    : previousRevision;
  const result = await createReviewOperationResult(
    operation,
    previousEnvelope,
    resultingEnvelope,
    limits,
    knownRevisionProvider(previousRevision, resultingRevision),
  );
  if (result.status === 'accepted') editor.view.dispatch(transaction);
  return result;
}

/** Build accessible inline review markers for one editor state. */
function reviewDecorations(
  state: EditorState,
  review: CwlEditorReviewProps,
): DecorationSet {
  const decorations: Decoration[] = [];
  for (const thread of review.threads ?? []) {
    const range = findReviewRange(state, thread.target.selector);
    if (range && range.from < range.to) {
      decorations.push(
        Decoration.inline(range.from, range.to, {
          class: 'cwl-review-marker cwl-review-marker--thread',
          'data-review-id': thread.threadId,
          'data-review-state': thread.state,
        }),
      );
    }
  }
  for (const suggestion of review.suggestions ?? []) {
    const range = findReviewRange(state, suggestion.target.selector);
    if (!range) continue;
    if (range.from === range.to) {
      decorations.push(
        Decoration.widget(range.from, () => {
          const marker = document.createElement('span');
          marker.className =
            'cwl-review-marker cwl-review-marker--suggestion cwl-review-marker--widget';
          marker.dataset.reviewId = suggestion.suggestionId;
          marker.setAttribute('aria-hidden', 'true');
          marker.textContent = '•';
          return marker;
        }),
      );
    } else {
      decorations.push(
        Decoration.inline(range.from, range.to, {
          class: 'cwl-review-marker cwl-review-marker--suggestion',
          'data-review-id': suggestion.suggestionId,
          'data-review-state': suggestion.state,
        }),
      );
    }
  }
  return DecorationSet.create(state.doc, decorations);
}

/** Register a replaceable marker plugin for controlled review metadata. */
export function createReviewMarkerPlugin(review: CwlEditorReviewProps) {
  return new Plugin({
    key: REVIEW_MARKER_KEY,
    state: {
      init: (_, state) => reviewDecorations(state, review),
      apply: (_, _old, _oldState, state) => reviewDecorations(state, review),
    },
    props: {
      decorations: (state) =>
        REVIEW_MARKER_KEY.getState(state) ?? DecorationSet.empty,
    },
  });
}

/** Coordinate host callbacks, exact-once local state, and marker selection. */
export function useReviewActions(
  editor: Editor | null,
  review: CwlEditorReviewProps | undefined,
) {
  const finalizedIdsRef = useRef(new Set<string>());
  const reviewRef = useRef(review);
  reviewRef.current = review;

  const reportError = useCallback((error: unknown) => {
    const safeError =
      error instanceof ReviewContractError
        ? error
        : new ReviewContractError('invalid_review_contract');
    try {
      reviewRef.current?.onError?.(safeError);
    } catch {
      // Host presentation failures must not change local editor state.
    }
  }, []);

  const onReviewAction = useCallback(
    async (suggestion: CwlEditorReviewSuggestion, action: 'accept' | 'reject') => {
      if (!editor) return;
      if (finalizedIdsRef.current.has(suggestion.suggestionId)) {
        reportError(new ReviewContractError('operation_already_final'));
        return;
      }
      try {
        const result = await applyReviewOperation(editor, { suggestion, action });
        if (result.status !== 'stale') {
          finalizedIdsRef.current.add(suggestion.suggestionId);
        }
        await reviewRef.current?.onOperation?.(result);
      } catch (error) {
        reportError(error);
      }
    },
    [editor, reportError],
  );

  const onReviewSelect = useCallback(
    (target: CwlEditorReviewTarget) => {
      if (!editor) return;
      const range = findReviewRange(editor.state, target.selector);
      if (!range) {
        reportError(new ReviewContractError('selector_out_of_range'));
        return;
      }
      editor.commands.setTextSelection(range);
      editor.commands.focus();
    },
    [editor, reportError],
  );

  return { finalizedIdsRef, onReviewAction, onReviewSelect };
}
