import { readFileSync } from 'node:fs';

import { describe, expect, it } from 'vitest';

const verifierSource = readFileSync(
  new URL('../tests/package/verify-package.mjs', import.meta.url),
  'utf8',
);

describe('packed root consumer release evidence', () => {
  it('uses one real tarball and an isolated consumer package tree', () => {
    expect(verifierSource).not.toContain("'--dry-run'");
    expect(verifierSource).toContain("'--pack-destination'");
    expect(verifierSource).toContain("'node_modules'");
    expect(verifierSource).toContain("join(extractionDirectory, 'package')");
    expect(verifierSource).toContain('cwd: consumerDirectory');
  });
});
