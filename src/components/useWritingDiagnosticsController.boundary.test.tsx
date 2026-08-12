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

const boundaryState = vi.hoisted(() => ({
  failValidationUnexpectedly: false,
  failProjectionIdentity: false,
}));

vi.mock('../writingDiagnostics.js', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../writingDiagnostics.js')>();
  return {
    ...actual,
    validateWritingDiagnostics: (...args: Parameters<typeof actual.validateWritingDiagnostics>) => {
      if (boundaryState.failValidationUnexpectedly) {
        throw new Error('private validator failure');
      }
      return actual.validateWritingDiagnostics(...args);
    },
  };
});

vi.mock('../writingDiagnosticProjection.js', async (importOriginal) => {
  const actual = await importOriginal<
    typeof import('../writingDiagnosticProjection.js')
  >();
  return {
    ...actual,
    resolveTextPositionSelector: (
      ...args: Parameters<typeof actual.resolveTextPositionSelector>
    ) => {
      if (boundaryState.failProjectionIdentity) {
        throw Object.freeze({ code: 'projection' });
      }
      return actual.resolveTextPositionSelector(...args);
    },
  };
});

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

function diagnostic(): CwlWritingDiagnostic {
  return {
    diagnosticId: 'diag-1',
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
    provenance: {
      workflowId: 'workflow',
      workflowVersion: '1',
      judgePolicyVersion: '1',
    },
  };
}

function digestProvider(): DocumentEnvelopeDigestProvider {
  return {
    digest: vi.fn(async () =>
      Uint8Array.from(
        DIGEST.match(/../gu)!.map((part) => Number.parseInt(part, 16)),
      ).buffer,
    ),
  };
}

afterEach(() => {
  boundaryState.failValidationUnexpectedly = false;
  boundaryState.failProjectionIdentity = false;
  for (const editor of openEditors.splice(0)) {
    if (!editor.isDestroyed) editor.destroy();
  }
  vi.restoreAllMocks();
});

describe('writing diagnostics controller defensive dependency boundaries', () => {
  it('normalizes an unexpected validator exception to a redacted contract error', async () => {
    boundaryState.failValidationUnexpectedly = true;
    const editor = createEditor();
    const onError = vi.fn();
    const { result } = renderHook(() =>
      useWritingDiagnosticsController({
        editor,
        diagnostics: [diagnostic()],
        digestProvider: digestProvider(),
        onError,
      }),
    );

    await waitFor(() => expect(result.current.status).toBe('invalid'));
    expect(onError).toHaveBeenCalledTimes(1);
    expect(onError.mock.calls[0]![0]).toMatchObject({ code: 'contract' });
    expect(onError.mock.calls[0]![0].message).not.toContain('private validator');
  });

  it('preserves the projection classification from the inverse-projection boundary', async () => {
    boundaryState.failProjectionIdentity = true;
    const editor = createEditor();
    const onError = vi.fn();
    const { result } = renderHook(() =>
      useWritingDiagnosticsController({
        editor,
        diagnostics: [diagnostic()],
        digestProvider: digestProvider(),
        onError,
      }),
    );

    await waitFor(() => expect(result.current.status).toBe('invalid'));
    expect(onError).toHaveBeenCalledWith(
      expect.objectContaining({ code: 'projection' }),
    );
  });

  it('ignores a stale editor transaction if a retired listener fires after replacement', async () => {
    const first = createEditor();
    const second = createEditor();
    vi.spyOn(first, 'off').mockImplementation(() => first);

    const { result, rerender } = renderHook(
      ({ editor }: { editor: Editor }) =>
        useWritingDiagnosticsController({
          editor,
          diagnostics: [],
          digestProvider: digestProvider(),
        }),
      { initialProps: { editor: first } },
    );
    await waitFor(() => expect(result.current.status).toBe('active'));

    rerender({ editor: second });
    await waitFor(() => {
      expect(result.current.status).toBe('active');
      expect(result.current.editor).toBe(second);
    });

    act(() => {
      first.commands.insertContent('!');
    });

    expect(result.current.status).toBe('active');
    expect(result.current.editor).toBe(second);
  });
});
