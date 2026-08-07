import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

/** Read one UTF-8 repository document from the current exact checkout. */
function repositoryFile(path: string): string {
  return readFileSync(resolve(process.cwd(), path), 'utf8');
}

describe('selection revision evidence documentation', () => {
  it('makes the revision-scoped review primitive discoverable through the public contract', () => {
    const publicTypes = repositoryFile('src/types.ts');
    const rootIndex = repositoryFile('src/index.ts');
    const selectionGuide = repositoryFile('docs/selection-lifecycle.md');

    expect(publicTypes).toContain('getSelectionRevisionEvidence');
    expect(rootIndex).toContain('CwlEditorSelectionRevisionEvidence');
    expect(selectionGuide).toContain('getSelectionRevisionEvidence');
    expect(selectionGuide).toMatch(/exact document\s+revision/);
    expect(selectionGuide).toContain('TextPositionSelector');
    expect(selectionGuide).toContain('re-anchor');
    expect(selectionGuide).toContain('does not copy selected text');
  });

  it('records privacy, standards, rollback, and host-owned durability boundaries', () => {
    const doctoring = repositoryFile(
      'docs/doctoring/selection-revision-evidence.md',
    );
    const changelog = repositoryFile('CHANGELOG.md');

    expect(doctoring).toContain('RFC 9110');
    expect(doctoring).toContain('ProseMirror');
    expect(doctoring).toContain('Web Annotation Data Model');
    expect(doctoring).toContain('Retrieved August 8, 2026');
    expect(doctoring).toContain('host-owned re-anchoring');
    expect(doctoring).toContain('Rollback');
    expect(doctoring).toContain('selected text');
    expect(changelog).toContain('revision-scoped selection evidence');
  });
});
