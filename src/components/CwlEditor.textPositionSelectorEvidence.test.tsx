import { act, cleanup, render, waitFor } from '@testing-library/react';
import { createRef } from 'react';
import { afterEach, describe, expect, it } from 'vitest';
import type { CwlEditorHandle } from '../types.js';
import { CwlEditor } from './CwlEditor.js';

afterEach(cleanup);

describe('CwlEditor W3C text-position selector evidence', () => {
  it('counts Unicode code points rather than ProseMirror UTF-16 structural positions', async () => {
    const editorRef = createRef<CwlEditorHandle>();
    render(<CwlEditor ref={editorRef} defaultValue="A😀B" />);
    await waitFor(() => expect(editorRef.current?.getEditor()).not.toBeNull());

    const handle = editorRef.current!;
    act(() => {
      // ProseMirror text positions use JavaScript string offsets: the astral emoji
      // occupies two UTF-16 code units between structural positions 2 and 4.
      handle.getEditor()!.commands.setTextSelection({ from: 2, to: 4 });
    });

    const evidence = await handle.getTextPositionSelectorEvidence(undefined, {
      digest: async () => new Uint8Array(32).fill(0x2a).buffer,
    });

    expect(evidence).toEqual({
      revision: expect.objectContaining({ digestHex: '2a'.repeat(32) }),
      selector: { type: 'TextPositionSelector', start: 1, end: 2 },
      textProjection: {
        id: 'inkspan-prosemirror-text',
        version: 1,
      },
    });
    expect(Object.isFrozen(evidence)).toBe(true);
    expect(Object.isFrozen(evidence!.selector)).toBe(true);
    expect(Object.isFrozen(evidence!.textProjection)).toBe(true);
    expect(JSON.stringify(evidence)).not.toContain('😀');
  });

  it('indexes multi-block bidirectional text in logical document order', async () => {
    const editorRef = createRef<CwlEditorHandle>();
    render(<CwlEditor ref={editorRef} defaultValue={'אבג\n\nXYZ'} />);
    await waitFor(() => expect(editorRef.current?.getEditor()).not.toBeNull());

    const handle = editorRef.current!;
    let secondBlockTextPosition: number | null = null;
    handle.getEditor()!.state.doc.descendants((node, position) => {
      if (node.isText && node.text === 'XYZ') secondBlockTextPosition = position;
    });
    expect(secondBlockTextPosition).not.toBeNull();
    act(() => {
      handle.getEditor()!.commands.setTextSelection({
        from: secondBlockTextPosition!,
        to: secondBlockTextPosition! + 1,
      });
    });

    const evidence = await handle.getTextPositionSelectorEvidence(undefined, {
      digest: async () => new Uint8Array(32).fill(0x33).buffer,
    });
    expect(evidence?.selector).toEqual({
      type: 'TextPositionSelector',
      start: 4,
      end: 5,
    });
  });

  it('rejects a structural selection boundary that splits a grapheme cluster', async () => {
    const editorRef = createRef<CwlEditorHandle>();
    render(<CwlEditor ref={editorRef} defaultValue={'A\u0301B'} />);
    await waitFor(() => expect(editorRef.current?.getEditor()).not.toBeNull());

    const handle = editorRef.current!;
    act(() => {
      // Position 2 falls between the base A and its combining acute accent.
      handle.getEditor()!.commands.setTextSelection(2);
    });

    await expect(
      handle.getTextPositionSelectorEvidence(undefined, {
        digest: async () => new Uint8Array(32).buffer,
      }),
    ).rejects.toMatchObject({
      name: 'TextPositionSelectorEvidenceError',
      code: 'grapheme_boundary',
    });
  });

  it('keeps selector positions and revision bound to the same state while hashing is delayed', async () => {
    const editorRef = createRef<CwlEditorHandle>();
    render(<CwlEditor ref={editorRef} defaultValue="Alpha beta" />);
    await waitFor(() => expect(editorRef.current?.getEditor()).not.toBeNull());

    const handle = editorRef.current!;
    act(() => {
      handle.getEditor()!.commands.setTextSelection({ from: 7, to: 11 });
    });

    let releaseDigest!: () => void;
    const digestRelease = new Promise<void>((resolve) => {
      releaseDigest = resolve;
    });
    let announceDigest!: () => void;
    const digestStarted = new Promise<void>((resolve) => {
      announceDigest = resolve;
    });

    const evidencePromise = handle.getTextPositionSelectorEvidence(undefined, {
      digest: async () => {
        announceDigest();
        await digestRelease;
        return new Uint8Array(32).fill(0x11).buffer;
      },
    });
    await digestStarted;
    act(() => {
      handle.setValue('Replacement');
      handle.getEditor()!.commands.setTextSelection(1);
    });
    releaseDigest();

    const evidence = await evidencePromise;
    expect(evidence?.selector).toEqual({
      type: 'TextPositionSelector',
      start: 6,
      end: 10,
    });
    expect(evidence?.revision.digestHex).toBe('11'.repeat(32));
    expect(handle.getHTML()).toContain('Replacement');
    expect(JSON.stringify(evidence)).not.toContain('Alpha beta');
  });
});
