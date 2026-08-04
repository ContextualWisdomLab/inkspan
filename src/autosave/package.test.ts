import { describe, expect, it } from 'vitest';
import {
  createDocumentAutosaveQueue,
  DocumentAutosaveQueueError,
  type DocumentAutosaveRevisionEvidence,
} from './package.js';

/** Create one exact frozen framework-free autosave evidence fixture. */
function createEvidence(): DocumentAutosaveRevisionEvidence {
  const digestHex = '41'.repeat(32);
  return Object.freeze({
    envelope: Object.freeze({
      schemaId: 'https://inkspan.io/schemas/document-envelope/v1',
      schemaVersion: 1,
      documentJson: Object.freeze({ type: 'doc' }),
    }),
    revision: Object.freeze({
      algorithm: 'SHA-256',
      digestHex,
      strongEntityTag: `"sha256-${digestHex}"`,
    }),
  });
}

describe('framework-free autosave package boundary', () => {
  it('delegates queue behavior without exposing editor framework types', async () => {
    const evidence = createEvidence();
    const queue = createDocumentAutosaveQueue({
      save(received) {
        expect(received).toBe(evidence);
        return { status: 'saved' };
      },
    });

    await expect(queue.enqueue(evidence)).resolves.toEqual({
      status: 'saved',
      strongEntityTag: evidence.revision.strongEntityTag,
    });
    await expect(queue.close()).resolves.toMatchObject({ state: 'closed' });
  });

  it('exports the redacted runtime error constructor', () => {
    const error = new DocumentAutosaveQueueError(
      'invalid_options',
      'Document autosave queue options are invalid.',
    );

    expect(error).toBeInstanceOf(Error);
    expect(error).toBeInstanceOf(DocumentAutosaveQueueError);
    expect(error).toMatchObject({
      name: 'DocumentAutosaveQueueError',
      code: 'invalid_options',
    });
    expect(Object.isFrozen(error)).toBe(true);
  });
});
