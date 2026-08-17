import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

import { describe, expect, it } from 'vitest';

const repositoryFile = (path: string): string =>
  readFileSync(resolve(process.cwd(), path), 'utf8');

describe('package distribution protected-main maturity', () => {
  it('describes the shipped Markdown subpath as protected-main behavior', () => {
    const manifest = JSON.parse(repositoryFile('package.json')) as {
      exports?: Record<string, unknown>;
    };
    const distribution = repositoryFile('docs/package-distribution.md');

    expect(manifest.exports).toHaveProperty('./markdown');
    expect(distribution).toMatch(
      /@contextualwisdomlab\/cwl-editor\/markdown` \| `implemented_on_protected_main`/u,
    );
    expect(distribution).not.toMatch(
      /@contextualwisdomlab\/cwl-editor\/markdown` \| `implemented_on_active_pr`/u,
    );
  });
});
