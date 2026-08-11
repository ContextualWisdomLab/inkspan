import { describe, expect, it, vi } from 'vitest';

import {
  DocumentEnvelopeError,
  createDocumentEnvelope,
} from './documentEnvelope.js';
import { encodeDocumentEnvelope } from './documentEnvelopeCanonical.js';

describe('canonical document envelope serialization resource preflight', () => {
  it('rejects an impossible string lower bound before canonical string materialization', () => {
    const oversizedLabel = 'x'.repeat(17);
    const envelope = createDocumentEnvelope({
      type: 'doc',
      attrs: { label: oversizedLabel },
    });
    const stringify = vi.spyOn(JSON, 'stringify');
    let failure: unknown;

    try {
      encodeDocumentEnvelope(envelope, { maxUtf8Bytes: 16 });
    } catch (error) {
      failure = error;
    } finally {
      stringify.mockRestore();
    }

    expect(failure).toBeInstanceOf(DocumentEnvelopeError);
    expect(failure).toMatchObject({
      message: 'Canonical document envelope exceeds the configured UTF-8 byte limit',
    });
    expect(stringify).not.toHaveBeenCalledWith(oversizedLabel);
  });
});
