import { describe, expect, it, vi } from 'vitest';
import {
  createDocumentAutosaveSession,
  isStrongHttpEntityTag,
  type DocumentAutosaveRevisionEvidence,
  type DocumentAutosaveSessionSnapshot,
} from './package.js';

const MAX_ACCEPTED_ENTITY_TAG_CODE_UNITS = 64 * 1024;
const PRIVATE_ETAG_MARKER = 'PRIVATE_ETAG_SENTINEL';

/** Create one exact immutable revision fixture for durable-validator tests. */
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

/** Create one syntactically RFC-compatible tag beyond Inkspan's local ceiling. */
function createOversizedEntityTag(): string {
  return `"${PRIVATE_ETAG_MARKER}${'a'.repeat(MAX_ACCEPTED_ENTITY_TAG_CODE_UNITS)}"`;
}

describe('durable autosave entity-tag resource boundary', () => {
  it('rejects an obviously oversized validator before regex evaluation', () => {
    const regexTest = vi.spyOn(RegExp.prototype, 'test');

    expect(isStrongHttpEntityTag(createOversizedEntityTag())).toBe(false);
    expect(regexTest).not.toHaveBeenCalled();

    regexTest.mockRestore();
  });

  it('preserves syntactically valid ASCII and obs-text validators at the exact ceiling', () => {
    const exactAsciiCandidate = `"${'a'.repeat(MAX_ACCEPTED_ENTITY_TAG_CODE_UNITS - 2)}"`;
    const exactObsTextCandidate = `"${String.fromCharCode(0xff).repeat(MAX_ACCEPTED_ENTITY_TAG_CODE_UNITS - 2)}"`;

    expect(exactAsciiCandidate).toHaveLength(MAX_ACCEPTED_ENTITY_TAG_CODE_UNITS);
    expect(exactObsTextCandidate).toHaveLength(MAX_ACCEPTED_ENTITY_TAG_CODE_UNITS);
    expect(isStrongHttpEntityTag(exactAsciiCandidate)).toBe(true);
    expect(isStrongHttpEntityTag(exactObsTextCandidate)).toBe(true);
  });

  it('rejects the first otherwise-valid code unit beyond the complete-tag ceiling', () => {
    const oneOverCandidate = `"${'a'.repeat(MAX_ACCEPTED_ENTITY_TAG_CODE_UNITS - 1)}"`;

    expect(oneOverCandidate).toHaveLength(MAX_ACCEPTED_ENTITY_TAG_CODE_UNITS + 1);
    expect(isStrongHttpEntityTag(oneOverCandidate)).toBe(false);
  });

  it('rejects an oversized initial validator with a payload-redacted error', () => {
    let capturedError: unknown;
    try {
      createDocumentAutosaveSession({
        initialStrongEntityTag: createOversizedEntityTag(),
        save: () => ({ status: 'conflict' }),
      });
    } catch (error) {
      capturedError = error;
    }

    expect(capturedError).toMatchObject({ code: 'invalid_options' });
    expect((capturedError as Error).message).not.toContain(PRIVATE_ETAG_MARKER);
  });

  it('rejects an oversized recovered validator without replacing or exposing it', async () => {
    const session = createDocumentAutosaveSession({
      initialStrongEntityTag: '"server-one"',
      save: () => ({ status: 'conflict' }),
    });

    await expect(session.enqueue(createEvidence())).resolves.toMatchObject({
      status: 'conflict',
    });
    let capturedError: unknown;
    try {
      session.resume(createOversizedEntityTag());
    } catch (error) {
      capturedError = error;
    }
    expect(capturedError).toMatchObject({ code: 'invalid_recovery_validator' });
    expect((capturedError as Error).message).not.toContain(PRIVATE_ETAG_MARKER);
    expect(session.getSnapshot()).toMatchObject({
      state: 'blocked',
      durableStrongEntityTag: '"server-one"',
    });
  });

  it('fails closed without emitting or exposing an oversized replacement validator', async () => {
    const oversizedEntityTag = createOversizedEntityTag();
    const observedSnapshots: DocumentAutosaveSessionSnapshot[] = [];
    const session = createDocumentAutosaveSession({
      initialStrongEntityTag: '"server-one"',
      save: () => ({
        status: 'saved',
        nextStrongEntityTag: oversizedEntityTag,
      }),
      onSnapshotChange(snapshot) {
        observedSnapshots.push(snapshot);
      },
    });

    const capturedError = await session.enqueue(createEvidence()).then(
      () => null,
      (error: unknown) => error,
    );
    expect(capturedError).toMatchObject({ code: 'invalid_save_result' });
    expect((capturedError as Error).message).not.toContain(PRIVATE_ETAG_MARKER);
    await Promise.resolve();
    expect(session.getSnapshot()).toMatchObject({
      state: 'blocked',
      blockedReason: 'failure',
      durableStrongEntityTag: '"server-one"',
    });
    expect(observedSnapshots.length).toBeGreaterThan(0);
    expect(
      observedSnapshots.every(
        (snapshot) => snapshot.durableStrongEntityTag === '"server-one"',
      ),
    ).toBe(true);
    expect(JSON.stringify(observedSnapshots)).not.toContain(PRIVATE_ETAG_MARKER);
  });

  it('rejects malformed save status before enumerating caller-owned keys', async () => {
    let ownKeysCalls = 0;
    const invalidResult = new Proxy(
      { status: 'invalid' },
      {
        ownKeys() {
          ownKeysCalls += 1;
          throw new Error(PRIVATE_ETAG_MARKER);
        },
      },
    );
    const session = createDocumentAutosaveSession({
      initialStrongEntityTag: '"server-one"',
      save: () => invalidResult as never,
    });

    const capturedError = await session.enqueue(createEvidence()).then(
      () => null,
      (error: unknown) => error,
    );

    expect(capturedError).toMatchObject({ code: 'invalid_save_result' });
    expect((capturedError as Error).message).not.toContain(PRIVATE_ETAG_MARKER);
    expect(ownKeysCalls).toBe(0);
  });

  it('rejects malformed saved results before enumerating caller-owned keys', async () => {
    let ownKeysCalls = 0;
    const invalidResult = new Proxy(
      { status: 'saved' },
      {
        ownKeys() {
          ownKeysCalls += 1;
          throw new Error(PRIVATE_ETAG_MARKER);
        },
      },
    );
    const session = createDocumentAutosaveSession({
      initialStrongEntityTag: '"server-one"',
      save: () => invalidResult as never,
    });

    const capturedError = await session.enqueue(createEvidence()).then(
      () => null,
      (error: unknown) => error,
    );

    expect(capturedError).toMatchObject({ code: 'invalid_save_result' });
    expect((capturedError as Error).message).not.toContain(PRIVATE_ETAG_MARKER);
    expect(ownKeysCalls).toBe(0);
  });

  it('rejects non-enumerable durable result fields as non-contract objects', async () => {
    const hiddenConflict = Object.defineProperty({}, 'status', {
      value: 'conflict',
      enumerable: false,
    });
    const hiddenValidator = Object.defineProperties(
      {},
      {
        status: { value: 'saved', enumerable: true },
        nextStrongEntityTag: { value: '"server-two"', enumerable: false },
      },
    );

    for (const invalidResult of [hiddenConflict, hiddenValidator]) {
      const session = createDocumentAutosaveSession({
        initialStrongEntityTag: '"server-one"',
        save: () => invalidResult as never,
      });

      const capturedError = await session.enqueue(createEvidence()).then(
        () => null,
        (error: unknown) => error,
      );

      expect(capturedError).toMatchObject({ code: 'invalid_save_result' });
      expect(session.getSnapshot()).toMatchObject({
        state: 'blocked',
        durableStrongEntityTag: '"server-one"',
      });
    }
  });
});
