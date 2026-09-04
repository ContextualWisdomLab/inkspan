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
import {
  useWritingDiagnosticsController,
  type UseWritingDiagnosticsControllerOptions,
} from './useWritingDiagnosticsController.js';

const DIGEST_A = '11'.repeat(32);
const DIGEST_B = '22'.repeat(32);
const openEditors: Editor[] = [];

function createEditor(): Editor {
  const editor = new Editor({
    extensions: buildExtensions(),
    content: '<p>Alpha beta gamma</p>',
  });
  openEditors.push(editor);
  return editor;
}

function revision(digestHex = DIGEST_A) {
  return Object.freeze({
    algorithm: 'SHA-256' as const,
    digestHex,
    strongEntityTag: `"sha256-${digestHex}"`,
  });
}

function diagnostic(
  diagnosticId = 'diag-1',
  overrides: Partial<CwlWritingDiagnostic> = {},
): CwlWritingDiagnostic {
  return {
    diagnosticId,
    documentRevision: revision(),
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
    ...overrides,
  };
}

function digestBytes(digestHex = DIGEST_A): ArrayBuffer {
  return Uint8Array.from(
    digestHex.match(/../gu)!.map((part) => Number.parseInt(part, 16)),
  ).buffer;
}

function staticDigestProvider(
  digestHex = DIGEST_A,
): DocumentEnvelopeDigestProvider {
  return { digest: vi.fn(async () => digestBytes(digestHex)) };
}

function renderController(options: UseWritingDiagnosticsControllerOptions) {
  return renderHook(
    (next: UseWritingDiagnosticsControllerOptions) =>
      useWritingDiagnosticsController(next),
    { initialProps: options },
  );
}

function overrideCommands(
  editor: Editor,
  overrides: Record<string, unknown>,
): void {
  const commands = editor.commands;
  Object.defineProperty(editor, 'commands', {
    configurable: true,
    get: () => ({ ...commands, ...overrides }) as typeof commands,
  });
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
  vi.restoreAllMocks();
});

describe('writing diagnostics controller defensive coverage', () => {
  it('contains throwing error observers without changing the invalid result', async () => {
    const editor = createEditor();
    const onError = vi.fn(() => {
      throw new Error('host observer failure');
    });
    const { result } = renderController({
      editor,
      diagnostics: [
        diagnostic('mismatch', { documentRevision: revision(DIGEST_B) }),
      ],
      digestProvider: staticDigestProvider(),
      onError,
    });

    await waitFor(() => expect(result.current.status).toBe('invalid'));
    expect(onError).toHaveBeenCalledTimes(1);
    expect(installedIds(editor)).toEqual([]);
  });

  it('reprocesses a same-identity diagnostic array when its length changes', async () => {
    const editor = createEditor();
    const provider = staticDigestProvider();
    const diagnostics = [diagnostic('first')];
    const { result, rerender } = renderController({
      editor,
      diagnostics,
      digestProvider: provider,
    });
    await waitFor(() => expect(result.current.diagnostics).toHaveLength(1));

    diagnostics.push(diagnostic('second'));
    rerender({ editor, diagnostics, digestProvider: provider });

    await waitFor(() => expect(result.current.diagnostics).toHaveLength(2));
    expect(installedIds(editor)).toEqual(['first', 'second']);
    expect(provider.digest).toHaveBeenCalledTimes(2);
  });

  it('contains clear-decoration command failures during input processing', async () => {
    const editor = createEditor();
    overrideCommands(editor, {
      clearWritingDiagnostics: () => {
        throw new Error('view already unavailable');
      },
    });
    const { result } = renderController({
      editor,
      diagnostics: [],
      digestProvider: staticDigestProvider(),
    });

    await waitFor(() => expect(result.current.status).toBe('active'));
    expect(result.current.diagnostics).toEqual([]);
  });

  it('treats a null editor as stale without attempting revision work', async () => {
    const provider = staticDigestProvider();
    const { result } = renderController({
      editor: null,
      diagnostics: [diagnostic()],
      digestProvider: provider,
    });

    await waitFor(() => expect(result.current.status).toBe('stale'));
    expect(provider.digest).not.toHaveBeenCalled();
  });

  it('installs an explicit empty diagnostic generation without hashing', async () => {
    const editor = createEditor();
    const provider = staticDigestProvider();
    const { result } = renderController({
      editor,
      diagnostics: [],
      digestProvider: provider,
    });

    await waitFor(() => expect(result.current.status).toBe('active'));
    expect(result.current.diagnostics).toEqual([]);
    expect(provider.digest).not.toHaveBeenCalled();
  });

  it('fails closed when installing an empty diagnostic generation throws', async () => {
    const editor = createEditor();
    overrideCommands(editor, {
      installWritingDiagnostics: () => {
        throw new Error('command failure');
      },
    });
    const onError = vi.fn();
    const { result } = renderController({
      editor,
      diagnostics: [],
      digestProvider: staticDigestProvider(),
      onError,
    });

    await waitFor(() => expect(result.current.status).toBe('invalid'));
    expect(onError).toHaveBeenCalledWith(
      expect.objectContaining({ code: 'lifecycle' }),
    );
  });

  it('redacts document-envelope construction failures as revision errors', async () => {
    const editor = createEditor();
    vi.spyOn(editor.state.doc, 'toJSON').mockImplementationOnce(() => {
      throw new Error('private document failure');
    });
    const onError = vi.fn();
    const { result } = renderController({
      editor,
      diagnostics: [diagnostic()],
      digestProvider: staticDigestProvider(),
      onError,
    });

    await waitFor(() => expect(result.current.status).toBe('invalid'));
    expect(onError).toHaveBeenCalledWith(
      expect.objectContaining({ code: 'revision' }),
    );
  });

  it('silently discards a rejected digest from a superseded generation', async () => {
    let rejectFirst: ((reason?: unknown) => void) | undefined;
    let calls = 0;
    const provider: DocumentEnvelopeDigestProvider = {
      digest: vi.fn(() => {
        calls += 1;
        if (calls === 1) {
          return new Promise<ArrayBuffer>((_resolve, reject) => {
            rejectFirst = reject;
          });
        }
        return Promise.resolve(digestBytes());
      }),
    };
    const editor = createEditor();
    const { result, rerender } = renderController({
      editor,
      diagnostics: [diagnostic('first')],
      digestProvider: provider,
    });
    await waitFor(() => expect(calls).toBe(1));

    rerender({
      editor,
      diagnostics: [diagnostic('second')],
      digestProvider: provider,
    });
    await waitFor(() => expect(result.current.status).toBe('active'));
    expect(installedIds(editor)).toEqual(['second']);

    await act(async () => {
      rejectFirst?.(new Error('obsolete provider failure'));
      await Promise.resolve();
    });
    expect(result.current.status).toBe('active');
    expect(installedIds(editor)).toEqual(['second']);
  });

  it('marks the captured generation stale when view state changes without a transaction event', async () => {
    let resolveDigest: ((value: ArrayBuffer) => void) | undefined;
    const provider: DocumentEnvelopeDigestProvider = {
      digest: vi.fn(
        () =>
          new Promise<ArrayBuffer>((resolve) => {
            resolveDigest = resolve;
          }),
      ),
    };
    const editor = createEditor();
    const { result } = renderController({
      editor,
      diagnostics: [diagnostic()],
      digestProvider: provider,
    });
    await waitFor(() => expect(provider.digest).toHaveBeenCalledTimes(1));

    act(() => {
      const state = editor.state;
      editor.view.updateState(state.apply(state.tr.insertText('X', 1)));
    });
    await act(async () => {
      resolveDigest?.(digestBytes());
      await Promise.resolve();
    });

    await waitFor(() => expect(result.current.status).toBe('stale'));
    expect(installedIds(editor)).toEqual([]);
  });

  it('rejects selectors that cannot resolve against the verified snapshot', async () => {
    const editor = createEditor();
    const onError = vi.fn();
    const { result } = renderController({
      editor,
      diagnostics: [
        diagnostic('out-of-range', {
          selector: {
            type: 'TextPositionSelector',
            start: 10_000,
            end: 10_001,
          },
        }),
      ],
      digestProvider: staticDigestProvider(),
      onError,
    });

    await waitFor(() => expect(result.current.status).toBe('invalid'));
    expect(onError).toHaveBeenCalledWith(
      expect.objectContaining({ code: 'selector' }),
    );
    expect(installedIds(editor)).toEqual([]);
  });

  it('fails closed when installing a verified non-empty generation throws', async () => {
    const editor = createEditor();
    overrideCommands(editor, {
      installWritingDiagnostics: () => {
        throw new Error('command failure');
      },
    });
    const onError = vi.fn();
    const { result } = renderController({
      editor,
      diagnostics: [diagnostic()],
      digestProvider: staticDigestProvider(),
      onError,
    });

    await waitFor(() => expect(result.current.status).toBe('invalid'));
    expect(onError).toHaveBeenCalledWith(
      expect.objectContaining({ code: 'lifecycle' }),
    );
  });

  it('contains focus command exceptions and refuses inactive or missing actions', async () => {
    const editor = createEditor();
    const { result } = renderController({
      editor,
      diagnostics: [diagnostic()],
      digestProvider: staticDigestProvider(),
    });

    expect(result.current.ignoreDiagnostic('diag-1')).toBeNull();
    await waitFor(() => expect(result.current.status).toBe('active'));
    expect(result.current.ignoreDiagnostic('missing')).toBeNull();

    overrideCommands(editor, {
      focusWritingDiagnostic: () => {
        throw new Error('focus failure');
      },
    });
    expect(result.current.focusDiagnostic('diag-1')).toBe(false);
  });

  it('does not dismiss a diagnostic when the replacement decoration install fails', async () => {
    const editor = createEditor();
    const { result } = renderController({
      editor,
      diagnostics: [diagnostic()],
      digestProvider: staticDigestProvider(),
    });
    await waitFor(() => expect(result.current.status).toBe('active'));
    const generation = result.current.generation;

    overrideCommands(editor, {
      installWritingDiagnostics: () => {
        throw new Error('dismiss install failure');
      },
    });
    let event: ReturnType<typeof result.current.dismissDiagnostic> = null;
    act(() => {
      event = result.current.dismissDiagnostic('diag-1');
    });

    expect(event).toBeNull();
    expect(result.current.generation).toBe(generation);
    expect(result.current.diagnostics).toHaveLength(1);
    expect(installedIds(editor)).toEqual(['diag-1']);
  });
});
