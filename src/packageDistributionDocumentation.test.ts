import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

import { describe, expect, it } from 'vitest';

const repositoryText = (path: string): string =>
  readFileSync(resolve(process.cwd(), path), 'utf8');

const packageMetadata = JSON.parse(repositoryText('package.json')) as {
  exports: Record<string, unknown>;
};
const distributionGuide = repositoryText('docs/package-distribution.md');
const documentationIndex = repositoryText('docs/README.md');

describe('package distribution documentation contract', () => {
  it('discovers every declared public package export from one buyer-facing guide', () => {
    for (const exportPath of Object.keys(packageMetadata.exports)) {
      const publicSpecifier =
        exportPath === '.'
          ? '@contextualwisdomlab/cwl-editor'
          : `@contextualwisdomlab/cwl-editor/${exportPath.slice(2)}`;
      expect(distributionGuide).toContain(`\`${publicSpecifier}\``);
    }
  });

  it('describes the framework-independent evidence and autosave subpaths explicitly', () => {
    expect(distributionGuide).toContain(
      '`@contextualwisdomlab/cwl-editor/autosave`',
    );
    expect(distributionGuide).toContain('framework-independent autosave');
    expect(distributionGuide).toContain(
      '`@contextualwisdomlab/cwl-editor/envelope-identity`',
    );
    expect(distributionGuide).toContain('identity-only envelope routing');
    expect(distributionGuide).toContain(
      '`@contextualwisdomlab/cwl-editor/revision-evidence`',
    );
    expect(distributionGuide).toContain('framework-independent revision evidence');
  });

  it('makes the buyer-facing distribution contract discoverable from the canonical index', () => {
    expect(documentationIndex).toContain(
      '[`package-distribution.md`](package-distribution.md)',
    );
    expect(documentationIndex).toContain('public npm package entrypoints');
  });
});
