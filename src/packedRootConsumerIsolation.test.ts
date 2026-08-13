import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

import { describe, expect, it } from 'vitest';

const verifierSource = readFileSync(
  resolve(process.cwd(), 'tests/package/verify-package.mjs'),
  'utf8',
);

describe('packed root consumer release evidence', () => {
  it('uses one real tarball and an isolated consumer package tree', () => {
    expect(verifierSource).not.toContain("'--dry-run'");
    expect(verifierSource).toContain("'--pack-destination'");
    expect(verifierSource).toContain("'node_modules'");
    expect(verifierSource).toContain('cwd: consumerDirectory');
    expect(verifierSource).toContain(
      "join(consumerDirectory, 'package.json')",
    );
    expect(verifierSource).toContain(
      "name: 'inkspan-package-verification-consumer'",
    );
    expect(verifierSource).toContain(
      'ESM root package must resolve from isolated consumer node_modules',
    );
    expect(verifierSource).toContain(
      'CommonJS root package must resolve from isolated consumer node_modules',
    );
  });
});
