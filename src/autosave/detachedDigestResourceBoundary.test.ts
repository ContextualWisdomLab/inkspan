import { afterEach, describe, expect, it, vi } from 'vitest';

import { createDetachedAutosaveRevisionEvidence } from './evidenceValidation.js';

afterEach(() => {
  vi.restoreAllMocks();
});

function createFrozenEvidence(digestHex: string): unknown {
  const documentJson = Object.freeze({
    type: 'doc',
    content: Object.freeze([]),
  });
  const envelope = Object.freeze({
    schemaId: 'https://inkspan.io/schemas/document-envelope/v1',
    schemaVersion: 1,
    documentJson,
  });
  const revision = Object.freeze({
    algorithm: 'SHA-256',
    digestHex,
    strongEntityTag: `"sha256-${digestHex}"`,
  });
  return Object.freeze({ envelope, revision });
}

describe('detached autosave digest resource preflight', () => {
  it('rejects an impossible SHA-256 digest length before regex scanning', () => {
    const regexTest = vi.spyOn(RegExp.prototype, 'test');

    expect(
      createDetachedAutosaveRevisionEvidence(createFrozenEvidence('a'.repeat(65))),
    ).toBeNull();
    expect(regexTest).not.toHaveBeenCalled();
  });
});
