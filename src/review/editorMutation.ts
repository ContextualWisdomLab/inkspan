import type { Editor } from '@tiptap/react';
import { TextSelection } from '@tiptap/pm/state';
import {
  createDocumentEnvelope,
  type DocumentEnvelopeLimits,
} from '../documentEnvelope.js';
import type { DocumentEnvelopeDigestProvider } from '../documentEnvelopeRevision.js';
import { createTextPositionSelector } from '../textPositionSelectorEvidence.js';
import {
  assertReviewSuggestionCurrentRevision,
  createReviewOperationResult,
  CwlReviewOperationError,
  type CwlReviewOperationResult,
} from './index.js';

const BLOCK_SEPARATOR = '\n';
const LEAF_TEXT = '\uFFFC';

function projectedLength(editor: Editor, to: number): number {
  return Array.from(
    editor.state.doc.textBetween(0, to, BLOCK_SEPARATOR, LEAF_TEXT),
  ).length;
}

function firstPosition(
  editor: Editor,
  offset: number,
  strictlyGreater: boolean,
): number {
  let low = 0;
  let high = editor.state.doc.content.size + 1;
  while (low < high) {
    const middle = Math.floor((low + high) / 2);
    const length = projectedLength(
      editor,
      Math.min(middle, editor.state.doc.content.size),
    );
    if (length > offset || (!strictlyGreater && length === offset)) {
      high = middle;
    } else {
      low = middle + 1;
    }
  }
  return low;
}

function resolvePosition(editor: Editor, offset: number): number {
  const first = firstPosition(editor, offset, false);
  const after = firstPosition(editor, offset, true);

  for (let position = first; position < after; position += 1) {
    try {
      if (!editor.state.doc.resolve(position).parent.inlineContent) continue;
      const selection = TextSelection.create(editor.state.doc, position);
      const projected = createTextPositionSelector(editor.state.doc, selection);
      /* v8 ignore next -- binary search and selector use the same v1 projection. */
      if (projected.selector.start !== offset) continue;
      return position;
    } catch {}
  }

  throw new CwlReviewOperationError('invalid_operation');
}

/** Apply one exact-revision review decision to an active editor. */
export async function applyReviewSuggestionDecision(
  editor: Editor,
  suggestionSource: unknown,
  action: 'accept' | 'reject',
  limits?: DocumentEnvelopeLimits,
  digestProvider?: DocumentEnvelopeDigestProvider | null,
): Promise<CwlReviewOperationResult> {
  if (action !== 'accept' && action !== 'reject') {
    throw new CwlReviewOperationError('invalid_operation');
  }

  const state = editor.state;
  const previousEnvelope = createDocumentEnvelope(state.doc.toJSON(), limits);
  const suggestion = await assertReviewSuggestionCurrentRevision(
    suggestionSource,
    previousEnvelope,
    limits,
    digestProvider,
  );
  if (editor.state !== state) throw new CwlReviewOperationError('stale_operation');

  if (action === 'accept') {
    const from = resolvePosition(editor, suggestion.target.selector.start);
    const to = resolvePosition(editor, suggestion.target.selector.end);
    const transaction =
      suggestion.kind === 'insert'
        ? state.tr.insertText(suggestion.text, from)
        : state.tr.delete(from, to);
    const resultingEnvelope = createDocumentEnvelope(
      transaction.doc.toJSON(),
      limits,
    );
    const result = await createReviewOperationResult(
      suggestion,
      action,
      previousEnvelope,
      resultingEnvelope,
      limits,
      digestProvider,
    );
    if (editor.state !== state) {
      throw new CwlReviewOperationError('stale_operation');
    }
    editor.view.dispatch(transaction);
    return result;
  }

  return createReviewOperationResult(
    suggestion,
    action,
    previousEnvelope,
    previousEnvelope,
    limits,
    digestProvider,
  );
}
