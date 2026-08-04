import { describe, expect, it } from 'vitest';
import {
  DocumentAutosaveQueueError,
  createDocumentAutosaveQueue,
} from './index.js';

describe('document autosave reflection failures', () => {
  it('fails closed when hostile option reflection throws', () => {
    const hostileOptions = new Proxy(
      {},
      {
        ownKeys() {
          throw new Error('tenant-private-proxy-detail');
        },
      },
    );

    expect(() => createDocumentAutosaveQueue(hostileOptions as never)).toThrow(
      DocumentAutosaveQueueError,
    );

    try {
      createDocumentAutosaveQueue(hostileOptions as never);
    } catch (error) {
      expect(error).toMatchObject({ code: 'invalid_options' });
      expect(String(error)).not.toContain('tenant-private-proxy-detail');
    }
  });
});
