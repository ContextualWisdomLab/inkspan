import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

import { describe, expect, it } from 'vitest';

/** Read one repository document and normalize layout whitespace. */
function normalizedDocument(path: string): string {
  return readFileSync(resolve(process.cwd(), path), 'utf8')
    .replace(/\s+/gu, ' ')
    .trim();
}

describe('popover hidden-content documentation contract', () => {
  it('records the runtime-state, invalid-value, release, and rollback boundaries', () => {
    const operatorGuide = normalizedDocument('docs/clipboard-security.md');
    const doctoring = normalizedDocument(
      'docs/doctoring/popover-hidden-content.md',
    );
    const changelog = normalizedDocument('CHANGELOG.md');

    expect(operatorGuide).toContain(
      'Inkspan drops the complete subtree of every element that carries a `popover` attribute',
    );
    expect(operatorGuide).toContain(
      'the standard maps an invalid value to the Manual state',
    );
    expect(doctoring).toContain(
      'Static clipboard HTML retains the content attribute but does not carry that runtime visibility state',
    );
    expect(doctoring).toContain('HTML Living Standard: The popover attribute');
    expect(doctoring).toContain(
      'cross-engine differential corpus remains a release-acceptance gate',
    );
    expect(changelog).toContain(
      'Every subtree bearing a `popover` attribute is removed',
    );
  });
});
