import { Editor } from '@tiptap/core';
import { createElement, createRef } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import {
  ClipboardSanitizationError,
  CwlEditor,
  buildExtensions,
  sanitizeRichClipboardHtml,
  type ClipboardConfig,
  type ClipboardSanitizationErrorCode,
  type CwlEditorDocumentRevision,
  type CwlEditorHandle,
  type CwlWritingDiagnostic,
  type CwlWritingDiagnosticActionEvent,
} from 'inkspan-browser-under-test';
import '../../src/styles.css';

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

interface BrowserWritingDiagnosticsProbeRequest {
  readonly sourceHtml: string;
  readonly withDiagnostics?: boolean;
  readonly diagnosticCount?: number;
}

interface BrowserWritingDiagnosticsProbeState {
  readonly actions: readonly CwlWritingDiagnosticActionEvent[];
}

let diagnosticsRoot: Root | null = null;
let diagnosticsEditorRef = createRef<CwlEditorHandle>();
let diagnosticsActions: CwlWritingDiagnosticActionEvent[] = [];
let diagnosticsSourceHtml = '';
let diagnosticsPayload: readonly CwlWritingDiagnostic[] | undefined;

function nextFrame(): Promise<void> {
  return new Promise((resolve) => requestAnimationFrame(() => resolve()));
}

async function waitForEditorHandle(): Promise<CwlEditorHandle> {
  for (let attempt = 0; attempt < 120; attempt += 1) {
    const handle = diagnosticsEditorRef.current;
    if (handle?.getEditor() !== null && handle?.getEditor() !== undefined) {
      return handle;
    }
    await nextFrame();
  }
  throw new Error('writing_diagnostics_editor_unavailable');
}

function requireDiagnosticsHandle(): CwlEditorHandle {
  const handle = diagnosticsEditorRef.current;
  if (handle === null) throw new Error('writing_diagnostics_editor_unavailable');
  return handle;
}

function probeContainer(): HTMLElement {
  const harness = document.getElementById('harness');
  if (harness === null) throw new Error('browser_harness_missing');
  harness.replaceChildren();
  const container = document.createElement('section');
  container.id = 'writing-diagnostics-probe';
  container.setAttribute('aria-label', 'Writing diagnostics browser probe');
  harness.append(container);
  return container;
}

function diagnosticFor(
  revision: CwlEditorDocumentRevision,
  index: number,
): CwlWritingDiagnostic {
  const alpha = index === 0;
  return {
    diagnosticId: alpha
      ? 'browser-diagnostic-alpha'
      : `browser-diagnostic-${index + 1}`,
    documentRevision: revision,
    textProjection: {
      id: 'inkspan-prosemirror-text',
      version: 1,
    },
    selector: alpha
      ? { type: 'TextPositionSelector', start: 0, end: 5 }
      : { type: 'TextPositionSelector', start: 6, end: 10 },
    categoryCode: alpha ? 'clarity' : 'structure',
    priority: alpha ? 'important' : 'advisory',
    title: alpha ? 'Clarify Alpha' : `Review diagnostic ${index + 1}`,
    explanation: alpha
      ? 'State the intended action explicitly.'
      : 'Review the neighboring phrase.',
    ...(alpha ? { suggestedReplacement: 'Omega' } : {}),
    provenance: {
      workflowId: 'email-writing-review',
      workflowVersion: '1',
      judgePolicyVersion: 'evaluation-only-1',
    },
  };
}

function renderDiagnosticsProbe(): void {
  if (diagnosticsRoot === null) throw new Error('writing_diagnostics_root_missing');
  diagnosticsRoot.render(
    createElement(CwlEditor, {
      ref: diagnosticsEditorRef,
      mode: 'html',
      defaultValue: diagnosticsSourceHtml,
      writingDiagnostics: diagnosticsPayload,
      writingDiagnosticsLabel: 'Writing guidance',
      onWritingDiagnosticAction: (event) => {
        diagnosticsActions.push(event);
      },
    }),
  );
}

async function mountWritingDiagnosticsProbe(
  request: BrowserWritingDiagnosticsProbeRequest,
): Promise<void> {
  diagnosticsRoot?.unmount();
  diagnosticsRoot = null;
  diagnosticsEditorRef = createRef<CwlEditorHandle>();
  diagnosticsActions = [];
  diagnosticsSourceHtml = request.sourceHtml;
  diagnosticsPayload = undefined;
  diagnosticsRoot = createRoot(probeContainer());
  renderDiagnosticsProbe();

  const handle = await waitForEditorHandle();
  if (request.withDiagnostics !== true) return;
  const revision = await handle.getDocumentEnvelopeRevision();
  if (revision === null) throw new Error('writing_diagnostics_revision_unavailable');
  const diagnosticCount = Math.max(1, Math.min(request.diagnosticCount ?? 1, 2));
  diagnosticsPayload = Object.freeze(
    Array.from({ length: diagnosticCount }, (_, index) =>
      Object.freeze(diagnosticFor(revision, index)),
    ),
  );
  renderDiagnosticsProbe();

  for (let attempt = 0; attempt < 120; attempt += 1) {
    const region = document.querySelector('[aria-label="Writing guidance"]');
    if (region?.textContent?.includes(`${diagnosticCount} writing diagnostics`)) return;
    await nextFrame();
  }
  throw new Error('writing_diagnostics_verification_timeout');
}

declare global {
  interface Window {
    runInkspanClipboardProbe(
      request: BrowserClipboardProbeRequest,
    ): BrowserClipboardProbeResult;
    runInkspanHostileDocumentProbe(
      sourceHtml: string,
    ): BrowserHostileDocumentProbeResult;
    mountInkspanWritingDiagnosticsProbe(
      request: BrowserWritingDiagnosticsProbeRequest,
    ): Promise<void>;
    mutateInkspanWritingDiagnosticsProbe(sourceHtml: string): void;
    applyInkspanWritingDiagnosticProbe(
      diagnosticId: string,
    ): Promise<CwlWritingDiagnosticActionEvent | null>;
    undoInkspanWritingDiagnosticsProbe(): boolean;
    getInkspanWritingDiagnosticsProbeState(): BrowserWritingDiagnosticsProbeState;
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

window.mountInkspanWritingDiagnosticsProbe = mountWritingDiagnosticsProbe;

window.mutateInkspanWritingDiagnosticsProbe = (sourceHtml: string): void => {
  requireDiagnosticsHandle().setValue(sourceHtml);
};

window.applyInkspanWritingDiagnosticProbe = (
  diagnosticId: string,
): Promise<CwlWritingDiagnosticActionEvent | null> =>
  requireDiagnosticsHandle().applyWritingDiagnostic(diagnosticId);

window.undoInkspanWritingDiagnosticsProbe = (): boolean => {
  const editor = requireDiagnosticsHandle().getEditor();
  if (editor === null) throw new Error('writing_diagnostics_editor_unavailable');
  return editor.commands.undo();
};

window.getInkspanWritingDiagnosticsProbeState =
  (): BrowserWritingDiagnosticsProbeState =>
    Object.freeze({ actions: Object.freeze([...diagnosticsActions]) });

export {};
