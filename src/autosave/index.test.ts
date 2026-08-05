import { describe, expect, it, vi } from 'vitest';
import { createDocumentEnvelope } from '../documentEnvelope.js';
import type { DocumentEnvelopeDigestProvider } from '../documentEnvelopeRevision.js';
import {
  createDocumentEnvelopeRevisionEvidence,
  type CwlEditorDocumentRevisionEvidence,
} from '../documentRevisionEvidence.js';
import {
  DocumentAutosaveQueueError,
  createDocumentAutosaveQueue,
  type DocumentAutosaveQueue,
  type DocumentAutosaveSaveFunction,
} from './index.js';

interface Deferred<Value> {
  readonly promise: Promise<Value>;
  readonly resolve: (value: Value) => void;
  readonly reject: (reason?: unknown) => void;
}

function createDeferred<Value>(): Deferred<Value> {
  let resolve!: (value: Value) => void;
  let reject!: (reason?: unknown) => void;
  const promise = new Promise<Value>((promiseResolve, promiseReject) => {
    resolve = promiseResolve;
    reject = promiseReject;
  });
  return { promise, resolve, reject };
}

function createDigestProvider(fill: number): DocumentEnvelopeDigestProvider {
  return {
    async digest(algorithm) {
      expect(algorithm).toBe('SHA-256');
      return new Uint8Array(32).fill(fill).buffer;
    },
  };
}

async function createEvidence(
  fill: number,
  text: string,
): Promise<CwlEditorDocumentRevisionEvidence> {
  return createDocumentEnvelopeRevisionEvidence(
    createDocumentEnvelope({
      type: 'doc',
      content: [
        {
          type: 'paragraph',
          content: [{ type: 'text', text }],
        },
      ],
    }),
    undefined,
    createDigestProvider(fill),
  );
}

function expectDocumentFreeSnapshot(value: unknown): void {
  const serialized = JSON.stringify(value);
  expect(serialized).not.toContain('documentJson');
  expect(serialized).not.toContain('content');
  expect(serialized).not.toContain('paragraph');
}

async function settleMicrotasks(): Promise<void> {
  await Promise.resolve();
  await Promise.resolve();
}

describe('provider-neutral document autosave queue', () => {
  it('saves evidence once and returns frozen document-free state', async () => {
    const evidence = await createEvidence(0x11, 'first revision');
    const save = vi.fn<DocumentAutosaveSaveFunction>(() => ({
      status: 'saved',
    }));
    const queue = createDocumentAutosaveQueue({ save });

    const initialSnapshot = queue.getSnapshot();
    expect(initialSnapshot).toEqual({
      state: 'idle',
      blockedReason: null,
      activeStrongEntityTag: null,
      pendingStrongEntityTag: null,
      lastSavedStrongEntityTag: null,
    });
    expect(Object.isFrozen(initialSnapshot)).toBe(true);

    const outcome = await queue.enqueue(evidence);

    expect(save).toHaveBeenCalledOnce();
    expect(save).toHaveBeenCalledWith(evidence);
    expect(outcome).toEqual({
      status: 'saved',
      strongEntityTag: evidence.revision.strongEntityTag,
    });
    expect(Object.isFrozen(outcome)).toBe(true);
    const finalSnapshot = queue.getSnapshot();
    expect(finalSnapshot).toEqual({
      state: 'idle',
      blockedReason: null,
      activeStrongEntityTag: null,
      pendingStrongEntityTag: null,
      lastSavedStrongEntityTag: evidence.revision.strongEntityTag,
    });
    expect(Object.isFrozen(finalSnapshot)).toBe(true);
    expectDocumentFreeSnapshot(outcome);
    expectDocumentFreeSnapshot(finalSnapshot);

    const unchanged = await queue.enqueue(evidence);
    expect(unchanged).toEqual({
      status: 'unchanged',
      strongEntityTag: evidence.revision.strongEntityTag,
    });
    expect(Object.isFrozen(unchanged)).toBe(true);
    expect(save).toHaveBeenCalledOnce();
    expect(await queue.flush()).toEqual(finalSnapshot);
  });

  it('coalesces callers for the active and pending strong revisions', async () => {
    const firstEvidence = await createEvidence(0x21, 'active revision');
    const secondEvidence = await createEvidence(0x22, 'pending revision');
    const firstSave = createDeferred<{ readonly status: 'saved' }>();
    const secondSave = createDeferred<{ readonly status: 'saved' }>();
    const save = vi.fn<DocumentAutosaveSaveFunction>((evidence) =>
      evidence.revision.strongEntityTag ===
      firstEvidence.revision.strongEntityTag
        ? firstSave.promise
        : secondSave.promise,
    );
    const queue = createDocumentAutosaveQueue({ save });

    const activeOne = queue.enqueue(firstEvidence);
    const activeTwo = queue.enqueue(firstEvidence);
    const pendingOne = queue.enqueue(secondEvidence);
    const pendingTwo = queue.enqueue(secondEvidence);

    expect(activeTwo).toBe(activeOne);
    expect(pendingTwo).toBe(pendingOne);
    expect(save).toHaveBeenCalledTimes(1);
    expect(queue.getSnapshot()).toMatchObject({
      state: 'saving',
      activeStrongEntityTag: firstEvidence.revision.strongEntityTag,
      pendingStrongEntityTag: secondEvidence.revision.strongEntityTag,
    });

    firstSave.resolve({ status: 'saved' });
    await expect(activeOne).resolves.toMatchObject({ status: 'saved' });
    await settleMicrotasks();
    expect(save).toHaveBeenCalledTimes(2);
    expect(save.mock.calls[1]?.[0]).toBe(secondEvidence);

    secondSave.resolve({ status: 'saved' });
    await expect(pendingOne).resolves.toMatchObject({ status: 'saved' });
    expect(queue.getSnapshot()).toMatchObject({
      state: 'idle',
      lastSavedStrongEntityTag: secondEvidence.revision.strongEntityTag,
    });
  });

  it('retains only the newest pending revision and supersedes older waiters', async () => {
    const activeEvidence = await createEvidence(0x31, 'active revision');
    const pendingEvidence = await createEvidence(0x32, 'pending revision');
    const newestEvidence = await createEvidence(0x33, 'newest revision');
    const activeSave = createDeferred<{ readonly status: 'saved' }>();
    const newestSave = createDeferred<{ readonly status: 'saved' }>();
    const save = vi.fn<DocumentAutosaveSaveFunction>((evidence) =>
      evidence === activeEvidence ? activeSave.promise : newestSave.promise,
    );
    const queue = createDocumentAutosaveQueue({ save });

    const active = queue.enqueue(activeEvidence);
    const pending = queue.enqueue(pendingEvidence);
    const newest = queue.enqueue(newestEvidence);

    await expect(pending).resolves.toEqual({
      status: 'superseded',
      strongEntityTag: pendingEvidence.revision.strongEntityTag,
      supersededByStrongEntityTag:
        newestEvidence.revision.strongEntityTag,
    });
    expect(save).toHaveBeenCalledTimes(1);
    expect(queue.getSnapshot()).toMatchObject({
      activeStrongEntityTag: activeEvidence.revision.strongEntityTag,
      pendingStrongEntityTag: newestEvidence.revision.strongEntityTag,
    });

    activeSave.resolve({ status: 'saved' });
    await active;
    await settleMicrotasks();
    expect(save).toHaveBeenCalledTimes(2);
    expect(save.mock.calls[1]?.[0]).toBe(newestEvidence);

    newestSave.resolve({ status: 'saved' });
    await expect(newest).resolves.toMatchObject({ status: 'saved' });
  });

  it('preserves single-flight ordering during re-entrant enqueue', async () => {
    const firstEvidence = await createEvidence(0x41, 'first revision');
    const secondEvidence = await createEvidence(0x42, 'second revision');
    const firstGate = createDeferred<void>();
    const secondGate = createDeferred<void>();
    let activeCallbacks = 0;
    let maximumActiveCallbacks = 0;
    let reentrantOutcome: Promise<unknown> | undefined;
    const order: string[] = [];
    let queue!: DocumentAutosaveQueue;
    const save: DocumentAutosaveSaveFunction = async (evidence) => {
      activeCallbacks += 1;
      maximumActiveCallbacks = Math.max(
        maximumActiveCallbacks,
        activeCallbacks,
      );
      order.push(evidence.revision.strongEntityTag);
      if (evidence === firstEvidence) {
        reentrantOutcome = queue.enqueue(secondEvidence);
        await firstGate.promise;
      } else {
        await secondGate.promise;
      }
      activeCallbacks -= 1;
      return { status: 'saved' };
    };
    queue = createDocumentAutosaveQueue({ save });

    const firstOutcome = queue.enqueue(firstEvidence);
    expect(reentrantOutcome).toBeDefined();
    expect(order).toEqual([firstEvidence.revision.strongEntityTag]);

    firstGate.resolve();
    await firstOutcome;
    await settleMicrotasks();
    expect(order).toEqual([
      firstEvidence.revision.strongEntityTag,
      secondEvidence.revision.strongEntityTag,
    ]);
    expect(maximumActiveCallbacks).toBe(1);

    secondGate.resolve();
    await expect(reentrantOutcome).resolves.toMatchObject({ status: 'saved' });
  });

  it('pauses on conflict, resolves flush, and resumes retained work explicitly', async () => {
    const conflictEvidence = await createEvidence(0x51, 'conflicting revision');
    const pendingEvidence = await createEvidence(0x52, 'retained revision');
    const conflictGate = createDeferred<{ readonly status: 'conflict' }>();
    const save = vi.fn<DocumentAutosaveSaveFunction>((evidence) =>
      evidence === conflictEvidence
        ? conflictGate.promise
        : { status: 'saved' },
    );
    const queue = createDocumentAutosaveQueue({ save });

    const conflict = queue.enqueue(conflictEvidence);
    const pending = queue.enqueue(pendingEvidence);
    const flush = queue.flush();

    conflictGate.resolve({ status: 'conflict' });
    await expect(conflict).resolves.toEqual({
      status: 'conflict',
      strongEntityTag: conflictEvidence.revision.strongEntityTag,
    });
    await expect(flush).resolves.toEqual({
      state: 'blocked',
      blockedReason: 'conflict',
      activeStrongEntityTag: null,
      pendingStrongEntityTag: pendingEvidence.revision.strongEntityTag,
      lastSavedStrongEntityTag: null,
    });
    expect(save).toHaveBeenCalledTimes(1);

    expect(queue.resume()).toBe(true);
    await expect(pending).resolves.toEqual({
      status: 'saved',
      strongEntityTag: pendingEvidence.revision.strongEntityTag,
    });
    expect(save).toHaveBeenCalledTimes(2);
    expect(queue.resume()).toBe(false);
    expect(queue.getSnapshot()).toMatchObject({
      state: 'idle',
      blockedReason: null,
    });
  });

  it('redacts callback failures, blocks, and recovers only after resume', async () => {
    const failedEvidence = await createEvidence(0x61, 'failed revision');
    const recoveredEvidence = await createEvidence(0x62, 'recovered revision');
    const save = vi.fn<DocumentAutosaveSaveFunction>((evidence) => {
      if (evidence === failedEvidence) {
        throw new Error('tenant-secret-callback-detail');
      }
      return { status: 'saved' };
    });
    const queue = createDocumentAutosaveQueue({ save });

    const failed = queue.enqueue(failedEvidence);
    const recovered = queue.enqueue(recoveredEvidence);

    await expect(failed).rejects.toBeInstanceOf(DocumentAutosaveQueueError);
    try {
      await failed;
    } catch (error) {
      expect(String(error)).not.toContain('tenant-secret-callback-detail');
      expect(String(error)).toContain('host save operation failed');
    }
    expect(queue.getSnapshot()).toMatchObject({
      state: 'blocked',
      blockedReason: 'failure',
      pendingStrongEntityTag: recoveredEvidence.revision.strongEntityTag,
    });
    expect(save).toHaveBeenCalledTimes(1);

    expect(queue.resume()).toBe(true);
    await expect(recovered).resolves.toMatchObject({ status: 'saved' });
    expect(save).toHaveBeenCalledTimes(2);
  });

  it.each([
    null,
    'saved',
    { status: 'unknown' },
    { status: 'saved', extraField: true },
    Object.defineProperty({}, 'status', {
      enumerable: true,
      get() {
        throw new Error('host-secret-outcome');
      },
    }),
  ])('fails closed for an invalid save outcome %#', async (invalidOutcome) => {
    const evidence = await createEvidence(0x70, 'invalid outcome');
    const queue = createDocumentAutosaveQueue({
      save: () => invalidOutcome as never,
    });

    const request = queue.enqueue(evidence);

    await expect(request).rejects.toThrow(DocumentAutosaveQueueError);
    try {
      await request;
    } catch (error) {
      expect(String(error)).not.toContain('host-secret-outcome');
      expect(String(error)).toContain('invalid result');
    }
    expect(queue.getSnapshot()).toMatchObject({
      state: 'blocked',
      blockedReason: 'failure',
    });
    expect(queue.resume()).toBe(true);
    expect(queue.getSnapshot()).toMatchObject({ state: 'idle' });
  });

  it('closes immediately while idle and rejects later work without calling the host', async () => {
    const evidence = await createEvidence(0x81, 'closed revision');
    const save = vi.fn<DocumentAutosaveSaveFunction>(() => ({
      status: 'saved',
    }));
    const queue = createDocumentAutosaveQueue({ save });

    const closed = await queue.close();

    expect(closed).toEqual({
      state: 'closed',
      blockedReason: null,
      activeStrongEntityTag: null,
      pendingStrongEntityTag: null,
      lastSavedStrongEntityTag: null,
    });
    expect(Object.isFrozen(closed)).toBe(true);
    expect(await queue.close()).toEqual(closed);
    expect(await queue.flush()).toEqual(closed);
    expect(queue.resume()).toBe(false);
    await expect(queue.enqueue(evidence)).resolves.toEqual({
      status: 'closed',
      strongEntityTag: evidence.revision.strongEntityTag,
    });
    expect(save).not.toHaveBeenCalled();
  });

  it('closes pending work but allows one active save to finish', async () => {
    const activeEvidence = await createEvidence(0x91, 'active close revision');
    const pendingEvidence = await createEvidence(0x92, 'pending close revision');
    const laterEvidence = await createEvidence(0x93, 'later close revision');
    const activeSave = createDeferred<{ readonly status: 'saved' }>();
    const save = vi.fn<DocumentAutosaveSaveFunction>(() => activeSave.promise);
    const queue = createDocumentAutosaveQueue({ save });

    const active = queue.enqueue(activeEvidence);
    const pending = queue.enqueue(pendingEvidence);
    const close = queue.close();

    expect(queue.getSnapshot()).toMatchObject({
      state: 'closing',
      activeStrongEntityTag: activeEvidence.revision.strongEntityTag,
      pendingStrongEntityTag: null,
    });
    await expect(pending).resolves.toEqual({
      status: 'closed',
      strongEntityTag: pendingEvidence.revision.strongEntityTag,
    });
    await expect(queue.enqueue(laterEvidence)).resolves.toEqual({
      status: 'closed',
      strongEntityTag: laterEvidence.revision.strongEntityTag,
    });

    activeSave.resolve({ status: 'saved' });
    await expect(active).resolves.toMatchObject({ status: 'saved' });
    await expect(close).resolves.toMatchObject({
      state: 'closed',
      lastSavedStrongEntityTag: activeEvidence.revision.strongEntityTag,
    });
    expect(save).toHaveBeenCalledOnce();
  });

  it('closes cleanly after conflict or failure while a save is active', async () => {
    const conflictEvidence = await createEvidence(0xa1, 'close conflict');
    const conflictGate = createDeferred<{ readonly status: 'conflict' }>();
    const conflictQueue = createDocumentAutosaveQueue({
      save: () => conflictGate.promise,
    });
    const conflict = conflictQueue.enqueue(conflictEvidence);
    const conflictClose = conflictQueue.close();
    conflictGate.resolve({ status: 'conflict' });
    await expect(conflict).resolves.toMatchObject({ status: 'conflict' });
    await expect(conflictClose).resolves.toMatchObject({
      state: 'closed',
      blockedReason: null,
    });

    const failureEvidence = await createEvidence(0xa2, 'close failure');
    const failureGate = createDeferred<never>();
    const failureQueue = createDocumentAutosaveQueue({
      save: () => failureGate.promise,
    });
    const failure = failureQueue.enqueue(failureEvidence);
    const failureClose = failureQueue.close();
    failureGate.reject(new Error('private-close-failure'));
    await expect(failure).rejects.toThrow(DocumentAutosaveQueueError);
    await expect(failureClose).resolves.toMatchObject({
      state: 'closed',
      blockedReason: null,
    });
  });

  it('closes a blocked queue and resolves retained work as closed', async () => {
    const conflictEvidence = await createEvidence(0xb1, 'blocked conflict');
    const pendingEvidence = await createEvidence(0xb2, 'blocked pending');
    const conflictGate = createDeferred<{ readonly status: 'conflict' }>();
    const queue = createDocumentAutosaveQueue({
      save: (evidence) =>
        evidence === conflictEvidence
          ? conflictGate.promise
          : { status: 'saved' },
    });
    const conflict = queue.enqueue(conflictEvidence);
    const pending = queue.enqueue(pendingEvidence);
    conflictGate.resolve({ status: 'conflict' });
    await conflict;
    await queue.flush();

    const closed = await queue.close();

    await expect(pending).resolves.toEqual({
      status: 'closed',
      strongEntityTag: pendingEvidence.revision.strongEntityTag,
    });
    expect(closed).toMatchObject({
      state: 'closed',
      blockedReason: null,
      pendingStrongEntityTag: null,
    });
  });

  it('bounds pending document retention under sustained edit pressure', async () => {
    const activeEvidence = await createEvidence(0xc0, 'active pressure');
    const pendingEvidence = await Promise.all(
      Array.from({ length: 15 }, (_unused, index) =>
        createEvidence(0xc1 + index, `pending pressure ${index}`),
      ),
    );
    const activeGate = createDeferred<{ readonly status: 'saved' }>();
    const finalGate = createDeferred<{ readonly status: 'saved' }>();
    const save = vi.fn<DocumentAutosaveSaveFunction>((evidence) =>
      evidence === activeEvidence ? activeGate.promise : finalGate.promise,
    );
    const queue = createDocumentAutosaveQueue({ save });

    const active = queue.enqueue(activeEvidence);
    const pendingPromises = pendingEvidence.map((evidence) =>
      queue.enqueue(evidence),
    );

    for (let index = 0; index < pendingPromises.length - 1; index += 1) {
      await expect(pendingPromises[index]).resolves.toMatchObject({
        status: 'superseded',
      });
    }
    expect(queue.getSnapshot()).toMatchObject({
      pendingStrongEntityTag:
        pendingEvidence.at(-1)?.revision.strongEntityTag,
    });
    expect(save).toHaveBeenCalledOnce();

    activeGate.resolve({ status: 'saved' });
    await active;
    await settleMicrotasks();
    expect(save).toHaveBeenCalledTimes(2);
    expect(save.mock.calls[1]?.[0]).toBe(pendingEvidence.at(-1));

    finalGate.resolve({ status: 'saved' });
    await expect(pendingPromises.at(-1)).resolves.toMatchObject({
      status: 'saved',
    });
  });

  it.each([
    null,
    undefined,
    {},
    { save: null },
    { save: () => ({ status: 'saved' }), extraField: true },
    Object.defineProperty({}, 'save', {
      enumerable: true,
      get() {
        throw new Error('options-secret');
      },
    }),
  ])('rejects invalid queue options without leaking source values %#', (options) => {
    expect(() => createDocumentAutosaveQueue(options as never)).toThrow(
      DocumentAutosaveQueueError,
    );
    try {
      createDocumentAutosaveQueue(options as never);
    } catch (error) {
      expect(String(error)).not.toContain('options-secret');
      expect(String(error)).toContain('options are invalid');
    }
  });

  it('rejects mutable or inconsistent revision evidence before queueing', async () => {
    const evidence = await createEvidence(0xd1, 'valid evidence');
    const save = vi.fn<DocumentAutosaveSaveFunction>(() => ({
      status: 'saved',
    }));
    const queue = createDocumentAutosaveQueue({ save });
    const invalidEvidenceValues: unknown[] = [
      null,
      {},
      { ...evidence },
      Object.freeze({ envelope: evidence.envelope }),
      Object.freeze({
        envelope: evidence.envelope,
        revision: Object.freeze({
          ...evidence.revision,
          algorithm: 'SHA-1',
        }),
      }),
      Object.freeze({
        envelope: evidence.envelope,
        revision: Object.freeze({
          ...evidence.revision,
          digestHex: 'A'.repeat(64),
        }),
      }),
      Object.freeze({
        envelope: evidence.envelope,
        revision: Object.freeze({
          ...evidence.revision,
          strongEntityTag: `"sha256-${'0'.repeat(64)}"`,
        }),
      }),
      Object.freeze({
        envelope: { ...evidence.envelope },
        revision: evidence.revision,
      }),
      Object.freeze({
        envelope: Object.freeze({
          ...evidence.envelope,
          documentJson: { ...evidence.envelope.documentJson },
        }),
        revision: evidence.revision,
      }),
      Object.freeze({
        envelope: evidence.envelope,
        revision: evidence.revision,
        extraField: true,
      }),
      Object.freeze(
        Object.defineProperty(
          { envelope: evidence.envelope },
          'revision',
          {
            enumerable: true,
            get() {
              throw new Error('evidence-secret');
            },
          },
        ),
      ),
    ];

    for (const invalidEvidence of invalidEvidenceValues) {
      expect(() => queue.enqueue(invalidEvidence as never)).toThrow(
        DocumentAutosaveQueueError,
      );
      try {
        queue.enqueue(invalidEvidence as never);
      } catch (error) {
        expect(String(error)).not.toContain('evidence-secret');
        expect(String(error)).toContain('revision evidence is invalid');
      }
    }
    expect(save).not.toHaveBeenCalled();
  });
});
