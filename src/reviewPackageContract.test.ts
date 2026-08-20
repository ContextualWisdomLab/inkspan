import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

interface PackageManifest {
  exports?: Record<
    string,
    {
      types?: string;
      import?: string;
      require?: string;
    }
  >;
  scripts?: Record<string, string>;
}

const manifest = JSON.parse(
  readFileSync(new URL('../package.json', import.meta.url), 'utf8'),
) as PackageManifest;

describe('review package contract', () => {
  it('publishes a dedicated React-free review subpath', () => {
    expect(manifest.exports?.['./review']).toEqual({
      types: './dist/review/index.d.ts',
      import: './dist/cwl-review.js',
      require: './dist/cwl-review.cjs',
    });
    expect(manifest.scripts?.build).toContain(
      'vite build --config vite.review.config.ts',
    );
    expect(manifest.scripts?.['verify:package']).toContain(
      'scripts/verify-review-package.mjs',
    );
  });
});
