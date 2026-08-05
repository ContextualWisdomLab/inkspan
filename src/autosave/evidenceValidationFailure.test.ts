import { describe, expect, it, vi } from 'vitest';
import { DEFAULT_DOCUMENT_ENVELOPE_LIMITS } from '../documentEnvelope.js';
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

  it('redacts top-level reflection failures before host transport', () => {
    const save = vi.fn(() => ({ status: 'saved' as const }));
    const queue = createDocumentAutosaveQueue({ save });
    const digestHex = '52'.repeat(32);
    const evidence = createEvidence(
      Object.freeze({ type: 'doc' }),
      Object.freeze({
        algorithm: 'SHA-256',
        digestHex,
        strongEntityTag: `"sha256-${digestHex}"`,
      }),
    );
    const hostileEvidence = new Proxy(evidence as object, {
      ownKeys() {
        throw new Error('sensitive reflection detail');
      },
    });

    expect(() => queue.enqueue(hostileEvidence as never)).toThrowError(
      expect.objectContaining({
        name: 'DocumentAutosaveQueueError',
        code: 'invalid_revision_evidence',
        message: 'Document revision evidence is invalid.',
      }),
    );
    expect(save).not.toHaveBeenCalled();
  });

  it('redacts an active-envelope resource failure during detached cloning', () => {
    const documentJson = Object.freeze({
      type: 'doc',
      attrs: Object.freeze({
        oversizedText: 'x'.repeat(
          DEFAULT_DOCUMENT_ENVELOPE_LIMITS.maxStringCodeUnits + 1,
        ),
      }),
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
    expect(save).not.toHaveBeenCalled();
  });
});
