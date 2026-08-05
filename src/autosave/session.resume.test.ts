import { describe, expect, it } from 'vitest';
import {
  createDocumentAutosaveSession,
  isStrongHttpEntityTag,
  type DocumentAutosaveDurableSaveResult,
  type DocumentAutosaveQueueErrorCode,
  type DocumentAutosaveRevisionEvidence,
} from './package.js';

/** Create one exact frozen framework-free revision fixture for recovery tests. */
function createRecoveryEvidence(byte: string): DocumentAutosaveRevisionEvidence {
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

describe('durable autosave recovery validator contract', () => {
  it.each([
    ['"control\u0001"'],
    ['"beyond\u0100"'],
    ['"first", "second"'],
    ['*'],
  ])('rejects the documented non-entity-tag form %s', (candidate) => {
    expect(isStrongHttpEntityTag(candidate)).toBe(false);
  });

  it('rejects missing and symbol-keyed session options', () => {
    const save = () => ({ status: 'conflict' as const });
    const unexpectedOption = Symbol('unexpected option');
    const symbolKeyedOptions = Object.assign(
      { initialStrongEntityTag: '"server-one"', save },
      { [unexpectedOption]: true },
    );

    expect(() =>
      createDocumentAutosaveSession({
        initialStrongEntityTag: '"server-one"',
      } as never),
    ).toThrowError(expect.objectContaining({ code: 'invalid_options' }));
    expect(() =>
      createDocumentAutosaveSession(symbolKeyedOptions as never),
    ).toThrowError(expect.objectContaining({ code: 'invalid_options' }));
  });

  it('rejects a malformed recovered validator in every lifecycle state', () => {
    const recoveryErrorCode: DocumentAutosaveQueueErrorCode =
      'invalid_recovery_validator';
    const session = createDocumentAutosaveSession({
      initialStrongEntityTag: '"server-one"',
      save: () => ({ status: 'conflict' }),
    });

    expect(() => session.resume('W/"weak"')).toThrowError(
      expect.objectContaining({
        code: recoveryErrorCode,
        message: 'The recovered durable strong entity tag is invalid.',
      }),
    );
    expect(session.getSnapshot()).toMatchObject({
      state: 'idle',
      durableStrongEntityTag: '"server-one"',
    });
  });

  it('does not replace the durable validator when no blocked state is resumed', () => {
    const session = createDocumentAutosaveSession({
      initialStrongEntityTag: '"server-one"',
      save: () => ({ status: 'conflict' }),
    });

    expect(session.resume('"server-unused"')).toBe(false);
    expect(session.getSnapshot().durableStrongEntityTag).toBe('"server-one"');
  });

  it('hands the first committed server validator to concurrently queued work', async () => {
    const observedValidators: string[] = [];
    let completeFirstSave!: (result: DocumentAutosaveDurableSaveResult) => void;
    const firstSave = new Promise<DocumentAutosaveDurableSaveResult>((resolve) => {
      completeFirstSave = resolve;
    });
    const session = createDocumentAutosaveSession({
      initialStrongEntityTag: '"server-one"',
      save(request) {
        observedValidators.push(request.ifMatchStrongEntityTag);
        return observedValidators.length === 1
          ? firstSave
          : { status: 'saved', nextStrongEntityTag: '"server-three"' };
      },
    });

    const firstRequest = session.enqueue(createRecoveryEvidence('41'));
    const secondRequest = session.enqueue(createRecoveryEvidence('42'));
    expect(observedValidators).toEqual(['"server-one"']);

    completeFirstSave({
      status: 'saved',
      nextStrongEntityTag: '"server-two"',
    });
    await expect(firstRequest).resolves.toMatchObject({ status: 'saved' });
    await expect(secondRequest).resolves.toMatchObject({ status: 'saved' });
    expect(observedValidators).toEqual(['"server-one"', '"server-two"']);
  });

  it('installs the recovered validator before retained work starts', async () => {
    const observedValidators: string[] = [];
    const session = createDocumentAutosaveSession({
      initialStrongEntityTag: '"server-one"',
      save(request) {
        observedValidators.push(request.ifMatchStrongEntityTag);
        return observedValidators.length === 1
          ? { status: 'conflict' }
          : { status: 'saved', nextStrongEntityTag: '"server-three"' };
      },
    });

    await expect(session.enqueue(createRecoveryEvidence('41'))).resolves.toMatchObject({
      status: 'conflict',
    });
    const retainedRequest = session.enqueue(createRecoveryEvidence('42'));

    expect(session.resume('"server-two"')).toBe(true);
    await expect(retainedRequest).resolves.toMatchObject({ status: 'saved' });
    expect(observedValidators).toEqual(['"server-one"', '"server-two"']);
    expect(session.getSnapshot().durableStrongEntityTag).toBe('"server-three"');
  });
});