import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

import { describe, expect, it } from 'vitest';

/** Read one canonical repository document as UTF-8 text. */
function repositoryFile(path: string): string {
  return readFileSync(resolve(process.cwd(), path), 'utf8');
}

describe('protected release-tip documentation maturity', () => {
  it('describes exact release-tag-to-main-tip enforcement as protected behavior', () => {
    const operability = repositoryFile('docs/OPERABILITY.md');

    expect(operability).toContain(
      'The protected workflow enforces this exact-tip policy',
    );
    expect(operability).not.toContain(
      'currently contains an ancestry check that is weaker than this exact-tip policy',
    );
    expect(operability).not.toContain('Issue #96');
    expect(operability).not.toContain(
      'Until that correction reaches protected `main`',
    );
  });
});
