import { describe, expect, it, vi } from 'vitest';
import type { CwlEditorDocumentRevisionEvidence } from '../documentRevisionEvidence.js';
import {
  createDocumentAutosaveQueue,
  DocumentAutosaveQueueError,
} from './index.js';

function createEvidence(
  schemaId: string,
  schemaVersion: number,
): CwlEditorDocumentRevisionEvidence {
  const digestHex = '31'.repeat(32);
  return Object.freeze({
    envelope: Object.freeze({
      schemaId,
      schemaVersion,
      documentJson: Object.freeze({ type: 'doc' }),
    }),
    revision: Object.freeze({
      algorithm: 'SHA-256',
      digestHex,
      strongEntityTag: `"sha256-${digestHex}"`,
    }),
  }) as CwlEditorDocumentRevisionEvidence;
}

describe('document autosave schema evidence boundary', () => {
  it.each([
    ['https://inkspan.io/schemas/document-envelope/v2', 1],
    ['https://inkspan.io/schemas/document-envelope/v1', 2],
  ] as const)(
    'rejects unsupported schema evidence before the host callback',
    (schemaId, schemaVersion) => {
      const save = vi.fn(() => ({ status: 'saved' as const }));
      const queue = createDocumentAutosaveQueue({ save });

      expect(() => queue.enqueue(createEvidence(schemaId, schemaVersion))).toThrow(
        DocumentAutosaveQueueError,
      );
      expect(save).not.toHaveBeenCalled();
    },
  );
});
