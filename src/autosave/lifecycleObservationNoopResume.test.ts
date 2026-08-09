import { describe, expect, it } from 'vitest';
import {
  createDocumentAutosaveQueue,
  type DocumentAutosaveQueueSnapshot,
} from './package.js';

/** Verify no-op lifecycle commands do not manufacture observer transitions. */
describe('autosave lifecycle no-op observation', () => {
  it('does not publish the initial idle snapshot when resume is a no-op', () => {
    const snapshots: DocumentAutosaveQueueSnapshot[] = [];
    const queue = createDocumentAutosaveQueue({
      save: () => ({ status: 'saved' }),
      onSnapshotChange(snapshot) {
        snapshots.push(snapshot);
      },
    });

    expect(queue.resume()).toBe(false);
    expect(snapshots).toEqual([]);
    expect(queue.getSnapshot()).toMatchObject({
      state: 'idle',
      blockedReason: null,
    });
  });
});
