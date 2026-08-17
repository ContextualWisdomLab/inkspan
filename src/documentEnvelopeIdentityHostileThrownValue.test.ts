import { describe, expect, it } from 'vitest';

import { DocumentEnvelopeError } from './documentEnvelope.js';
import { inspectDocumentEnvelopeIdentity } from './documentEnvelopeIdentity.js';

describe('document envelope identity hostile thrown-value containment', () => {
  it('redacts a hostile value thrown by reflective identity inspection without re-inspecting it', () => {
    const privateSentinel = new Error('private hostile identity proxy sentinel');
    const hostileThrownValue = new Proxy(
      {},
      {
        getPrototypeOf() {
          throw privateSentinel;
        },
      },
    );
    const hostileEnvelope = new Proxy(
      {},
      {
        getPrototypeOf() {
          throw hostileThrownValue;
        },
      },
    );

    expect(() => inspectDocumentEnvelopeIdentity(hostileEnvelope)).toThrowError(
      new DocumentEnvelopeError(
        'Document envelope identity could not be inspected safely',
      ),
    );
  });
});
