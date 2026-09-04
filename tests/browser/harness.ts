import { Editor } from '@tiptap/core';
import { createElement } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import {
  ClipboardSanitizationError,
  buildExtensions,
  sanitizeRichClipboardHtml,
  type ClipboardConfig,
  type ClipboardSanitizationErrorCode,
} from 'inkspan-browser-under-test';
import {
  CwlReviewSuggestionDecision,
  CwlReviewThreadList,
} from 'inkspan-review-react-under-test';

interface BrowserClipboardProbeRequest {
  readonly sourceHtml: string;
  readonly clipboardConfig?: ClipboardConfig;
}

interface BrowserClipboardProbeResult {
  readonly sanitizedHtml: string;
  readonly documentJson: unknown;
  readonly errorCode: ClipboardSanitizationErrorCode | null;
}

interface BrowserHostileDocumentProbeResult {
  readonly errorCode: ClipboardSanitizationErrorCode | null;
  readonly message: string;
}

interface BrowserReviewIntent {
  readonly action: 'select' | 'reply' | 'resolve' | 'accept' | 'reject';
  readonly threadKey: string;
}

declare global {
  interface Window {
    runInkspanClipboardProbe(
      request: BrowserClipboardProbeRequest,
    ): BrowserClipboardProbeResult;
    runInkspanHostileDocumentProbe(
      sourceHtml: string,
    ): BrowserHostileDocumentProbeResult;
    mountInkspanReviewProbe(printMode?: 'exclude' | 'include'): void;
    mountInkspanSuggestionProbe(): void;
    readInkspanReviewIntents(): readonly BrowserReviewIntent[];
  }
}

const reviewIntents: BrowserReviewIntent[] = [];
let reviewRoot: Root | null = null;

const reviewRevision = Object.freeze({
  algorithm: 'SHA-256' as const,
  digestHex: 'a'.repeat(64),
  strongEntityTag: `"sha256-${'a'.repeat(64)}"`,
});

const reviewPresentation = (
  threadKey: string,
  selected: boolean,
  state: 'unresolved' | 'resolved',
  canReply: boolean,
  canResolve: boolean,
) => ({
  contractVersion: 1,
  threadKey,
  target: {
    contractVersion: 1,
    revision: reviewRevision,
    selector: { type: 'TextPositionSelector', start: 0, end: 1 },
    projection: { id: 'inkspan-prosemirror-text', version: 1 },
  },
  state,
  commentCount: state === 'resolved' ? 3 : 1,
  selected,
  canReply,
  canResolve,
});

window.mountInkspanReviewProbe = (printMode = 'exclude'): void => {
  const container = document.querySelector<HTMLElement>('#harness');
  if (!container) throw new Error('Review harness container is missing.');
  reviewIntents.length = 0;
  reviewRoot?.unmount();
  reviewRoot = createRoot(container);
  reviewRoot.render(
    createElement(CwlReviewThreadList, {
      presentations: [
        reviewPresentation('alpha', false, 'unresolved', true, true),
        reviewPresentation('beta', true, 'unresolved', false, true),
        reviewPresentation('gamma', false, 'resolved', true, false),
      ],
      labels: {
        region: 'Document review',
        thread: (thread) => `Thread ${thread.threadKey}`,
        status: (thread) =>
          thread.state === 'resolved' ? 'Resolved' : 'Unresolved',
        comments: (thread) => `${thread.commentCount} comments`,
        reply: 'Reply',
        resolve: 'Resolve',
      },
      printMode,
      onSelectThread: (thread) =>
        reviewIntents.push({ action: 'select', threadKey: thread.threadKey }),
      onReplyThread: (thread) =>
        reviewIntents.push({ action: 'reply', threadKey: thread.threadKey }),
      onResolveThread: (thread) =>
        reviewIntents.push({ action: 'resolve', threadKey: thread.threadKey }),
    }),
  );
};

window.mountInkspanSuggestionProbe = (): void => {
  const container = document.querySelector<HTMLElement>('#harness');
  if (!container) throw new Error('Review harness container is missing.');
  reviewIntents.length = 0;
  reviewRoot?.unmount();
  reviewRoot = createRoot(container);
  reviewRoot.render(
    createElement(CwlReviewSuggestionDecision, {
      suggestion: {
        contractVersion: 1,
        kind: 'delete',
        target: reviewPresentation('suggestion', false, 'unresolved', false, false)
          .target,
      },
      label: 'Delete suggested wording',
      acceptLabel: 'Accept',
      rejectLabel: 'Reject',
      onAccept: () =>
        reviewIntents.push({ action: 'accept', threadKey: 'suggestion' }),
      onReject: () =>
        reviewIntents.push({ action: 'reject', threadKey: 'suggestion' }),
    }),
  );
};

window.readInkspanReviewIntents = () => structuredClone(reviewIntents);

window.runInkspanClipboardProbe = (
  request: BrowserClipboardProbeRequest,
): BrowserClipboardProbeResult => {
  let errorCode: ClipboardSanitizationErrorCode | null = null;
  const editor = new Editor({
    element: document.createElement('div'),
    extensions: buildExtensions({
      clipboard: request.clipboardConfig,
      onClipboardError: (error) => {
        errorCode = error.code;
      },
    }),
    content: '',
  });

  try {
    let sanitizedHtml = request.sourceHtml;
    editor.view.someProp('transformPastedHTML', (transform) => {
      sanitizedHtml = transform(sanitizedHtml, editor.view);
    });

    if (errorCode !== null) {
      return Object.freeze({ sanitizedHtml, documentJson: null, errorCode });
    }

    editor.commands.setContent(sanitizedHtml, false);
    return Object.freeze({
      sanitizedHtml,
      documentJson: editor.getJSON(),
      errorCode: null,
    });
  } finally {
    editor.destroy();
  }
};

window.runInkspanHostileDocumentProbe = (
  sourceHtml: string,
): BrowserHostileDocumentProbeResult => {
  const revoked = Proxy.revocable(document, {});
  revoked.revoke();
  try {
    sanitizeRichClipboardHtml(sourceHtml, undefined, revoked.proxy as Document);
    return Object.freeze({ errorCode: null, message: '' });
  } catch (error) {
    if (error instanceof ClipboardSanitizationError) {
      return Object.freeze({ errorCode: error.code, message: error.message });
    }
    return Object.freeze({ errorCode: 'invalid_html', message: 'unclassified' });
  }
};

export {};
