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

function track(editor: Editor): Editor {
  openEditors.push(editor);
  return editor;
}

function createEditor(content = '<p>Alpha beta gamma</p>'): Editor {
  return track(
    new Editor({
      extensions: buildExtensions(),
      content,
    }),
  );
}

function revision(digestHex = DIGEST_A) {
  return Object.freeze({
    algorithm: 'SHA-256' as const,
    digestHex,
    strongEntityTag: `"sha256-${digestHex}"`,
  });
}

function diagnostic(
  overrides: Partial<CwlWritingDiagnostic> = {},
): CwlWritingDiagnostic {
  return {
    diagnosticId: 'diag-1',
    documentRevision: revision(),
    textProjection: {
      id: TEXT_POSITION_PROJECTION_ID,
      version: TEXT_POSITION_PROJECTION_VERSION,
    },
    selector: {
      type: 'TextPositionSelector',
      start: 0,
      end: 5,
    },
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

function staticDigestProvider(
  digestHex = DIGEST_A,
): DocumentEnvelopeDigestProvider {
  const bytes = Uint8Array.from(
    digestHex.match(/../gu)!.map((part) => Number.parseInt(part, 16)),
  );
  return {
    digest: vi.fn(async () => bytes.slice().buffer),
  };
}

function deferredDigestProvider() {
  const resolvers: Array<(value: ArrayBuffer) => void> = [];
  const provider: DocumentEnvelopeDigestProvider = {
    digest: vi.fn(
      () =>
        new Promise<ArrayBuffer>((resolve) => {
          resolvers.push(resolve);
        }),
    ),
  };
  return {
    provider,
    resolve(index: number, digestHex = DIGEST_A) {
      const bytes = Uint8Array.from(
        digestHex.match(/../gu)!.map((part) => Number.parseInt(part, 16)),
      );
      const resolve = resolvers[index];
      if (!resolve) throw new Error(`Missing digest resolver ${index}`);
      resolve(bytes.buffer);
    },
    count: () => resolvers.length,
  };
}

function pluginDiagnostics(editor: Editor) {
  return writingDiagnosticsPluginKey.getState(editor.state)?.diagnostics ?? [];
}

function renderController(
  options: UseWritingDiagnosticsControllerOptions,
) {
  return renderHook(
    (next: UseWritingDiagnosticsControllerOptions) =>
      useWritingDiagnosticsController(next),
    { initialProps: options },
  );
}

afterEach(() => {
  for (const editor of openEditors.splice(0)) {
    if (!editor.isDestroyed) editor.destroy();
  }
  vi.restoreAllMocks();
});

describe('useWritingDiagnosticsController', () => {
  it('verifies one exact snapshot before installing structural decorations', async () => {
    const editor = createEditor();
    const provider = staticDigestProvider();
    const { result } = renderController({
      editor,
      diagnostics: [diagnostic()],
      digestProvider: provider,
    });

    await waitFor(() => expect(result.current.status).toBe('active'));

    expect(result.current.generation).toBeGreaterThanOrEqual(0);
    expect(result.current.diagnostics).toHaveLength(1);
    expect(result.current.diagnostics[0]).toMatchObject({
      diagnostic: { diagnosticId: 'diag-1' },
      from: 1,
      to: 6,
    });
    expect(pluginDiagnostics(editor)).toEqual([
      expect.objectContaining({
        diagnosticId: 'diag-1',
        from: 1,
        to: 6,
        priority: 'important',
      }),
    ]);
    expect(provider.digest).toHaveBeenCalledTimes(1);
  });

  it('treats omitted diagnostics as absent and performs no semantic fallback', async () => {
    const editor = createEditor('<p>rude incorrect urgent 무례함 오류 긴급</p>');
    const provider = staticDigestProvider();
    const { result } = renderController({
      editor,
      diagnostics: undefined,
      digestProvider: provider,
    });

    await waitFor(() => expect(result.current.status).toBe('absent'));
    expect(result.current.diagnostics).toEqual([]);
    expect(pluginDiagnostics(editor)).toEqual([]);
    expect(provider.digest).not.toHaveBeenCalled();
  });

  it('revalidates a same-identity array when hostile members are mutated', async () => {
    const editor = createEditor();
    const onError = vi.fn();
    const diagnostics: unknown[] = [diagnostic()];
    const { result, rerender } = renderController({
      editor,
      diagnostics: diagnostics as readonly CwlWritingDiagnostic[],
      digestProvider: staticDigestProvider(),
      onError,
    });
    await waitFor(() => expect(result.current.status).toBe('active'));

    const hostile = {};
    Object.defineProperty(hostile, 'diagnosticId', {
      enumerable: true,
      get() {
        throw new Error('private getter failure');
      },
    });
    diagnostics[0] = hostile;
    rerender({
      editor,
      diagnostics: diagnostics as readonly CwlWritingDiagnostic[],
      digestProvider: result.current.digestProvider,
      onError,
    });

    await waitFor(() => expect(result.current.status).toBe('invalid'));
    expect(pluginDiagnostics(editor)).toEqual([]);
    expect(onError).toHaveBeenCalledWith(
      expect.objectContaining({ code: 'contract' }),
    );
    expect(String(onError.mock.calls.at(-1)?.[0])).not.toContain(
      'private getter failure',
    );
  });

  it('rejects revision mismatches atomically without installing any range', async () => {
    const editor = createEditor();
    const onError = vi.fn();
    const { result } = renderController({
      editor,
      diagnostics: [diagnostic({ documentRevision: revision(DIGEST_B) })],
      digestProvider: staticDigestProvider(DIGEST_A),
      onError,
    });

    await waitFor(() => expect(result.current.status).toBe('invalid'));
    expect(result.current.diagnostics).toEqual([]);
    expect(pluginDiagnostics(editor)).toEqual([]);
    expect(onError).toHaveBeenCalledWith(
      expect.objectContaining({ code: 'revision' }),
    );
  });

  it('rejects unsupported projections before attempting editor revision work', async () => {
    const editor = createEditor();
    const provider = staticDigestProvider();
    const onError = vi.fn();
    const bad = diagnostic({
      textProjection: {
        id: TEXT_POSITION_PROJECTION_ID,
        version: 999,
      } as unknown as CwlWritingDiagnostic['textProjection'],
    });
    const { result } = renderController({
      editor,
      diagnostics: [bad],
      digestProvider: provider,
      onError,
    });

    await waitFor(() => expect(result.current.status).toBe('invalid'));
    expect(provider.digest).not.toHaveBeenCalled();
    expect(onError).toHaveBeenCalledWith(
      expect.objectContaining({ code: 'projection' }),
    );
  });

  it('contains digest-provider failures behind the redacted revision boundary', async () => {
    const editor = createEditor();
    const onError = vi.fn();
    const provider: DocumentEnvelopeDigestProvider = {
      digest: vi.fn(async () => {
        throw new Error('private provider failure');
      }),
    };
    const { result } = renderController({
      editor,
      diagnostics: [diagnostic()],
      digestProvider: provider,
      onError,
    });

    await waitFor(() => expect(result.current.status).toBe('invalid'));
    expect(onError).toHaveBeenCalledWith(
      expect.objectContaining({ code: 'revision' }),
    );
    expect(String(onError.mock.calls.at(-1)?.[0])).not.toContain(
      'private provider failure',
    );
  });

  it('marks a generation stale when the document changes during hashing', async () => {
    const editor = createEditor();
    const deferred = deferredDigestProvider();
    const { result } = renderController({
      editor,
      diagnostics: [diagnostic()],
      digestProvider: deferred.provider,
    });

    await waitFor(() => expect(deferred.count()).toBe(1));
    act(() => {
      editor.commands.insertContent('X');
    });
    await waitFor(() => expect(result.current.status).toBe('stale'));

    await act(async () => {
      deferred.resolve(0);
      await Promise.resolve();
    });
    expect(result.current.status).toBe('stale');
    expect(pluginDiagnostics(editor)).toEqual([]);
  });

  it('prevents an older overlapping verification from installing after replacement', async () => {
    const editor = createEditor();
    const deferred = deferredDigestProvider();
    const first = [diagnostic({ diagnosticId: 'first' })];
    const second = [diagnostic({ diagnosticId: 'second' })];
    const { result, rerender } = renderController({
      editor,
      diagnostics: first,
      digestProvider: deferred.provider,
    });
    await waitFor(() => expect(deferred.count()).toBe(1));

    rerender({
      editor,
      diagnostics: second,
      digestProvider: deferred.provider,
    });
    await waitFor(() => expect(deferred.count()).toBe(2));

    await act(async () => {
      deferred.resolve(1);
      await Promise.resolve();
    });
    await waitFor(() => expect(result.current.status).toBe('active'));
    expect(pluginDiagnostics(editor)).toEqual([
      expect.objectContaining({ diagnosticId: 'second' }),
    ]);

    await act(async () => {
      deferred.resolve(0);
      await Promise.resolve();
    });
    expect(pluginDiagnostics(editor)).toEqual([
      expect.objectContaining({ diagnosticId: 'second' }),
    ]);
  });

  it('moves verification to a replacement editor and clears the old editor', async () => {
    const firstEditor = createEditor();
    const secondEditor = createEditor();
    const provider = staticDigestProvider();
    const diagnostics = [diagnostic()];
    const { result, rerender } = renderController({
      editor: firstEditor,
      diagnostics,
      digestProvider: provider,
    });
    await waitFor(() => expect(result.current.status).toBe('active'));
    expect(pluginDiagnostics(firstEditor)).toHaveLength(1);

    rerender({
      editor: secondEditor,
      diagnostics,
      digestProvider: provider,
    });
    await waitFor(() => {
      expect(result.current.status).toBe('active');
      expect(result.current.editor).toBe(secondEditor);
    });
    expect(pluginDiagnostics(firstEditor)).toEqual([]);
    expect(pluginDiagnostics(secondEditor)).toHaveLength(1);
  });

  it('never installs after editor destruction while verification is pending', async () => {
    const editor = createEditor();
    const deferred = deferredDigestProvider();
    const { result } = renderController({
      editor,
      diagnostics: [diagnostic()],
      digestProvider: deferred.provider,
    });
    await waitFor(() => expect(deferred.count()).toBe(1));

    act(() => editor.destroy());
    await act(async () => {
      deferred.resolve(0);
      await Promise.resolve();
    });

    await waitFor(() => expect(result.current.status).toBe('stale'));
  });

  it('uses the latest error callback without recreating or rehashing the editor', async () => {
    const editor = createEditor();
    const provider = staticDigestProvider();
    const firstError = vi.fn();
    const secondError = vi.fn();
    const diagnostics: unknown[] = [diagnostic()];
    const { result, rerender } = renderController({
      editor,
      diagnostics: diagnostics as readonly CwlWritingDiagnostic[],
      digestProvider: provider,
      onError: firstError,
    });
    await waitFor(() => expect(result.current.status).toBe('active'));
    expect(provider.digest).toHaveBeenCalledTimes(1);

    rerender({
      editor,
      diagnostics: diagnostics as readonly CwlWritingDiagnostic[],
      digestProvider: provider,
      onError: secondError,
    });
    await Promise.resolve();
    expect(provider.digest).toHaveBeenCalledTimes(1);

    diagnostics[0] = diagnostic({ documentRevision: revision(DIGEST_B) });
    rerender({
      editor,
      diagnostics: diagnostics as readonly CwlWritingDiagnostic[],
      digestProvider: provider,
      onError: secondError,
    });
    await waitFor(() => expect(result.current.status).toBe('invalid'));
    expect(secondError).toHaveBeenCalledWith(
      expect.objectContaining({ code: 'revision' }),
    );
    expect(firstError).not.toHaveBeenCalled();
  });

  it('contains action-callback exceptions and emits no authored text', async () => {
    const editor = createEditor();
    const onAction = vi.fn(() => {
      throw new Error('host callback failure');
    });
    const { result } = renderController({
      editor,
      diagnostics: [diagnostic()],
      digestProvider: staticDigestProvider(),
      onAction,
    });
    await waitFor(() => expect(result.current.status).toBe('active'));

    let actionResult: ReturnType<typeof result.current.ignoreDiagnostic> = null;
    act(() => {
      actionResult = result.current.ignoreDiagnostic('diag-1');
    });

    expect(actionResult).toEqual(
      expect.objectContaining({
        action: 'ignored',
        diagnosticId: 'diag-1',
        categoryCode: 'host.category',
        reasonCode: 'explicit',
      }),
    );
    expect(JSON.stringify(actionResult)).not.toContain('Host title');
    expect(JSON.stringify(actionResult)).not.toContain('Host explanation');
    expect(JSON.stringify(actionResult)).not.toContain('Omega');
    expect(pluginDiagnostics(editor)).toEqual([]);
    expect(result.current.status).toBe('active');
  });
});
