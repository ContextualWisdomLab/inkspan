import { describe, expect, it } from 'vitest';

import {
  DocumentEnvelopeError,
  parseDocumentEnvelope,
} from './documentEnvelope.js';

describe('document envelope hostile thrown-value containment', () => {
  it('redacts a hostile value thrown by reflective envelope inspection without re-inspecting it', () => {
    const privateSentinel = new Error('private hostile proxy sentinel');
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

    expect(() => parseDocumentEnvelope(hostileEnvelope)).toThrowError(
      new DocumentEnvelopeError('Document envelope could not be inspected safely'),
    );
  });
});
