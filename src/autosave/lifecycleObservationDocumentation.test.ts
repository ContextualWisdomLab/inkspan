import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

import { describe, expect, it } from 'vitest';

/** Read one authoritative repository text artifact for deterministic assertions. */
function repositoryFile(path: string): string {
  return readFileSync(resolve(process.cwd(), path), 'utf8');
}

/** Collapse prose whitespace so documentation wrapping does not weaken contracts. */
function normalizeProse(value: string): string {
  return value.replace(/\s+/gu, ' ').trim();
}

describe('autosave lifecycle observation documentation', () => {
  it('documents the bounded observer, privacy boundary, accessibility duty, and rollback', () => {
    const guide = repositoryFile('docs/document-autosave.md');
    const normalizedGuide = normalizeProse(guide);
    const doctoring = repositoryFile(
      'docs/doctoring/autosave-lifecycle-observation.md',
    );
    const changelog = repositoryFile('CHANGELOG.md');

    expect(guide).toContain('## Observe lifecycle without polling');
    expect(guide).toContain('onSnapshotChange');
    expect(normalizedGuide).toContain('does not invoke it during construction');
    expect(normalizedGuide).toContain('observer is not a durable audit log');
    expect(normalizedGuide).toContain('accessible status-message pattern');
    expect(normalizedGuide).toContain('high-cardinality public metric labels');
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
