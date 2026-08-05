import { describe, expect, it } from 'vitest';
import {
  createDocumentAutosaveQueue,
  createDocumentAutosaveSession,
  DocumentAutosaveQueueError,
  isStrongHttpEntityTag,
  type DocumentAutosaveDurableSaveRequest,
  type DocumentAutosaveRevisionEvidence,
} from './package.js';

/** Create one exact frozen framework-free autosave evidence fixture. */
function createEvidence(byte = '41'): DocumentAutosaveRevisionEvidence {
  const digestHex = byte.repeat(32);
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

describe('durable autosave session', () => {
  it.each([
    ['""', true],
    ['"durable-revision"', true],
    [`"opaque-${String.fromCharCode(0x80)}"`, true],
    ['W/"weak"', false],
    ['durable-revision', false],
    ['"contains space"', false],
    ['"contains\\quote"', true],
    ['"contains"quote"', false],
    [null, false],
  ])('classifies RFC 9110 strong entity tags without repair', (candidate, expected) => {
    expect(isStrongHttpEntityTag(candidate)).toBe(expected);
  });

  it('rejects malformed initial options without exposing source values', () => {
    const save = () => ({ status: 'conflict' as const });

    for (const initialStrongEntityTag of ['W/"weak"', 'unquoted', '"space tag"']) {
      expect(() =>
        createDocumentAutosaveSession({ initialStrongEntityTag, save }),
      ).toThrowError(
        expect.objectContaining({ code: 'invalid_options' }),
      );
    }
    expect(() =>
      createDocumentAutosaveSession({
        initialStrongEntityTag: '"valid"',
        save: 1,
      } as never),
    ).toThrowError(expect.objectContaining({ code: 'invalid_options' }));
    expect(() =>
      createDocumentAutosaveSession(
        new Proxy({ initialStrongEntityTag: '"valid"', save }, {
          get() {
            throw new Error('private option getter');
          },
        }),
      ),
    ).toThrowError(expect.objectContaining({ code: 'invalid_options' }));
  });

  it('threads only server-issued validators through sequential durable writes', async () => {
    const requests: DocumentAutosaveDurableSaveRequest[] = [];
    const nextTags = ['"durable-two"', '"durable-three"'];
    const session = createDocumentAutosaveSession({
      initialStrongEntityTag: '"durable-one"',
      save(request) {
        requests.push(request);
        return {
          status: 'saved',
          nextStrongEntityTag: nextTags[requests.length - 1]!,
        };
      },
    });

    expect(Object.isFrozen(session)).toBe(true);
    await expect(session.enqueue(createEvidence('41'))).resolves.toMatchObject({
      status: 'saved',
    });
    await expect(session.enqueue(createEvidence('42'))).resolves.toMatchObject({
      status: 'saved',
    });

    expect(requests.map((request) => request.ifMatchStrongEntityTag)).toEqual([
      '"durable-one"',
      '"durable-two"',
    ]);
    expect(requests.every(Object.isFrozen)).toBe(true);
    expect(requests.every((request) => Object.isFrozen(request.evidence))).toBe(true);
    expect(session.getSnapshot()).toMatchObject({
      state: 'idle',
      durableStrongEntityTag: '"durable-three"',
    });
    await expect(session.flush()).resolves.toMatchObject({
      state: 'idle',
      durableStrongEntityTag: '"durable-three"',
    });
    await expect(session.close()).resolves.toMatchObject({
      state: 'closed',
      durableStrongEntityTag: '"durable-three"',
    });
  });

  it('retains the durable validator across conflict until explicit recovery', async () => {
    const requests: DocumentAutosaveDurableSaveRequest[] = [];
    const session = createDocumentAutosaveSession({
      initialStrongEntityTag: '"durable-one"',
      save(request) {
        requests.push(request);
        return requests.length === 1
          ? { status: 'conflict' }
          : { status: 'saved', nextStrongEntityTag: '"durable-three"' };
      },
    });

    await expect(session.enqueue(createEvidence('41'))).resolves.toMatchObject({
      status: 'conflict',
    });
    const pending = session.enqueue(createEvidence('42'));
    expect(session.getSnapshot()).toMatchObject({
      state: 'blocked',
      blockedReason: 'conflict',
      durableStrongEntityTag: '"durable-one"',
    });
    expect(() => session.resume('W/"weak"')).toThrowError(
      expect.objectContaining({ code: 'invalid_options' }),
    );
    expect(session.resume('"durable-two"')).toBe(true);
    await expect(pending).resolves.toMatchObject({ status: 'saved' });
    expect(requests[1]?.ifMatchStrongEntityTag).toBe('"durable-two"');
    expect(session.getSnapshot().durableStrongEntityTag).toBe('"durable-three"');
    expect(session.resume('"unused"')).toBe(false);
    expect(session.getSnapshot().durableStrongEntityTag).toBe('"durable-three"');
  });

  it.each([
    null,
    { status: 'saved' },
    { status: 'saved', nextStrongEntityTag: 'W/"weak"' },
    { status: 'conflict', unexpected: true },
    { status: 'unknown' },
  ])('fails closed for an invalid durable save result %#', async (result) => {
    const session = createDocumentAutosaveSession({
      initialStrongEntityTag: '"durable-one"',
      save: () => result as never,
    });

    await expect(session.enqueue(createEvidence())).rejects.toMatchObject({
      code: 'invalid_save_result',
    });
    expect(session.getSnapshot()).toMatchObject({
      state: 'blocked',
      blockedReason: 'failure',
      durableStrongEntityTag: '"durable-one"',
    });
  });

  it('converts hostile result access and host failures into redacted queue errors', async () => {
    const hostileResult = new Proxy({ status: 'saved' }, {
      get() {
        throw new Error('private result getter');
      },
    });
    const invalidSession = createDocumentAutosaveSession({
      initialStrongEntityTag: '"durable-one"',
      save: () => hostileResult as never,
    });
    await expect(invalidSession.enqueue(createEvidence())).rejects.toMatchObject({
      code: 'invalid_save_result',
    });

    const failedSession = createDocumentAutosaveSession({
      initialStrongEntityTag: '"durable-one"',
      save() {
        throw new Error('private transport failure');
      },
    });
    await expect(failedSession.enqueue(createEvidence())).rejects.toMatchObject({
      code: 'host_save_failed',
      message: 'The host save operation failed.',
    });
  });
});
