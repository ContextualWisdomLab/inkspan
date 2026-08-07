import { describe, expect, it } from 'vitest';
import {
  createDocumentAutosaveQueue,
  createDocumentAutosaveSession,
} from './package.js';

/** Create one harmless queue save callback for option-boundary tests. */
function saveQueueRevision() {
  return { status: 'saved' as const };
}

/** Create one harmless durable save callback for option-boundary tests. */
function saveDurableRevision() {
  return {
    status: 'saved' as const,
    nextStrongEntityTag: '"server-two"',
  };
}

/** Assert one construction attempt fails through the redacted option contract. */
function expectInvalidOptions(operation: () => unknown): void {
  expect(operation).toThrowError(
    expect.objectContaining({
      code: 'invalid_options',
    }),
  );
}

describe('autosave lifecycle observer option validation', () => {
  it('fails closed for malformed queue option shapes without invoking accessors', () => {
    const observer = () => undefined;
    const symbolOption = Symbol('private-option');

    for (const options of [
      null,
      1,
      {},
      { onSnapshotChange: observer },
      { save: 1 },
      { save: saveQueueRevision, unexpectedOption: true },
      {
        save: saveQueueRevision,
        onSnapshotChange: observer,
        unexpectedOption: true,
      },
      { save: saveQueueRevision, [symbolOption]: true },
      { save: saveQueueRevision, onSnapshotChange: 1 },
    ]) {
      expectInvalidOptions(() => createDocumentAutosaveQueue(options as never));
    }

    let getterCalls = 0;
    const nonEnumerableSave = Object.defineProperty({}, 'save', {
      enumerable: false,
      value: saveQueueRevision,
    });
    const accessorSave = Object.defineProperty({}, 'save', {
      enumerable: true,
      get() {
        getterCalls += 1;
        return saveQueueRevision;
      },
    });
    const nonEnumerableObserver = Object.defineProperties({}, {
      save: { enumerable: true, value: saveQueueRevision },
      onSnapshotChange: { enumerable: false, value: observer },
    });
    const accessorObserver = Object.defineProperties({}, {
      save: { enumerable: true, value: saveQueueRevision },
      onSnapshotChange: {
        enumerable: true,
        get() {
          getterCalls += 1;
          return observer;
        },
      },
    });
    const inaccessibleOptions = new Proxy(
      { save: saveQueueRevision },
      {
        ownKeys() {
          throw new Error('private reflection failure');
        },
      },
    );

    for (const options of [
      nonEnumerableSave,
      accessorSave,
      nonEnumerableObserver,
      accessorObserver,
      inaccessibleOptions,
    ]) {
      expectInvalidOptions(() => createDocumentAutosaveQueue(options as never));
    }
    expect(getterCalls).toBe(0);
  });

  it('fails closed for malformed durable observer options without invoking accessors', () => {
    const observer = () => undefined;
    const symbolOption = Symbol('private-option');
    const validBase = {
      initialStrongEntityTag: '"server-one"',
      save: saveDurableRevision,
    };

    for (const options of [
      {},
      { initialStrongEntityTag: '"server-one"', onSnapshotChange: observer },
      { ...validBase, onSnapshotChange: observer, unexpectedOption: true },
      { ...validBase, [symbolOption]: true },
      { ...validBase, onSnapshotChange: 1 },
    ]) {
      expectInvalidOptions(() => createDocumentAutosaveSession(options as never));
    }

    let getterCalls = 0;
    const nonEnumerableObserver = Object.defineProperties({}, {
      initialStrongEntityTag: {
        enumerable: true,
        value: '"server-one"',
      },
      save: { enumerable: true, value: saveDurableRevision },
      onSnapshotChange: { enumerable: false, value: observer },
    });
    const accessorObserver = Object.defineProperties({}, {
      initialStrongEntityTag: {
        enumerable: true,
        value: '"server-one"',
      },
      save: { enumerable: true, value: saveDurableRevision },
      onSnapshotChange: {
        enumerable: true,
        get() {
          getterCalls += 1;
          return observer;
        },
      },
    });
    const inaccessibleOptions = new Proxy(validBase, {
      ownKeys() {
        throw new Error('private reflection failure');
      },
    });

    for (const options of [
      nonEnumerableObserver,
      accessorObserver,
      inaccessibleOptions,
    ]) {
      expectInvalidOptions(() => createDocumentAutosaveSession(options as never));
    }
    expect(getterCalls).toBe(0);
  });
});
