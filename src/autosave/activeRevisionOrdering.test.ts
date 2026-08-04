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

describe('document autosave active revision ordering', () => {
  it('supersedes a different pending revision when the active revision becomes latest again', async () => {
    const activeEvidence = createEvidence('1');
    const pendingEvidence = createEvidence('2');
    const activeSave = createDeferred<Readonly<{ status: 'saved' }>>();
    const savedTags: string[] = [];
    const queue = createDocumentAutosaveQueue({
      save(evidence) {
        savedTags.push(evidence.revision.strongEntityTag);
        return evidence === activeEvidence
          ? activeSave.promise
          : { status: 'saved' };
      },
    });

    const firstActiveRequest = queue.enqueue(activeEvidence);
    const pendingRequest = queue.enqueue(pendingEvidence);
    const latestActiveRequest = queue.enqueue(activeEvidence);

    expect(latestActiveRequest).toBe(firstActiveRequest);
    await expect(pendingRequest).resolves.toEqual({
      status: 'superseded',
      strongEntityTag: pendingEvidence.revision.strongEntityTag,
      supersededByStrongEntityTag: activeEvidence.revision.strongEntityTag,
    });
    expect(queue.getSnapshot()).toMatchObject({
      state: 'saving',
      activeStrongEntityTag: activeEvidence.revision.strongEntityTag,
      pendingStrongEntityTag: null,
    });

    activeSave.resolve({ status: 'saved' });
    await expect(latestActiveRequest).resolves.toEqual({
      status: 'saved',
      strongEntityTag: activeEvidence.revision.strongEntityTag,
    });
    await expect(queue.flush()).resolves.toMatchObject({
      state: 'idle',
      lastSavedStrongEntityTag: activeEvidence.revision.strongEntityTag,
    });
    expect(savedTags).toEqual([activeEvidence.revision.strongEntityTag]);
  });
});
