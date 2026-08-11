import { describe, expect, it, vi } from 'vitest';
import {
  createDocumentAutosaveSession,
  isStrongHttpEntityTag,
  type DocumentAutosaveRevisionEvidence,
} from './package.js';

const MAX_ACCEPTED_ENTITY_TAG_CODE_UNITS = 64 * 1024;

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
  return `"${'a'.repeat(MAX_ACCEPTED_ENTITY_TAG_CODE_UNITS)}"`;
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

  it('rejects an oversized initial durable validator before retaining session state', () => {
    expect(() =>
      createDocumentAutosaveSession({
        initialStrongEntityTag: createOversizedEntityTag(),
        save: () => ({ status: 'conflict' }),
      }),
    ).toThrowError(expect.objectContaining({ code: 'invalid_options' }));
  });

  it('rejects an oversized recovered validator without replacing the durable base', async () => {
    const session = createDocumentAutosaveSession({
      initialStrongEntityTag: '"server-one"',
      save: () => ({ status: 'conflict' }),
    });

    await expect(session.enqueue(createEvidence())).resolves.toMatchObject({
      status: 'conflict',
    });
    expect(() => session.resume(createOversizedEntityTag())).toThrowError(
      expect.objectContaining({ code: 'invalid_recovery_validator' }),
    );
    expect(session.getSnapshot()).toMatchObject({
      state: 'blocked',
      durableStrongEntityTag: '"server-one"',
    });
  });

  it('fails closed when a save callback returns an oversized replacement validator', async () => {
    const session = createDocumentAutosaveSession({
      initialStrongEntityTag: '"server-one"',
      save: () => ({
        status: 'saved',
        nextStrongEntityTag: createOversizedEntityTag(),
      }),
    });

    await expect(session.enqueue(createEvidence())).rejects.toMatchObject({
      code: 'invalid_save_result',
    });
    expect(session.getSnapshot()).toMatchObject({
      state: 'blocked',
      blockedReason: 'failure',
      durableStrongEntityTag: '"server-one"',
    });
  });
});
