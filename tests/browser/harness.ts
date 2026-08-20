import { Editor } from '@tiptap/core';
import type { Editor as TiptapEditor } from '@tiptap/core';
import { createElement, useRef, useState } from 'react';
import { createRoot } from 'react-dom/client';
import {
  ClipboardSanitizationError,
  buildExtensions,
  sanitizeRichClipboardHtml,
  type ClipboardConfig,
  type ClipboardSanitizationErrorCode,
} from 'inkspan-browser-under-test';
import {
  CwlEditor,
  createDocumentEnvelope,
  createDocumentEnvelopeRevision,
  type CwlEditorHandle,
  type CwlEditorReviewProps,
} from 'inkspan-browser-under-test';

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

declare global {
  interface Window {
    runInkspanClipboardProbe(
      request: BrowserClipboardProbeRequest,
    ): BrowserClipboardProbeResult;
    runInkspanHostileDocumentProbe(
      sourceHtml: string,
    ): BrowserHostileDocumentProbeResult;
    mountInkspanReviewProbe(): Promise<void>;
  }
}

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

window.mountInkspanReviewProbe = async (): Promise<void> => {
  const harness = document.querySelector<HTMLElement>('#harness');
  if (!harness) throw new Error('Review harness root is missing.');
  harness.innerHTML = '';
  const mount = document.createElement('div');
  mount.id = 'review-probe';
  harness.append(mount);

  const Probe = () => {
    const ref = useRef<CwlEditorHandle>(null);
    const [review, setReview] = useState<CwlEditorReviewProps>();
    const onReady = async (editor: TiptapEditor) => {
      const revision = await createDocumentEnvelopeRevision(
        createDocumentEnvelope(editor.getJSON()),
      );
      const target = {
        revision,
        selector: { type: 'TextPositionSelector' as const, start: 0, end: 0 },
        textProjection: { id: 'inkspan-prosemirror-text' as const, version: 1 as const },
      };
      setReview({
        suggestions: [
          {
            suggestionId: 'review-accepted',
            kind: 'insert',
            state: 'pending',
            expectedRevision: revision,
            target,
            text: 'X',
          },
          {
            suggestionId: 'review-stale',
            kind: 'insert',
            state: 'pending',
            expectedRevision: revision,
            target,
            text: 'Y',
          },
        ],
        onOperation: (result) => {
          mount.dataset.reviewStatus = result.status;
        },
        onError: (error) => {
          mount.dataset.reviewError = error.code;
        },
      });
    };
    const markStale = () => ref.current?.setValue('Changed');
    return createElement(
      'div',
      null,
      createElement(CwlEditor, {
        ref,
        defaultValue: 'Hi',
        onReady,
        review,
      }),
      createElement(
        'button',
        { type: 'button', 'data-review-make-stale': 'true', onClick: markStale },
        'Make review stale',
      ),
    );
  };
  createRoot(mount).render(createElement(Probe));

  await new Promise<void>((resolve, reject) => {
    const started = performance.now();
    const check = () => {
      if (mount.querySelector('[aria-label="Document review"]')) {
        resolve();
        return;
      }
      if (performance.now() - started > 10_000) {
        reject(new Error('Review panel did not mount.'));
        return;
      }
      window.setTimeout(check, 25);
    };
    check();
  });
};

export {};
