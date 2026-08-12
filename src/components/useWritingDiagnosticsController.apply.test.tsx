import { act, renderHook, waitFor } from '@testing-library/react';
import { Editor } from '@tiptap/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { DocumentEnvelopeDigestProvider } from '../documentEnvelopeRevision.js';
import { buildExtensions } from '../extensions/kit.js';
import {
  TEXT_POSITION_PROJECTION_ID,
  TEXT_POSITION_PROJECTION_VERSION,
} from '../textPositionSelectorEvidence.js';
import type { CwlWritingDiagnostic } from '../writingDiagnostics.js';
import { useWritingDiagnosticsController } from './useWritingDiagnosticsController.js';

const DIGEST_HEX = '11'.repeat(32);
const OTHER_DIGEST_HEX = '22'.repeat(32);
const openEditors: Editor[] = [];

function digestBytes(hex = DIGEST_HEX): ArrayBuffer {
  return Uint8Array.from(
    hex.match(/../gu)!.map((part) => Number.parseInt(part, 16)),
  ).buffer;
}

function createEditor(): Editor {
  const editor = new Editor({
    extensions: buildExtensions(),
    content: '<p>Alpha beta gamma</p>',
  });
  openEditors.push(editor);
  return editor;
}

function diagnostic(): CwlWritingDiagnostic {
  return {
    diagnosticId: 'diag-apply',
    documentRevision: {
      algorithm: 'SHA-256',
      digestHex: DIGEST_HEX,
      strongEntityTag: `"sha256-${DIGEST_HEX}"`,
    },
    textProjection: {
      id: TEXT_POSITION_PROJECTION_ID,
      version: TEXT_POSITION_PROJECTION_VERSION,
    },
    selector: { type: 'TextPositionSelector', start: 0, end: 5 },
    categoryCode: 'clarity',
    priority: 'important',
    title: 'Clarify the request',
    explanation: 'Make the action explicit.',
    suggestedReplacement: 'Omega',
    provenance: {
      workflowId: 'email-writing-review',
      workflowVersion: '1',
      judgePolicyVersion: 'evaluation-only-1',
    },
  };
}

function stableProvider(): DocumentEnvelopeDigestProvider {
  return { digest: vi.fn(async () => digestBytes()) };
}

afterEach(() => {
  for (const editor of openEditors.splice(0)) {
    if (!editor.isDestroyed) editor.destroy();
  }
  vi.restoreAllMocks();
});

describe('revision-safe writing diagnostic application failures', () => {
  it('reports a redacted revision error when hashing fails before mutation', async () => {
    const editor = createEditor();
    const before = editor.getJSON();
    const onError = vi.fn();
    const provider: DocumentEnvelopeDigestProvider = {
      digest: vi
        .fn()
        .mockResolvedValueOnce(digestBytes())
        .mockRejectedValue(new Error('private digest failure')),
    };
    const { result } = renderHook(() =>
      useWritingDiagnosticsController({
        editor,
        diagnostics: [diagnostic()],
        digestProvider: provider,
        onError,
      }),
    );
    await waitFor(() => expect(result.current.status).toBe('active'));

    let event = null;
    await act(async () => {
      event = await result.current.applyDiagnostic('diag-apply');
    });

    expect(event).toBeNull();
    expect(editor.getJSON()).toEqual(before);
    expect(onError).toHaveBeenCalledWith(
      expect.objectContaining({ code: 'revision' }),
    );
  });

  it('abstains with revision_mismatch when the rechecked document digest differs', async () => {
    const editor = createEditor();
    const before = editor.getJSON();
    const onAction = vi.fn();
    const provider: DocumentEnvelopeDigestProvider = {
      digest: vi
        .fn()
        .mockResolvedValueOnce(digestBytes())
        .mockResolvedValueOnce(digestBytes(OTHER_DIGEST_HEX))
        .mockResolvedValueOnce(digestBytes(OTHER_DIGEST_HEX)),
    };
    const { result } = renderHook(() =>
      useWritingDiagnosticsController({
        editor,
        diagnostics: [diagnostic()],
        digestProvider: provider,
        onAction,
      }),
    );
    await waitFor(() => expect(result.current.status).toBe('active'));

    let event = null;
    await act(async () => {
      event = await result.current.applyDiagnostic('diag-apply');
    });

    expect(event).toMatchObject({
      action: 'conflict',
      reasonCode: 'revision_mismatch',
      diagnosticId: 'diag-apply',
    });
    expect(editor.getJSON()).toEqual(before);
    expect(onAction).toHaveBeenCalledWith(event);
  });

  it('abstains with document_changed when authored content changes during hashing', async () => {
    const editor = createEditor();
    const pendingResolvers: Array<(value: ArrayBuffer) => void> = [];
    let defer = false;
    const provider: DocumentEnvelopeDigestProvider = {
      digest: vi.fn(() =>
        defer
          ? new Promise<ArrayBuffer>((resolve) => pendingResolvers.push(resolve))
          : Promise.resolve(digestBytes()),
      ),
    };
    const onAction = vi.fn();
    const { result } = renderHook(() =>
      useWritingDiagnosticsController({
        editor,
        diagnostics: [diagnostic()],
        digestProvider: provider,
        onAction,
      }),
    );
    await waitFor(() => expect(result.current.status).toBe('active'));

    defer = true;
    let application!: ReturnType<typeof result.current.applyDiagnostic>;
    act(() => {
      application = result.current.applyDiagnostic('diag-apply');
    });
    expect(pendingResolvers).toHaveLength(2);
    act(() => {
      editor.commands.insertContent('!');
    });
    act(() => {
      pendingResolvers[0]!(digestBytes());
      pendingResolvers[1]!(digestBytes());
    });
    const event = await application;

    expect(event).toMatchObject({
      action: 'conflict',
      reasonCode: 'document_changed',
      diagnosticId: 'diag-apply',
    });
    expect(onAction).toHaveBeenCalledWith(event);
    expect(editor.getText()).toContain('!');
    expect(editor.getText()).toContain('Alpha');
  });

  it('reports a redacted lifecycle error when dispatch cannot commit', async () => {
    const editor = createEditor();
    const before = editor.getJSON();
    const onError = vi.fn();
    const { result } = renderHook(() =>
      useWritingDiagnosticsController({
        editor,
        diagnostics: [diagnostic()],
        digestProvider: stableProvider(),
        onError,
      }),
    );
    await waitFor(() => expect(result.current.status).toBe('active'));
    vi.spyOn(editor.view, 'dispatch').mockImplementation(() => {
      throw new Error('private dispatch failure');
    });

    let event = null;
    await act(async () => {
      event = await result.current.applyDiagnostic('diag-apply');
    });

    expect(event).toBeNull();
    expect(editor.getJSON()).toEqual(before);
    expect(onError).toHaveBeenCalledWith(
      expect.objectContaining({ code: 'lifecycle' }),
    );
  });
});
