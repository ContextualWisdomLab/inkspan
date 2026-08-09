import { act, cleanup, render, waitFor } from '@testing-library/react';
import { createRef } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { createDocumentEnvelopeRevision } from '../documentEnvelopeRevision.js';
import type { DocumentEnvelopeDigestProvider } from '../documentEnvelopeRevision.js';
import type { CwlEditorHandle } from '../types.js';
import { CwlEditor } from './CwlEditor.js';

afterEach(cleanup);

/** Create a deterministic SHA-256-shaped digest for exact-byte comparison. */
function createDeterministicDigest(source: BufferSource): ArrayBuffer {
  const bytes = source as Uint8Array;
  const digest = new Uint8Array(32);
  for (let index = 0; index < bytes.byteLength; index += 1) {
    digest[index % digest.byteLength] ^= bytes[index]!;
  }
  return digest.buffer;
}

describe('CwlEditor selection revision evidence', () => {
  it('binds one detached selection to the exact document revision captured before hashing', async () => {
    const editorRef = createRef<CwlEditorHandle>();
    render(
      <CwlEditor
        ref={editorRef}
        mode="markdown"
        defaultValue="Alpha review target omega"
      />,
    );
    await waitFor(() =>
      expect(editorRef.current?.getEditor()).not.toBeNull(),
    );

    const handle = editorRef.current!;
    const editor = handle.getEditor()!;
    act(() => {
      editor.commands.setTextSelection({ from: 2, to: 8 });
    });
    const capturedSelection = editor.state.selection;
    const expectedSelection = {
      anchor: capturedSelection.anchor,
      head: capturedSelection.head,
      from: capturedSelection.from,
      to: capturedSelection.to,
      empty: capturedSelection.empty,
    };
    const expectedEnvelope = handle.getDocumentEnvelope({
      maxJsonValues: 64,
    })!;

    let announceDigestStarted!: () => void;
    const digestStarted = new Promise<void>((resolve) => {
      announceDigestStarted = resolve;
    });
    let releaseDigest!: () => void;
    const digestRelease = new Promise<void>((resolve) => {
      releaseDigest = resolve;
    });
    const digestProvider: DocumentEnvelopeDigestProvider = {
      digest: vi.fn(async (_algorithm, source) => {
        announceDigestStarted();
        await digestRelease;
        return createDeterministicDigest(source);
      }),
    };

    const evidencePromise = handle.getSelectionRevisionEvidence(
      { maxJsonValues: 64 },
      digestProvider,
    );
    await digestStarted;

    act(() => {
      handle.setValue('Replacement document after capture');
      handle.getEditor()!.commands.setTextSelection(1);
    });
    releaseDigest();

    const evidence = await evidencePromise;
    expect(evidence).not.toBeNull();
    expect(evidence!.selection).toEqual(expectedSelection);
    expect(Object.isFrozen(evidence)).toBe(true);
    expect(Object.isFrozen(evidence!.selection)).toBe(true);
    expect(Object.isFrozen(evidence!.revision)).toBe(true);
    expect('envelope' in evidence!).toBe(false);
    expect(JSON.stringify(evidence)).not.toContain('Alpha review target omega');

    const expectedRevision = await createDocumentEnvelopeRevision(
      expectedEnvelope,
      { maxJsonValues: 64 },
      {
        digest: async (_algorithm, source) =>
          createDeterministicDigest(source),
      },
    );
    expect(evidence!.revision).toEqual(expectedRevision);
    expect(handle.getHTML()).toContain('Replacement document after capture');
    expect(handle.getEditor()!.state.selection.from).not.toBe(
      expectedSelection.from,
    );
  });

  it('captures a caret as empty revision-scoped selection evidence', async () => {
    const editorRef = createRef<CwlEditorHandle>();
    render(
      <CwlEditor ref={editorRef} defaultValue="Caret target" />,
    );
    await waitFor(() =>
      expect(editorRef.current?.getEditor()).not.toBeNull(),
    );

    const handle = editorRef.current!;
    act(() => {
      handle.getEditor()!.commands.setTextSelection(4);
    });
    const evidence = await handle.getSelectionRevisionEvidence(undefined, {
      digest: async () => new Uint8Array(32).fill(0x2a).buffer,
    });

    expect(evidence?.selection).toEqual({
      anchor: 4,
      head: 4,
      from: 4,
      to: 4,
      empty: true,
    });
    expect(evidence?.revision.digestHex).toBe('2a'.repeat(32));
  });
});
