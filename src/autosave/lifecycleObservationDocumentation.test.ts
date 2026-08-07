import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

import { describe, expect, it } from 'vitest';

/** Read one authoritative repository text artifact for deterministic assertions. */
function repositoryFile(path: string): string {
  return readFileSync(resolve(process.cwd(), path), 'utf8');
}

describe('autosave lifecycle observation documentation', () => {
  it('documents the bounded observer, privacy boundary, accessibility duty, and rollback', () => {
    const guide = repositoryFile('docs/document-autosave.md');
    const doctoring = repositoryFile(
      'docs/doctoring/autosave-lifecycle-observation.md',
    );
    const changelog = repositoryFile('CHANGELOG.md');

    expect(guide).toContain('## Observe lifecycle without polling');
    expect(guide).toContain('onSnapshotChange');
    expect(guide).toContain('does not invoke it during construction');
    expect(guide).toContain('observer is not a durable audit log');
    expect(guide).toContain('accessible status-message pattern');
    expect(guide).toContain('high-cardinality public metric labels');
    expect(doctoring).toContain('## Evidence boundary');
    expect(doctoring).toContain('## Accessibility boundary');
    expect(doctoring).toContain('## Rollback');
    expect(doctoring).toContain('RFC 9110');
    expect(doctoring).toContain('WCAG 2.2');
    expect(doctoring).toContain('Kung, H. T., & Robinson, J. T. (1981)');
    expect(changelog).toContain('onSnapshotChange');
    expect(changelog).toContain('distinct frozen document-free snapshots');
  });
});
