import { act, renderHook, waitFor } from '@testing-library/react';
import { Editor } from '@tiptap/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { DocumentEnvelopeDigestProvider } from '../documentEnvelopeRevision.js';
import { writingDiagnosticsPluginKey } from '../extensions/WritingDiagnostics.js';
import { buildExtensions } from '../extensions/kit.js';
import {
  TEXT_POSITION_PROJECTION_ID,
  TEXT_POSITION_PROJECTION_VERSION,
} from '../textPositionSelectorEvidence.js';
import type { CwlWritingDiagnostic } from '../writingDiagnostics.js';
import { useWritingDiagnosticsController } from './useWritingDiagnosticsController.js';

const DIGEST = '11'.repeat(32);
const openEditors: Editor[] = [];

function createEditor(): Editor {
  const editor = new Editor({
    extensions: buildExtensions(),
    content: '<p>Alpha beta gamma</p>',
  });
  openEditors.push(editor);
  return editor;
}

function diagnostic(id = 'diag-1'): CwlWritingDiagnostic {
  return {
    diagnosticId: id,
    documentRevision: {
      algorithm: 'SHA-256',
      digestHex: DIGEST,
      strongEntityTag: `"sha256-${DIGEST}"`,
    },
    textProjection: {
      id: TEXT_POSITION_PROJECTION_ID,
      version: TEXT_POSITION_PROJECTION_VERSION,
    },
    selector: { type: 'TextPositionSelector', start: 0, end: 5 },
    categoryCode: 'host.category',
    priority: 'important',
    title: 'Host title',
    explanation: 'Host explanation',
    suggestedReplacement: 'Omega',
    provenance: {
      workflowId: 'workflow',
      workflowVersion: '1',
      judgePolicyVersion: '1',
    },
  };
}

function digestProvider(): DocumentEnvelopeDigestProvider {
  const bytes = Uint8Array.from(
    DIGEST.match(/../gu)!.map((part) => Number.parseInt(part, 16)),
  );
  return { digest: vi.fn(async () => bytes.slice().buffer) };
}

function installedIds(editor: Editor): string[] {
  return (
    writingDiagnosticsPluginKey.getState(editor.state)?.diagnostics ?? []
  ).map((item) => item.diagnosticId);
}

afterEach(() => {
  for (const editor of openEditors.splice(0)) {
    if (!editor.isDestroyed) editor.destroy();
  }
});

describe('writing diagnostic feedback actions', () => {
  it('reports Ignore without changing authored content or dismissing presentation', async () => {
    const editor = createEditor();
    const before = editor.getJSON();
    const onAction = vi.fn();
    const { result } = renderHook(() =>
      useWritingDiagnosticsController({
        editor,
        diagnostics: [diagnostic()],
        digestProvider: digestProvider(),
        onAction,
      }),
    );
    await waitFor(() => expect(result.current.status).toBe('active'));
    const generation = result.current.generation;

    let event = null as ReturnType<typeof result.current.ignoreDiagnostic>;
    act(() => {
      event = result.current.ignoreDiagnostic('diag-1');
    });

    expect(event).toMatchObject({
      action: 'ignored',
      reasonCode: 'explicit',
      diagnosticId: 'diag-1',
      generation,
    });
    expect(editor.getJSON()).toEqual(before);
    expect(installedIds(editor)).toEqual(['diag-1']);
    expect(result.current.diagnostics).toHaveLength(1);
    expect(result.current.generation).toBe(generation);
    expect(onAction).toHaveBeenCalledTimes(1);
  });

  it('reports Explain without changing authored content or dismissing presentation', async () => {
    const editor = createEditor();
    const before = editor.getJSON();
    const onAction = vi.fn();
    const { result } = renderHook(() =>
      useWritingDiagnosticsController({
        editor,
        diagnostics: [diagnostic()],
        digestProvider: digestProvider(),
        onAction,
      }),
    );
    await waitFor(() => expect(result.current.status).toBe('active'));
    const generation = result.current.generation;

    let event = null as ReturnType<
      typeof result.current.requestDiagnosticExplanation
    >;
    act(() => {
      event = result.current.requestDiagnosticExplanation('diag-1');
    });

    expect(event).toMatchObject({
      action: 'requested_explanation',
      reasonCode: 'explicit',
      diagnosticId: 'diag-1',
      generation,
    });
    expect(editor.getJSON()).toEqual(before);
    expect(installedIds(editor)).toEqual(['diag-1']);
    expect(result.current.diagnostics).toHaveLength(1);
    expect(result.current.generation).toBe(generation);
    expect(onAction).toHaveBeenCalledTimes(1);
  });

  it('dismisses only local presentation and never mutates authored content', async () => {
    const editor = createEditor();
    const before = editor.getJSON();
    const { result } = renderHook(() =>
      useWritingDiagnosticsController({
        editor,
        diagnostics: [diagnostic()],
        digestProvider: digestProvider(),
      }),
    );
    await waitFor(() => expect(result.current.status).toBe('active'));
    const generation = result.current.generation;

    let event = null as ReturnType<typeof result.current.dismissDiagnostic>;
    act(() => {
      event = result.current.dismissDiagnostic('diag-1');
    });

    expect(event).toMatchObject({
      action: 'dismissed',
      reasonCode: 'explicit',
      diagnosticId: 'diag-1',
      generation: generation + 1,
    });
    expect(editor.getJSON()).toEqual(before);
    expect(installedIds(editor)).toEqual([]);
    expect(result.current.diagnostics).toEqual([]);
  });

  it('focuses only an installed current diagnostic', async () => {
    const editor = createEditor();
    const { result } = renderHook(() =>
      useWritingDiagnosticsController({
        editor,
        diagnostics: [diagnostic()],
        digestProvider: digestProvider(),
      }),
    );
    await waitFor(() => expect(result.current.status).toBe('active'));

    expect(result.current.focusDiagnostic('missing')).toBe(false);
    expect(result.current.focusDiagnostic('diag-1')).toBe(true);
  });
});
