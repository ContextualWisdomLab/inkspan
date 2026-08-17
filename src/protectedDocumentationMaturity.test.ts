import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

import { describe, expect, it } from 'vitest';

const repositoryFile = (path: string): string =>
  readFileSync(resolve(process.cwd(), path), 'utf8');

describe('protected capability documentation maturity', () => {
  it('does not leave merged placeholder accessibility documented as active-PR work', () => {
    const doctoring = repositoryFile(
      'docs/doctoring/editor-placeholder-accessibility.md',
    );

    expect(doctoring).toContain('Status: Implemented on protected main');
    expect(doctoring).not.toContain('Status: Implemented on active PR');
  });

  it('does not leave the merged headless Markdown package documented as active-PR work', () => {
    const doctoring = repositoryFile(
      'docs/doctoring/headless-markdown-package.md',
    );

    expect(doctoring).toContain('Status: Implemented on protected main');
    expect(doctoring).not.toContain('Status: Implemented on active PR');
    expect(doctoring).not.toContain('implemented_on_active_pr');
  });

  it('keeps the shipped Markdown export and package-distribution maturity aligned', () => {
    const manifest = JSON.parse(repositoryFile('package.json')) as {
      exports?: Record<string, unknown>;
    };
    const distribution = repositoryFile('docs/package-distribution.md');

    expect(manifest.exports).toHaveProperty('./markdown');
    expect(distribution).toContain(
      '| `@contextualwisdomlab/cwl-editor/markdown` | `implemented_on_protected_main`',
    );
    expect(distribution).not.toContain(
      '| `@contextualwisdomlab/cwl-editor/markdown` | `implemented_on_active_pr`',
    );
  });
});
