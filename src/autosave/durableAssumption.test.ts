import { describe, expect, it } from 'vitest';
import type { CwlEditorDocumentRevisionEvidence } from '../documentRevisionEvidence.js';
import { createDocumentAutosaveQueue } from './index.js';

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

describe('document autosave durable shortcut validity', () => {
  it.each(['conflict', 'failure'] as const)(
    'does not report unchanged after resuming from %s without a new durable save',
    async (blockedBy) => {
      const savedEvidence = createEvidence('1');
      const uncertainEvidence = createEvidence('2');
      let uncertainAttempted = false;
      const savedTags: string[] = [];
      const queue = createDocumentAutosaveQueue({
        save(evidence) {
          if (evidence === uncertainEvidence && !uncertainAttempted) {
            uncertainAttempted = true;
            if (blockedBy === 'failure') {
              throw new Error('private ambiguous transport failure');
            }
            return { status: 'conflict' };
          }
          savedTags.push(evidence.revision.strongEntityTag);
          return { status: 'saved' };
        },
      });

      await expect(queue.enqueue(savedEvidence)).resolves.toMatchObject({
        status: 'saved',
      });
      if (blockedBy === 'failure') {
        await expect(queue.enqueue(uncertainEvidence)).rejects.toMatchObject({
          code: 'host_save_failed',
        });
      } else {
        await expect(queue.enqueue(uncertainEvidence)).resolves.toMatchObject({
          status: 'conflict',
        });
      }

      expect(queue.resume()).toBe(true);
      await expect(queue.enqueue(savedEvidence)).resolves.toMatchObject({
        status: 'saved',
        strongEntityTag: savedEvidence.revision.strongEntityTag,
      });
      expect(savedTags).toEqual([
        savedEvidence.revision.strongEntityTag,
        savedEvidence.revision.strongEntityTag,
      ]);
    },
  );
});
