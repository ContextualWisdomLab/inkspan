import { describe, expect, it } from 'vitest';
import type { CwlEditorDocumentRevisionEvidence } from '../documentRevisionEvidence.js';
import {
  DocumentAutosaveQueueError,
  createDocumentAutosaveQueue,
} from './index.js';

/** Create one deeply frozen, structurally valid revision-evidence fixture. */
function createEvidence(fill: string): CwlEditorDocumentRevisionEvidence {
  const digestHex = fill.repeat(64);
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

describe('document autosave blocked durable state', () => {
  it('requeues the last saved revision after an ambiguous callback failure', async () => {
    const firstEvidence = createEvidence('1');
    const failedEvidence = createEvidence('2');
    let failedOnce = false;
    const savedTags: string[] = [];
    const queue = createDocumentAutosaveQueue({
      save(evidence) {
        if (evidence === failedEvidence && !failedOnce) {
          failedOnce = true;
          throw new Error('private transport result is ambiguous');
        }
        savedTags.push(evidence.revision.strongEntityTag);
        return { status: 'saved' };
      },
    });

    await expect(queue.enqueue(firstEvidence)).resolves.toMatchObject({
      status: 'saved',
    });
    await expect(queue.enqueue(failedEvidence)).rejects.toMatchObject<
      Partial<DocumentAutosaveQueueError>
    >({
      code: 'host_save_failed',
    });

    const restoreKnownRevision = queue.enqueue(firstEvidence);
    expect(queue.getSnapshot()).toMatchObject({
      state: 'blocked',
      blockedReason: 'failure',
      pendingStrongEntityTag: firstEvidence.revision.strongEntityTag,
      lastSavedStrongEntityTag: firstEvidence.revision.strongEntityTag,
    });

    expect(queue.resume()).toBe(true);
    await expect(restoreKnownRevision).resolves.toMatchObject({
      status: 'saved',
      strongEntityTag: firstEvidence.revision.strongEntityTag,
    });
    expect(savedTags).toEqual([
      firstEvidence.revision.strongEntityTag,
      firstEvidence.revision.strongEntityTag,
    ]);
  });
});
