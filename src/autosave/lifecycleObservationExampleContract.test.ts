import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

import { describe, expect, it } from 'vitest';

/** Read one authoritative repository text artifact for deterministic assertions. */
function repositoryFile(path: string): string {
  return readFileSync(resolve(process.cwd(), path), 'utf8');
}

describe('autosave lifecycle observation example contract', () => {
  it('requires a validated strong durable entity tag before session construction', () => {
    const guide = repositoryFile('docs/document-autosave.md');

    expect(guide).not.toContain("initialStrongEntityTag: loadedStrongEntityTag ?? ''");
    expect(guide).toContain('isStrongHttpEntityTag(loadedStrongEntityTag)');
    expect(guide).toContain('initialStrongEntityTag: loadedStrongEntityTag');
  });
});
