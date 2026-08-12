import { Node as ProseMirrorNode } from '@tiptap/pm/model';
import { Editor } from '@tiptap/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { createDocumentEnvelope } from './documentEnvelope.js';
import { encodeDocumentEnvelope } from './documentEnvelopeCanonical.js';
import {
  DocumentEnvelopeRevisionError,
  type DocumentEnvelopeDigestProvider,
} from './documentEnvelopeRevision.js';
import {
  restoreDocumentEnvelopeBytesIfMatch,
  restoreDocumentEnvelopeIfMatch,
} from './documentEnvelopeIfMatch.js';
import { buildExtensions } from './extensions/kit.js';

const ZERO_REVISION_TAG = `"sha256-${'00'.repeat(32)}"`;
const DIGEST_FAILURE = 'Document envelope SHA-256 digest could not be created';
const openEditors: Editor[] = [];

function makeEditor(): Editor {
  const element = document.createElement('div');
  document.body.appendChild(element);
  const editor = new Editor({
    element,
    extensions: buildExtensions(),
    content: '<p>Current guarded document</p>',
  });
  openEditors.push(editor);
  return editor;
}

function incomingEnvelope() {
  return createDocumentEnvelope({
    type: 'doc',
    content: [
      {
        type: 'paragraph',
        content: [{ type: 'text', text: 'Replacement document' }],
      },
    ],
  });
}

afterEach(() => {
  vi.restoreAllMocks();
  for (const editor of openEditors.splice(0)) {
    if (!editor.isDestroyed) editor.destroy();
  }
  document.body.replaceChildren();
});

describe('revision-guarded restore digest capability preflight', () => {
  it('rejects an unusable provider before serializing the current document', async () => {
    const editor = makeEditor();
    const toJson = vi.spyOn(ProseMirrorNode.prototype, 'toJSON');
    const provider = { digest: 7 } as unknown as DocumentEnvelopeDigestProvider;

    await expect(
      restoreDocumentEnvelopeIfMatch(
        editor,
        ZERO_REVISION_TAG,
        incomingEnvelope(),
        undefined,
        provider,
      ),
    ).rejects.toThrow(new DocumentEnvelopeRevisionError(DIGEST_FAILURE));

    expect(toJson).not.toHaveBeenCalled();
  });

  it('preflights the same capability before current-document work on the byte path', async () => {
    const editor = makeEditor();
    const sourceBytes = encodeDocumentEnvelope(incomingEnvelope());
    const toJson = vi.spyOn(ProseMirrorNode.prototype, 'toJSON');
    const provider = { digest: 7 } as unknown as DocumentEnvelopeDigestProvider;

    await expect(
      restoreDocumentEnvelopeBytesIfMatch(
        editor,
        ZERO_REVISION_TAG,
        sourceBytes,
        undefined,
        provider,
      ),
    ).rejects.toThrow(new DocumentEnvelopeRevisionError(DIGEST_FAILURE));

    expect(toJson).not.toHaveBeenCalled();
  });

  it('captures one accessor-backed callable for both guarded revisions', async () => {
    const editor = makeEditor();
    let digestReads = 0;
    let digestCalls = 0;
    const provider = {} as DocumentEnvelopeDigestProvider;
    Object.defineProperty(provider, 'digest', {
      get() {
        digestReads += 1;
        return function digest(
          this: DocumentEnvelopeDigestProvider,
          algorithm: 'SHA-256',
          source: BufferSource,
        ): Promise<ArrayBuffer> {
          expect(this).toBe(provider);
          expect(algorithm).toBe('SHA-256');
          expect(ArrayBuffer.isView(source)).toBe(true);
          digestCalls += 1;
          return Promise.resolve(new ArrayBuffer(32));
        };
      },
    });

    const result = await restoreDocumentEnvelopeIfMatch(
      editor,
      ZERO_REVISION_TAG,
      incomingEnvelope(),
      undefined,
      provider,
    );

    expect(result).toMatchObject({
      status: 'restored',
      previousRevision: { strongEntityTag: ZERO_REVISION_TAG },
      revision: { strongEntityTag: ZERO_REVISION_TAG },
    });
    expect(digestReads).toBe(1);
    expect(digestCalls).toBe(2);
  });
});
