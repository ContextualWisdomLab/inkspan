import { Editor } from '@tiptap/core';
import { createElement, useRef } from 'react';
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
  type CwlEditorHandle,
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

interface BrowserPerformanceProbeResult {
  readonly mountMillis: number;
  readonly snapshotMillis: number;
  readonly envelopeMillis: number;
  readonly revisionMillis: number;
  readonly sourceCodeUnits: number;
  readonly snapshotCodeUnits: number;
  readonly revisionAvailable: boolean;
}

declare global {
  interface Window {
    runInkspanClipboardProbe(
      request: BrowserClipboardProbeRequest,
    ): BrowserClipboardProbeResult;
    runInkspanHostileDocumentProbe(
      sourceHtml: string,
    ): BrowserHostileDocumentProbeResult;
    runInkspanDocumentPerformanceProbe(
      sourceValue: string,
    ): Promise<BrowserPerformanceProbeResult>;
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

window.runInkspanDocumentPerformanceProbe = async (
  sourceValue: string,
): Promise<BrowserPerformanceProbeResult> => {
  const harness = document.querySelector<HTMLElement>('#harness');
  if (!harness) throw new Error('Performance harness root is missing.');
  harness.innerHTML = '';
  const mount = document.createElement('div');
  mount.id = 'performance-probe';
  harness.append(mount);

  return new Promise((resolve, reject) => {
    const root = createRoot(mount);
    const finish = (callback: () => void): void => {
      callback();
      root.unmount();
      mount.remove();
    };
    const started = performance.now();
    const Probe = () => {
      const ref = useRef<CwlEditorHandle>(null);
      return createElement(CwlEditor, {
        ref,
        defaultValue: sourceValue,
        hideToolbar: true,
        onReady: async () => {
          const editorHandle = ref.current;
          if (!editorHandle) {
            finish(() => reject(new Error('Performance editor handle is unavailable.')));
            return;
          }
          const mountMillis = performance.now() - started;
          const snapshotStarted = performance.now();
          const snapshot = editorHandle.getSnapshot();
          const snapshotMillis = performance.now() - snapshotStarted;
          const envelopeStarted = performance.now();
          editorHandle.getDocumentEnvelopeJson();
          const envelopeMillis = performance.now() - envelopeStarted;
          const revisionStarted = performance.now();
          const revision = await editorHandle.getDocumentEnvelopeRevision();
          const revisionMillis = performance.now() - revisionStarted;
          finish(() =>
            resolve(
              Object.freeze({
                mountMillis,
                snapshotMillis,
                envelopeMillis,
                revisionMillis,
                sourceCodeUnits: sourceValue.length,
                snapshotCodeUnits: snapshot.plainText.length,
                revisionAvailable: revision !== null,
              }),
            ),
          );
        },
      });
    };

    root.render(createElement(Probe));
  });
};

export {};
