import { describe, expect, it } from 'vitest';
import {
  createDocumentAutosaveQueue,
  createDocumentAutosaveSession,
  type DocumentAutosaveDurableSaveResult,
  type DocumentAutosaveQueueSnapshot,
  type DocumentAutosaveRevisionEvidence,
  type DocumentAutosaveSaveResult,
  type DocumentAutosaveSessionSnapshot,
} from './package.js';

/** Create one exact frozen framework-free revision fixture for observer tests. */
function createObservationEvidence(byte: string): DocumentAutosaveRevisionEvidence {
  const digestHex = byte.repeat(32);
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

/** Assert that public lifecycle evidence stays frozen and document-free. */
function expectDocumentFreeSnapshot(
  snapshot: DocumentAutosaveQueueSnapshot | DocumentAutosaveSessionSnapshot,
): void {
  expect(Object.isFrozen(snapshot)).toBe(true);
  const serialized = JSON.stringify(snapshot);
  expect(serialized).not.toContain('documentJson');
  expect(serialized).not.toContain('content');
  expect(serialized).not.toContain('paragraph');
}

describe('autosave lifecycle observation', () => {
  it('reports distinct queue transitions without exposing document content', async () => {
    let completeSave!: (result: DocumentAutosaveSaveResult) => void;
    const saveResult = new Promise<DocumentAutosaveSaveResult>((resolve) => {
      completeSave = resolve;
    });
    const snapshots: DocumentAutosaveQueueSnapshot[] = [];
    const queue = createDocumentAutosaveQueue({
      save: () => saveResult,
      onSnapshotChange(snapshot) {
        snapshots.push(snapshot);
      },
    });
    const evidence = createObservationEvidence('41');

    expect(snapshots).toEqual([]);
    const request = queue.enqueue(evidence);
    expect(snapshots).toEqual([
      {
        state: 'saving',
        blockedReason: null,
        activeStrongEntityTag: evidence.revision.strongEntityTag,
        pendingStrongEntityTag: null,
        lastSavedStrongEntityTag: null,
      },
    ]);

    completeSave({ status: 'saved' });
    await expect(request).resolves.toMatchObject({ status: 'saved' });
    expect(snapshots).toEqual([
      expect.objectContaining({ state: 'saving' }),
      {
        state: 'idle',
        blockedReason: null,
        activeStrongEntityTag: null,
        pendingStrongEntityTag: null,
        lastSavedStrongEntityTag: evidence.revision.strongEntityTag,
      },
    ]);
    snapshots.forEach(expectDocumentFreeSnapshot);
  });

  it('reports pending, blocked, resumed, and closed states while ignoring observer failures', async () => {
    let completeFirstSave!: (result: DocumentAutosaveSaveResult) => void;
    const firstSave = new Promise<DocumentAutosaveSaveResult>((resolve) => {
      completeFirstSave = resolve;
    });
    const states: string[] = [];
    let observerCalls = 0;
    const queue = createDocumentAutosaveQueue({
      save: (() => {
        let saveCalls = 0;
        return (): DocumentAutosaveSaveResult | Promise<DocumentAutosaveSaveResult> => {
          saveCalls += 1;
          return saveCalls === 1 ? firstSave : { status: 'saved' };
        };
      })(),
      onSnapshotChange(snapshot) {
        observerCalls += 1;
        states.push(
          `${snapshot.state}:${snapshot.pendingStrongEntityTag ?? '-'}:${snapshot.blockedReason ?? '-'}`,
        );
        if (observerCalls === 1) throw new Error('private observer failure');
      },
    });
    const firstEvidence = createObservationEvidence('42');
    const secondEvidence = createObservationEvidence('43');

    const firstRequest = queue.enqueue(firstEvidence);
    const secondRequest = queue.enqueue(secondEvidence);
    expect(states).toEqual([
      `saving:-:-`,
      `saving:${secondEvidence.revision.strongEntityTag}:-`,
    ]);

    completeFirstSave({ status: 'conflict' });
    await expect(firstRequest).resolves.toMatchObject({ status: 'conflict' });
    expect(queue.getSnapshot()).toMatchObject({
      state: 'blocked',
      blockedReason: 'conflict',
      pendingStrongEntityTag: secondEvidence.revision.strongEntityTag,
    });
    expect(states[states.length - 1]).toBe(
      `blocked:${secondEvidence.revision.strongEntityTag}:conflict`,
    );

    expect(queue.resume()).toBe(true);
    await expect(secondRequest).resolves.toMatchObject({ status: 'saved' });
    expect(states).toContain('saving:-:-');
    expect(states[states.length - 1]).toBe('idle:-:-');

    await expect(queue.close()).resolves.toMatchObject({ state: 'closed' });
    expect(states[states.length - 1]).toBe('closed:-:-');
  });

  it('observes a redacted synchronous failure state without changing the rejected request', async () => {
    const snapshots: DocumentAutosaveQueueSnapshot[] = [];
    const queue = createDocumentAutosaveQueue({
      save() {
        throw new Error('private transport failure');
      },
      onSnapshotChange(snapshot) {
        snapshots.push(snapshot);
      },
    });

    await expect(queue.enqueue(createObservationEvidence('45'))).rejects.toMatchObject({
      code: 'host_save_failed',
      message: 'The host save operation failed.',
    });
    expect(snapshots.map((snapshot) => [snapshot.state, snapshot.blockedReason])).toEqual([
      ['blocked', 'failure'],
    ]);
    snapshots.forEach(expectDocumentFreeSnapshot);
  });

  it('publishes the committed durable validator in the same session snapshot transition', async () => {
    let completeSave!: (result: DocumentAutosaveDurableSaveResult) => void;
    const saveResult = new Promise<DocumentAutosaveDurableSaveResult>((resolve) => {
      completeSave = resolve;
    });
    const snapshots: DocumentAutosaveSessionSnapshot[] = [];
    const session = createDocumentAutosaveSession({
      initialStrongEntityTag: '"server-one"',
      save: () => saveResult,
      onSnapshotChange(snapshot) {
        snapshots.push(snapshot);
      },
    });
    const evidence = createObservationEvidence('44');

    const request = session.enqueue(evidence);
    expect(snapshots).toEqual([
      expect.objectContaining({
        state: 'saving',
        durableStrongEntityTag: '"server-one"',
      }),
    ]);

    completeSave({
      status: 'saved',
      nextStrongEntityTag: '"server-two"',
    });
    await expect(request).resolves.toMatchObject({ status: 'saved' });

    expect(snapshots[snapshots.length - 1]).toEqual(
      expect.objectContaining({
        state: 'idle',
        lastSavedStrongEntityTag: evidence.revision.strongEntityTag,
        durableStrongEntityTag: '"server-two"',
      }),
    );
    snapshots.forEach(expectDocumentFreeSnapshot);
  });

  it('ignores durable-session observer failures after coherent validator handoff', async () => {
    let observerCalls = 0;
    const session = createDocumentAutosaveSession({
      initialStrongEntityTag: '"server-one"',
      save: () => ({
        status: 'saved',
        nextStrongEntityTag: '"server-two"',
      }),
      onSnapshotChange(snapshot) {
        observerCalls += 1;
        expectDocumentFreeSnapshot(snapshot);
        throw new Error('private durable observer failure');
      },
    });

    await expect(session.enqueue(createObservationEvidence('46'))).resolves.toMatchObject({
      status: 'saved',
    });
    expect(observerCalls).toBeGreaterThanOrEqual(2);
    expect(session.getSnapshot()).toMatchObject({
      state: 'idle',
      durableStrongEntityTag: '"server-two"',
    });
  });

  it('deduplicates the coherent durable-session shutdown snapshot', async () => {
    const snapshots: DocumentAutosaveSessionSnapshot[] = [];
    const session = createDocumentAutosaveSession({
      initialStrongEntityTag: '"server-one"',
      save: () => ({
        status: 'saved',
        nextStrongEntityTag: '"server-two"',
      }),
      onSnapshotChange(snapshot) {
        snapshots.push(snapshot);
      },
    });

    await expect(session.close()).resolves.toMatchObject({
      state: 'closed',
      durableStrongEntityTag: '"server-one"',
    });
    expect(snapshots).toEqual([
      expect.objectContaining({
        state: 'closed',
        durableStrongEntityTag: '"server-one"',
      }),
    ]);
    snapshots.forEach(expectDocumentFreeSnapshot);
  });
});
