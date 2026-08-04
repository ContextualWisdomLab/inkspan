import { describe, expect, it } from 'vitest';
import type { CwlEditorDocumentRevisionEvidence } from '../documentRevisionEvidence.js';
import { createDocumentAutosaveQueue } from './index.js';

interface Deferred<Value> {
  readonly promise: Promise<Value>;
  readonly resolve: (value: Value) => void;
}

/** Create a manually controlled promise for deterministic concurrency tests. */
function createDeferred<Value>(): Deferred<Value> {
  let resolve!: (value: Value) => void;
  const promise = new Promise<Value>((promiseResolve) => {
    resolve = promiseResolve;
  });
  return { promise, resolve };
}

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

describe('document autosave durable ordering', () => {
  it('requeues a previously saved revision while a different save can overwrite it', async () => {
    const firstEvidence = createEvidence('1');
    const secondEvidence = createEvidence('2');
    const secondSave = createDeferred<Readonly<{ status: 'saved' }>>();
    const savedTags: string[] = [];
    const queue = createDocumentAutosaveQueue({
      save(evidence) {
        savedTags.push(evidence.revision.strongEntityTag);
        return evidence === secondEvidence
          ? secondSave.promise
          : { status: 'saved' };
      },
    });

    await expect(queue.enqueue(firstEvidence)).resolves.toMatchObject({
      status: 'saved',
    });

    const overwritingSave = queue.enqueue(secondEvidence);
    const restoreLatestRequest = queue.enqueue(firstEvidence);

    expect(queue.getSnapshot()).toMatchObject({
      state: 'saving',
      activeStrongEntityTag: secondEvidence.revision.strongEntityTag,
      pendingStrongEntityTag: firstEvidence.revision.strongEntityTag,
    });

    secondSave.resolve({ status: 'saved' });
    await expect(overwritingSave).resolves.toMatchObject({ status: 'saved' });
    await expect(restoreLatestRequest).resolves.toMatchObject({
      status: 'saved',
      strongEntityTag: firstEvidence.revision.strongEntityTag,
    });

    expect(savedTags).toEqual([
      firstEvidence.revision.strongEntityTag,
      secondEvidence.revision.strongEntityTag,
      firstEvidence.revision.strongEntityTag,
    ]);
    expect(queue.getSnapshot()).toMatchObject({
      state: 'idle',
      lastSavedStrongEntityTag: firstEvidence.revision.strongEntityTag,
    });
  });
});
