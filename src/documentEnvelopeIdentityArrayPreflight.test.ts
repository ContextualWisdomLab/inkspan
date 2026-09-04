import { describe, expect, it, vi } from 'vitest';

import { DocumentEnvelopeError } from './documentEnvelope.js';
import { inspectDocumentEnvelopeIdentity } from './documentEnvelopeIdentity.js';

describe('document envelope identity array resource preflight', () => {
  it('rejects impossible declared array length before explicit own-key enumeration', () => {
    const oversizedArray = new Array<unknown>(2);
    Object.freeze(oversizedArray);
    const source = {
      schemaId: 'https://inkspan.io/schemas/document-envelope/v-next',
      schemaVersion: 2,
      documentJson: oversizedArray,
    };

    const ownKeys = vi.spyOn(Reflect, 'ownKeys');
    try {
      expect(() =>
        inspectDocumentEnvelopeIdentity(source, { maxJsonValues: 2 }),
      ).toThrowError(
        expect.objectContaining({
          name: 'DocumentEnvelopeError',
          message: 'Document envelope exceeds the supported JSON value count',
        } satisfies Partial<DocumentEnvelopeError>),
      );
      expect(ownKeys).not.toHaveBeenCalledWith(oversizedArray);
    } finally {
      ownKeys.mockRestore();
    }
  });
});
