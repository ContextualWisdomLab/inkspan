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
const documentationFitness = repositoryText('docs/DOCUMENTATION_FITNESS.md');
const rootReadme = repositoryText('README.md');
const contracts = repositoryText('docs/CONTRACTS.md');

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

  it('keeps every static public package export discoverable from the root README', () => {
    for (const exportPath of Object.keys(packageMetadata.exports).filter(
      (path) => !path.includes('*'),
    )) {
      const publicSpecifier =
        exportPath === '.'
          ? '@contextualwisdomlab/cwl-editor'
          : `@contextualwisdomlab/cwl-editor/${exportPath.slice(2)}`;
      expect(rootReadme).toContain(`\`${publicSpecifier}\``);
    }
  });

  it('describes the framework-independent evidence and autosave subpaths explicitly', () => {
    expect(distributionGuide).toContain(
      '`@contextualwisdomlab/cwl-editor/autosave`',
    );
    expect(distributionGuide).toMatch(/framework-independent autosave/iu);
    expect(distributionGuide).toContain(
      '`@contextualwisdomlab/cwl-editor/envelope-identity`',
    );
    expect(distributionGuide).toMatch(/identity-only envelope routing/iu);
    expect(distributionGuide).toContain(
      '`@contextualwisdomlab/cwl-editor/revision-evidence`',
    );
    expect(distributionGuide).toMatch(/framework-independent revision evidence/iu);
  });

  it('reconciles the React-free selector subpath to protected-main authority', () => {
    const selectorSpecifier =
      '`@contextualwisdomlab/cwl-editor/text-position-selector`';
    const selectorRow = distributionGuide
      .split('\n')
      .find((line) => line.includes(selectorSpecifier));

    expect(selectorRow).toBeDefined();
    expect(selectorRow).toContain('implemented_on_protected_main');
    expect(selectorRow).not.toContain('implemented_on_active_pr');
    expect(rootReadme).toContain(selectorSpecifier);
    expect(contracts).toContain(selectorSpecifier);
    expect(documentationFitness).toContain('React-free text-position selector subpath');
    expect(documentationFitness).toContain('implemented_on_protected_main');
  });

  it('makes the buyer-facing distribution contract discoverable from the canonical index', () => {
    expect(documentationIndex).toContain(
      '[`package-distribution.md`](package-distribution.md)',
    );
    expect(documentationIndex).toContain('public npm package entrypoints');
  });
});
