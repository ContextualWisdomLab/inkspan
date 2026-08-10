import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';

import { describe, expect, it } from 'vitest';
import {
  TEXT_POSITION_PROJECTION_ID,
  TEXT_POSITION_PROJECTION_VERSION,
  TextPositionSelectorEvidenceError,
  createTextPositionSelector,
} from './text-position-selector/index.js';

/** Read one repository file as UTF-8 text. */
function repositoryFile(path: string): string {
  return readFileSync(resolve(process.cwd(), path), 'utf8');
}

const packageMetadata = JSON.parse(repositoryFile('package.json')) as {
  exports: Record<string, unknown>;
  scripts: Record<string, string>;
};

describe('React-free text-position selector package contract', () => {
  it('exposes the deterministic selector core through the source subpath', () => {
    expect(TEXT_POSITION_PROJECTION_ID).toBe('inkspan-prosemirror-text');
    expect(TEXT_POSITION_PROJECTION_VERSION).toBe(1);
    expect(typeof createTextPositionSelector).toBe('function');
    expect(new TextPositionSelectorEvidenceError('segmenter_unavailable')).toMatchObject({
      name: 'TextPositionSelectorEvidenceError',
      code: 'segmenter_unavailable',
    });
  });

  it('declares one independently consumable ESM CommonJS and TypeScript subpath', () => {
    expect(packageMetadata.exports['./text-position-selector']).toEqual({
      types: './dist/text-position-selector/index.d.ts',
      import: './dist/cwl-text-position-selector.js',
      require: './dist/cwl-text-position-selector.cjs',
    });
    expect(packageMetadata.scripts.build).toContain(
      'vite build --config vite.text-position-selector.config.ts',
    );
    expect(packageMetadata.scripts['verify:package']).toContain(
      'verify-text-position-selector-subpath-package.mjs',
    );
    expect(existsSync(resolve(process.cwd(), 'vite.text-position-selector.config.ts'))).toBe(true);
    expect(existsSync(resolve(process.cwd(), 'src/text-position-selector/index.ts'))).toBe(true);
  });

  it('keeps the public distribution guide explicit about active implementation and the React-free boundary', () => {
    const guide = repositoryFile('docs/package-distribution.md');
    expect(guide).toContain(
      '`@contextualwisdomlab/cwl-editor/text-position-selector`',
    );
    expect(guide).toMatch(
      /text-position-selector`\s*\|\s*`implemented_on_active_pr`[^\n]*React-free/iu,
    );
    expect(guide).toMatch(/ESM[^\n]*CommonJS[^\n]*strict TypeScript/iu);
  });

  it('binds packed verification to no external runtime imports or ambient network and credential authority', () => {
    const verifier = repositoryFile(
      'scripts/verify-text-position-selector-subpath-package.mjs',
    );
    const guide = repositoryFile('docs/package-distribution.md');

    expect(verifier).toContain('externalRuntimeImportPattern');
    expect(verifier).toContain('ambientAuthorityPattern');
    for (const requiredBoundary of [
      'fetch',
      'XMLHttpRequest',
      'WebSocket',
      'EventSource',
      'process\\.env',
      'import\\.meta\\.env',
      'Deno\\.env',
      'Bun\\.env',
      'require',
    ]) {
      expect(verifier).toContain(requiredBoundary);
    }
    expect(guide).toMatch(/any external runtime module import/iu);
    expect(guide).toMatch(/ambient network[^.]*credential/iu);
  });

  it('rejects every dynamic import and require call regardless of argument syntax', () => {
    const verifier = repositoryFile(
      'scripts/verify-text-position-selector-subpath-package.mjs',
    );

    expect(verifier).toContain('dynamicLoaderPattern');
    expect(verifier).toContain('\\bimport\\s*\\(');
    expect(verifier).toContain('\\brequire\\s*\\(');
    expect(verifier).toContain('dynamicLoaderPattern.test(bundleSource)');
  });
});
