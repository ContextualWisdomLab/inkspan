import { describe, expect, it, vi } from 'vitest';
import {
  createDocumentAutosaveQueue,
  createDocumentAutosaveSession,
  type DocumentAutosaveDurableSaveResult,
  type DocumentAutosaveRevisionEvidence,
  type DocumentAutosaveSaveResult,
} from './package.js';

/** Create one exact immutable revision fixture for settlement-observer tests. */
function createEvidence(byte: string): DocumentAutosaveRevisionEvidence {
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

describe('autosave lifecycle settlement observation bounds', () => {
  it('attaches only one settlement observer when duplicate queue requests share a promise', async () => {
    let completeSave!: (result: DocumentAutosaveSaveResult) => void;
    const saveResult = new Promise<DocumentAutosaveSaveResult>((resolve) => {
      completeSave = resolve;
    });
    const queue = createDocumentAutosaveQueue({
      save: () => saveResult,
      onSnapshotChange: () => undefined,
    });
    const evidence = createEvidence('51');
    const thenSpy = vi.spyOn(Promise.prototype, 'then');
    const firstRequest = queue.enqueue(evidence);
    const thenCallsAfterFirstRequest = thenSpy.mock.calls.length;

    try {
      const duplicateRequest = queue.enqueue(evidence);
      expect(duplicateRequest).toBe(firstRequest);
      expect(thenSpy.mock.calls.length).toBe(thenCallsAfterFirstRequest);
    } finally {
      thenSpy.mockRestore();
      completeSave({ status: 'saved' });
      await firstRequest;
    }
  });

  it('attaches only one settlement observer when duplicate durable-session requests share a promise', async () => {
    let completeSave!: (result: DocumentAutosaveDurableSaveResult) => void;
    const saveResult = new Promise<DocumentAutosaveDurableSaveResult>((resolve) => {
      completeSave = resolve;
    });
    const session = createDocumentAutosaveSession({
      initialStrongEntityTag: '"server-one"',
      save: () => saveResult,
      onSnapshotChange: () => undefined,
    });
    const evidence = createEvidence('52');
    const thenSpy = vi.spyOn(Promise.prototype, 'then');
    const firstRequest = session.enqueue(evidence);
    const thenCallsAfterFirstRequest = thenSpy.mock.calls.length;

    try {
      const duplicateRequest = session.enqueue(evidence);
      expect(duplicateRequest).toBe(firstRequest);
      expect(thenSpy.mock.calls.length).toBe(thenCallsAfterFirstRequest);
    } finally {
      thenSpy.mockRestore();
      completeSave({
        status: 'saved',
        nextStrongEntityTag: '"server-two"',
      });
      await firstRequest;
    }
  });
});
