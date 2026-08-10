import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

import { describe, expect, it } from 'vitest';

const repositoryFile = (path: string): string =>
  readFileSync(resolve(process.cwd(), path), 'utf8');

describe('release security documentation', () => {
  it('describes the protected stable registry publishing path without stale disabled claims', () => {
    const releaseSecurity = repositoryFile('docs/release-security.md');

    expect(releaseSecurity).toContain('## External registries');
    expect(releaseSecurity).toContain('OIDC Trusted Publishing');
    expect(releaseSecurity).toContain('environment `npm`');
    expect(releaseSecurity).toContain('environment `pypi`');
    expect(releaseSecurity).toContain('same validated npm tarball and Office wheel');
    expect(releaseSecurity).toContain('root and Office package versions');
    expect(releaseSecurity).toContain('stable release tag');
    expect(releaseSecurity).toContain('prerelease tags remain GitHub-Release-only');
    expect(releaseSecurity).toContain('post-publication digest verification');
    expect(releaseSecurity).toContain('partial-publication incident');
    expect(releaseSecurity).not.toContain(
      'Registry publication remains disabled until',
    );
    expect(releaseSecurity).not.toContain(
      'Enabling registry publication is a separate, reviewed change',
    );
  });
});
