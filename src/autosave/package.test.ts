import { describe, expect, it } from 'vitest';
import {
  createDocumentAutosaveQueue,
  DocumentAutosaveQueueError,
  type DocumentAutosaveRevisionEvidence,
} from './package.js';

/** Create one exact frozen framework-free autosave evidence fixture. */
function createEvidence(): DocumentAutosaveRevisionEvidence {
  const digestHex = '41'.repeat(32);
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

describe('framework-free autosave package boundary', () => {
  it('delegates a detached evidence snapshot without editor framework types', async () => {
    const evidence = createEvidence();
    let receivedEvidence: DocumentAutosaveRevisionEvidence | undefined;
    const queue = createDocumentAutosaveQueue({
      save(received) {
        receivedEvidence = received;
        return { status: 'saved' };
      },
    });

    await expect(queue.enqueue(evidence)).resolves.toEqual({
      status: 'saved',
      strongEntityTag: evidence.revision.strongEntityTag,
    });
    expect(receivedEvidence).not.toBe(evidence);
    expect(receivedEvidence).toEqual(evidence);
    expect(Object.isFrozen(receivedEvidence)).toBe(true);
    expect(Object.isFrozen(receivedEvidence?.envelope)).toBe(true);
    expect(Object.isFrozen(receivedEvidence?.envelope.documentJson)).toBe(true);
    expect(Object.isFrozen(receivedEvidence?.revision)).toBe(true);
    await expect(queue.close()).resolves.toMatchObject({ state: 'closed' });
  });

  it('snapshots descriptor values instead of forwarding proxy getter output', async () => {
    const evidence = createEvidence();
    const mutableAlternateEnvelope = {
      schemaId: evidence.envelope.schemaId,
      schemaVersion: evidence.envelope.schemaVersion,
      documentJson: { type: 'doc', content: [{ type: 'paragraph' }] },
    };
    let envelopeGetterCalls = 0;
    const proxiedEvidence = new Proxy(evidence, {
      get(target, property, receiver) {
        if (property === 'envelope') {
          envelopeGetterCalls += 1;
          return mutableAlternateEnvelope;
        }
        return Reflect.get(target, property, receiver);
      },
    });
    let receivedEvidence: DocumentAutosaveRevisionEvidence | undefined;
    const queue = createDocumentAutosaveQueue({
      save(received) {
        receivedEvidence = received;
        return { status: 'saved' };
      },
    });

    await expect(queue.enqueue(proxiedEvidence)).resolves.toMatchObject({
      status: 'saved',
    });
    expect(receivedEvidence === proxiedEvidence).toBe(false);
    expect(receivedEvidence?.envelope.documentJson).toEqual({ type: 'doc' });
    expect(Object.isFrozen(receivedEvidence?.envelope.documentJson)).toBe(true);
    mutableAlternateEnvelope.documentJson.content[0] = { type: 'text' };
    expect(envelopeGetterCalls).toBe(0);
  });

  it('exports the redacted runtime error constructor', () => {
    const error = new DocumentAutosaveQueueError(
      'invalid_options',
      'Document autosave queue options are invalid.',
    );

    expect(error).toBeInstanceOf(Error);
    expect(error).toBeInstanceOf(DocumentAutosaveQueueError);
    expect(error).toMatchObject({
      name: 'DocumentAutosaveQueueError',
      code: 'invalid_options',
    });
    expect(Object.isFrozen(error)).toBe(true);
  });
});
