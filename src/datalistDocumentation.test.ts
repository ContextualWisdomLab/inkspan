import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

import { describe, expect, it } from 'vitest';

/** Read one repository document and normalize layout whitespace. */
function normalizedDocument(path: string): string {
  return readFileSync(resolve(process.cwd(), path), 'utf8')
    .replace(/\s+/gu, ' ')
    .trim();
}

describe('datalist hidden-suggestion documentation contract', () => {
  it('records the runtime, standards, release, and rollback boundaries', () => {
    const operatorGuide = normalizedDocument('docs/clipboard-security.md');
    const doctoring = normalizedDocument(
      'docs/doctoring/datalist-hidden-suggestion-content.md',
    );
    const changelog = normalizedDocument('CHANGELOG.md');

    expect(operatorGuide).toContain(
      'The HTML Living Standard also defines `<datalist>` as a suggestion source',
    );
    expect(operatorGuide).toContain(
      'Inkspan drops complete `progress`, `meter`, and `datalist` subtrees',
    );
    expect(doctoring).toContain(
      'Drop complete `datalist` subtrees from rich clipboard HTML',
    );
    expect(doctoring).toContain('HTML Living Standard: The datalist element');
    expect(doctoring).toContain(
      'cross-engine differential corpus remains a release-acceptance gate',
    );
    expect(changelog).toContain(
      '`datalist` suggestion and down-level fallback subtrees are removed',
    );
  });
});
