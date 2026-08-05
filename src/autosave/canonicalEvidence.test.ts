import { describe, expect, it, vi } from 'vitest';
import {
  createDocumentAutosaveQueue,
  DocumentAutosaveQueueError,
} from './package.js';

describe('document autosave canonical evidence boundary', () => {
  it('rejects negative zero before the host callback', () => {
    const digestHex = '52'.repeat(32);
    const evidence = Object.freeze({
      envelope: Object.freeze({
        schemaId: 'https://inkspan.io/schemas/document-envelope/v1' as const,
        schemaVersion: 1 as const,
        documentJson: Object.freeze({
          type: 'doc',
          attrs: Object.freeze({ noncanonicalNumber: -0 }),
        }),
      }),
      revision: Object.freeze({
        algorithm: 'SHA-256' as const,
        digestHex,
        strongEntityTag: `"sha256-${digestHex}"`,
      }),
    });
    const save = vi.fn(() => ({ status: 'saved' as const }));
    const queue = createDocumentAutosaveQueue({ save });

    expect(() => queue.enqueue(evidence)).toThrow(DocumentAutosaveQueueError);
    expect(save).not.toHaveBeenCalled();
  });
});
