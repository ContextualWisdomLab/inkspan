import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';

import { describe, expect, it } from 'vitest';
import {
  DEFAULT_REVIEW_LIMITS,
  REVIEW_CONTRACT_SCHEMA_ID,
  REVIEW_CONTRACT_SCHEMA_VERSION,
} from './index.js';

const repositoryFile = (path: string): string =>
  readFileSync(resolve(process.cwd(), path), 'utf8');

const packageMetadata = JSON.parse(repositoryFile('package.json')) as {
  exports: Record<string, unknown>;
  scripts: Record<string, string>;
};

describe('framework-independent review package contract', () => {
  it('exposes the bounded versioned source entrypoint', () => {
    expect(REVIEW_CONTRACT_SCHEMA_ID).toBe('https://inkspan.io/schemas/review/v1');
    expect(REVIEW_CONTRACT_SCHEMA_VERSION).toBe(1);
    expect(DEFAULT_REVIEW_LIMITS.maxSuggestionTextCodeUnits).toBe(1_048_576);
  });

  it('declares independently consumable ESM CommonJS and TypeScript outputs', () => {
    expect(packageMetadata.exports['./review']).toEqual({
      types: './dist/review/index.d.ts',
      import: './dist/cwl-review.js',
      require: './dist/cwl-review.cjs',
    });
    expect(packageMetadata.scripts.build).toContain(
      'vite build --config vite.review.config.ts',
    );
    expect(packageMetadata.scripts['verify:package']).toContain(
      'verify-review-package.mjs',
    );
    expect(existsSync(resolve(process.cwd(), 'vite.review.config.ts'))).toBe(true);
    expect(existsSync(resolve(process.cwd(), 'src/review/index.ts'))).toBe(true);
  });

  it('keeps the public distribution guide honest about active implementation', () => {
    const guide = repositoryFile('docs/package-distribution.md');
    expect(guide).toContain('`@contextualwisdomlab/cwl-editor/review`');
    expect(guide).toMatch(
      /review`\s*\|\s*`implemented_on_active_pr`[^\n]*framework-independent/iu,
    );
  });

  it('binds the packed verifier to a provider-neutral runtime boundary', () => {
    const verifier = repositoryFile('scripts/verify-review-package.mjs');
    expect(verifier).toContain('externalRuntimeImportPattern');
    expect(verifier).toContain('ambientAuthorityPattern');
    expect(verifier).toContain('strict TypeScript');
    expect(verifier).toContain('createReviewOperationResult');
  });
});
