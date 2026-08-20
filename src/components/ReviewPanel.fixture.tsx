import type { CwlEditorReviewProps } from '../types.js';
import type { CwlEditorReviewTarget } from '../review/contract.js';
import { ReviewPanel } from './ReviewPanel.js';

/** Render-ready states used by repository tests and manual accessibility checks. */
export type ReviewPanelFixtureState =
  | 'pending-insert'
  | 'pending-delete'
  | 'resolved'
  | 'empty';

const FIXTURE_REVISION = Object.freeze({
  algorithm: 'SHA-256' as const,
  digestHex: '01'.repeat(32),
  strongEntityTag: `"sha256-${'01'.repeat(32)}"`,
});

const FIXTURE_TARGET: CwlEditorReviewTarget = Object.freeze({
  revision: FIXTURE_REVISION,
  selector: Object.freeze({
    type: 'TextPositionSelector' as const,
    start: 0,
    end: 0,
  }),
  textProjection: Object.freeze({
    id: 'inkspan-prosemirror-text' as const,
    version: 1 as const,
  }),
});

function fixtureReview(state: ReviewPanelFixtureState): CwlEditorReviewProps {
  if (state === 'empty') return {};
  if (state === 'resolved') {
    return {
      threads: [{
        threadId: 'fixture-thread',
        target: { ...FIXTURE_TARGET, selector: { ...FIXTURE_TARGET.selector, end: 1 } },
        state: 'resolved',
        replyCount: 2,
      }],
      suggestions: [{
        suggestionId: 'fixture-accepted',
        kind: 'insert',
        state: 'accepted',
        expectedRevision: FIXTURE_REVISION,
        target: FIXTURE_TARGET,
        text: 'accepted text',
      }],
    };
  }
  if (state === 'pending-delete') {
    return {
      suggestions: [{
        suggestionId: 'fixture-delete',
        kind: 'delete',
        state: 'pending',
        expectedRevision: FIXTURE_REVISION,
        target: { ...FIXTURE_TARGET, selector: { ...FIXTURE_TARGET.selector, end: 1 } },
      }],
    };
  }
  return {
    suggestions: [{
      suggestionId: 'fixture-insert',
      kind: 'insert',
      state: 'pending',
      expectedRevision: FIXTURE_REVISION,
      target: FIXTURE_TARGET,
      text: 'pending text',
    }],
  };
}

/** Minimal Storybook-equivalent render fixture with pending/final/empty states. */
export function ReviewPanelFixture({ state }: { readonly state: ReviewPanelFixtureState }) {
  return (
    <ReviewPanel
      review={fixtureReview(state)}
      onAction={async () => undefined}
      onSelect={() => undefined}
    />
  );
}
