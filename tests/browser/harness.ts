import { Editor } from '@tiptap/core';
import {
  ClipboardSanitizationError,
  sanitizeRichClipboardHtml,
  type ClipboardConfig,
  type ClipboardSanitizationErrorCode,
} from '../../src/extensions/SafeClipboard.js';
import { buildExtensions } from '../../src/extensions/kit.js';

interface BrowserClipboardProbeRequest {
  readonly sourceHtml: string;
  readonly clipboardConfig?: ClipboardConfig;
}

interface BrowserClipboardProbeResult {
  readonly sanitizedHtml: string;
  readonly documentJson: unknown | null;
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

export {};
