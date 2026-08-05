import { describe, expect, it } from 'vitest';
import type { CwlEditorDocumentRevisionEvidence } from '../documentRevisionEvidence.js';
import {
  createDocumentAutosaveQueue,
  type DocumentAutosaveSaveResult,
} from './index.js';

function createEvidence(bytePair: string): CwlEditorDocumentRevisionEvidence {
  const digestHex = bytePair.repeat(32);
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

describe('document autosave flush waiter bound', () => {
  it('shares one pending flush promise while a save is active', async () => {
    let resolveSave!: (result: DocumentAutosaveSaveResult) => void;
    const saveResult = new Promise<DocumentAutosaveSaveResult>((resolve) => {
      resolveSave = resolve;
    });
    const queue = createDocumentAutosaveQueue({ save: () => saveResult });
    const saveOutcome = queue.enqueue(createEvidence('17'));

    const firstFlush = queue.flush();
    const secondFlush = queue.flush();
    const thirdFlush = queue.flush();

    expect(secondFlush).toBe(firstFlush);
    expect(thirdFlush).toBe(firstFlush);

    resolveSave({ status: 'saved' });
    await expect(saveOutcome).resolves.toMatchObject({ status: 'saved' });
    const settledSnapshot = await firstFlush;

    await expect(secondFlush).resolves.toBe(settledSnapshot);
    await expect(thirdFlush).resolves.toBe(settledSnapshot);
    expect(Object.isFrozen(settledSnapshot)).toBe(true);
    expect(settledSnapshot.state).toBe('idle');
  });
});
