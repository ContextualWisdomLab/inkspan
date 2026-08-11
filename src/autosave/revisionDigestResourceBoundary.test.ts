import { describe, expect, it, vi } from 'vitest';
import type { CwlEditorDocumentRevisionEvidence } from '../documentRevisionEvidence.js';
import {
  DocumentAutosaveQueueError,
  createDocumentAutosaveQueue,
} from './index.js';

function createRuntimeEvidence(digestHex: string): CwlEditorDocumentRevisionEvidence {
  const documentJson = Object.freeze({ type: 'doc' });
  const envelope = Object.freeze({
    schemaId: 'https://inkspan.io/schemas/document-envelope/v1' as const,
    schemaVersion: 1 as const,
    documentJson,
  });
  const revision = Object.freeze({
    algorithm: 'SHA-256' as const,
    digestHex,
    strongEntityTag: `"sha256-${digestHex}"`,
  });
  return Object.freeze({ envelope, revision }) as CwlEditorDocumentRevisionEvidence;
}

describe('autosave revision digest resource boundary', () => {
  it('rejects impossible SHA-256 text length before regex scanning', () => {
    const oversizedDigest = 'a'.repeat(65);
    const evidence = createRuntimeEvidence(oversizedDigest);
    const regexTest = vi.spyOn(RegExp.prototype, 'test');
    const queue = createDocumentAutosaveQueue({
      save: () => ({ status: 'saved' }),
    });

    try {
      expect(() => queue.enqueue(evidence)).toThrow(DocumentAutosaveQueueError);
      expect(
        regexTest.mock.calls.some(([candidate]) => candidate === oversizedDigest),
      ).toBe(false);
    } finally {
      regexTest.mockRestore();
    }
  });
});
