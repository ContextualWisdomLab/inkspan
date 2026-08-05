import { describe, expect, it, vi } from 'vitest';
import {
  createDocumentAutosaveQueue,
  DocumentAutosaveQueueError,
} from './package.js';

/** Create one exact autosave evidence wrapper around the supplied values. */
function createEvidence(documentJson: unknown, revision: unknown): unknown {
  return Object.freeze({
    envelope: Object.freeze({
      schemaId: 'https://inkspan.io/schemas/document-envelope/v1',
      schemaVersion: 1,
      documentJson,
    }),
    revision,
  });
}

describe('autosave detached evidence failure handling', () => {
  it('rejects malformed revision metadata before host transport', () => {
    const save = vi.fn(() => ({ status: 'saved' as const }));
    const queue = createDocumentAutosaveQueue({ save });
    const evidence = createEvidence(
      Object.freeze({ type: 'doc' }),
      Object.freeze({
        algorithm: 'SHA-256',
        digestHex: 'not-a-sha256-digest',
        strongEntityTag: '"sha256-not-a-sha256-digest"',
      }),
    );

    expect(() => queue.enqueue(evidence as never)).toThrow(
      DocumentAutosaveQueueError,
    );
    expect(save).not.toHaveBeenCalled();
  });

  it('redacts a reflection failure that occurs during detached cloning', () => {
    let getterCalls = 0;
    const hostileNode = new Proxy(
      Object.freeze({ type: 'paragraph' }),
      {
        get(target, property, receiver) {
          if (property === 'type') {
            getterCalls += 1;
            throw new Error('tenant-private-document-detail');
          }
          return Reflect.get(target, property, receiver);
        },
      },
    );
    const documentJson = Object.freeze({
      type: 'doc',
      content: Object.freeze([hostileNode]),
    });
    const digestHex = '63'.repeat(32);
    const evidence = createEvidence(
      documentJson,
      Object.freeze({
        algorithm: 'SHA-256',
        digestHex,
        strongEntityTag: `"sha256-${digestHex}"`,
      }),
    );
    const save = vi.fn(() => ({ status: 'saved' as const }));
    const queue = createDocumentAutosaveQueue({ save });

    expect(() => queue.enqueue(evidence as never)).toThrowError(
      expect.objectContaining({
        name: 'DocumentAutosaveQueueError',
        code: 'invalid_revision_evidence',
        message: 'Document revision evidence is invalid.',
      }),
    );
    expect(getterCalls).toBe(1);
    expect(save).not.toHaveBeenCalled();
  });
});
