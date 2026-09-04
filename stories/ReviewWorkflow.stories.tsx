import type { Meta, StoryObj } from '@storybook/react';

import {
  CwlReviewThreadList,
  type CwlReviewThreadListLabels,
} from '../src/review-react/index.js';
import '../src/styles.css';

const digestHex = 'a'.repeat(64);
const target = {
  contractVersion: 1,
  revision: {
    algorithm: 'SHA-256',
    digestHex,
    strongEntityTag: `"sha256-${digestHex}"`,
  },
  selector: { type: 'TextPositionSelector', start: 4, end: 12 },
  projection: { id: 'inkspan-prosemirror-text', version: 1 },
};

const presentation = (
  threadKey: string,
  state: 'unresolved' | 'resolved',
  selected: boolean,
  canReply = true,
  canResolve = state === 'unresolved',
) => ({
  contractVersion: 1,
  threadKey,
  target,
  state,
  commentCount: state === 'resolved' ? 3 : 1,
  selected,
  canReply,
  canResolve,
});

const labels: CwlReviewThreadListLabels = {
  region: 'Document review',
  thread: (thread) => `Review ${thread.threadKey}`,
  status: (thread) =>
    thread.state === 'resolved' ? 'Resolved' : 'Needs review',
  comments: (thread) => `${thread.commentCount} comments`,
  reply: 'Reply',
  resolve: 'Resolve',
};

const disabledLabels: CwlReviewThreadListLabels = {
  ...labels,
  status: () => 'Target is out of date. Refresh the document before acting.',
};

const noOp = () => undefined;

const meta = {
  title: 'Review Workflow',
  component: CwlReviewThreadList,
  parameters: { layout: 'centered' },
  args: {
    labels,
    onSelectThread: noOp,
    onReplyThread: noOp,
    onResolveThread: noOp,
  },
} satisfies Meta<typeof CwlReviewThreadList>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Normal: Story = {
  args: { presentations: [presentation('A-104', 'unresolved', false)] },
};

export const SelectedUnresolved: Story = {
  args: { presentations: [presentation('A-104', 'unresolved', true)] },
};

export const Resolved: Story = {
  args: { presentations: [presentation('A-104', 'resolved', false)] },
};

export const Stale: Story = {
  args: {
    presentations: [presentation('A-104', 'unresolved', true, false, false)],
    labels: disabledLabels,
  },
};

export const PermissionDisabled: Story = {
  args: {
    presentations: [presentation('A-104', 'unresolved', false, false, false)],
  },
};

export const NarrowScreen: Story = {
  decorators: [(Story) => <div style={{ width: 280 }}><Story /></div>],
  args: {
    presentations: [
      presentation('A-104', 'unresolved', true),
      presentation('A-105', 'resolved', false),
    ],
  },
};

export const ForcedColors: Story = {
  name: 'Forced Colors (use OS/browser emulation)',
  args: { presentations: [presentation('A-104', 'unresolved', true)] },
};

export const PrintExcluded: Story = {
  args: {
    presentations: [presentation('A-104', 'unresolved', true)],
    printMode: 'exclude',
  },
};

export const PrintIncluded: Story = {
  args: {
    presentations: [presentation('A-104', 'unresolved', true)],
    printMode: 'include',
  },
};
