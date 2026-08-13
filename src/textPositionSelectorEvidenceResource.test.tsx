import { act, cleanup, render, waitFor } from '@testing-library/react';
import { createRef } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { CwlEditorHandle } from './types.js';
import { CwlEditor } from './components/CwlEditor.js';

interface SegmenterLike {
  segment(input: string): Iterable<{ readonly index: number }>;
}

interface SegmenterConstructorLike {
  readonly prototype: SegmenterLike;
}

afterEach(() => {
  vi.restoreAllMocks();
  cleanup();
});

describe('text-position selector evidence resource discipline', () => {
  it('segments one captured projection only once for both selection boundaries', async () => {
    const Segmenter = (
      Intl as unknown as { readonly Segmenter?: SegmenterConstructorLike }
    ).Segmenter;
    expect(Segmenter).toBeDefined();
    const segmentSpy = vi.spyOn(Segmenter!.prototype, 'segment');
    const editorRef = createRef<CwlEditorHandle>();
    render(<CwlEditor ref={editorRef} defaultValue="Alpha beta gamma" />);
    await waitFor(() => expect(editorRef.current?.getEditor()).not.toBeNull());

    const handle = editorRef.current!;
    act(() => {
      handle.getEditor()!.commands.setTextSelection({ from: 2, to: 11 });
    });

    const evidence = await handle.getTextPositionSelectorEvidence(undefined, {
      digest: async () => new Uint8Array(32).fill(0x55).buffer,
    });

    expect(evidence?.selector).toEqual({
      type: 'TextPositionSelector',
      start: 1,
      end: 10,
    });
    expect(segmentSpy).toHaveBeenCalledTimes(1);
    expect(segmentSpy).toHaveBeenCalledWith('Alpha beta gamma');
  });

  it('does not inspect grapheme segments after both required boundaries are proven', async () => {
    const Segmenter = (
      Intl as unknown as { readonly Segmenter?: SegmenterConstructorLike }
    ).Segmenter;
    expect(Segmenter).toBeDefined();
    const inspectLateBoundary = vi.fn(() => {
      throw new Error('grapheme iteration continued past proven boundaries');
    });
    const lateSegment = {} as { readonly index: number };
    Object.defineProperty(lateSegment, 'index', { get: inspectLateBoundary });
    const segmentSpy = vi
      .spyOn(Segmenter!.prototype, 'segment')
      .mockReturnValue([
        { index: 0 },
        { index: 1 },
        { index: 10 },
        lateSegment,
      ]);
    const editorRef = createRef<CwlEditorHandle>();
    render(
      <CwlEditor
        ref={editorRef}
        defaultValue="Alpha beta gamma delta epsilon zeta eta theta"
      />,
    );
    await waitFor(() => expect(editorRef.current?.getEditor()).not.toBeNull());

    const handle = editorRef.current!;
    act(() => {
      handle.getEditor()!.commands.setTextSelection({ from: 2, to: 11 });
    });

    const evidence = await handle.getTextPositionSelectorEvidence(undefined, {
      digest: async () => new Uint8Array(32).fill(0x55).buffer,
    });

    expect(evidence?.selector).toEqual({
      type: 'TextPositionSelector',
      start: 1,
      end: 10,
    });
    expect(segmentSpy).toHaveBeenCalledTimes(1);
    expect(inspectLateBoundary).not.toHaveBeenCalled();
  });
});
