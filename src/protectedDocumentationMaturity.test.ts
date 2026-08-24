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

  it('does not describe the protected Markdown package as proposed architecture', () => {
    const architecture = repositoryFile('ARCHITECTURE.md');
    const manifest = JSON.parse(repositoryFile('package.json')) as {
      exports?: Record<string, unknown>;
    };
    const adr = repositoryFile(
      'docs/adr/0020-framework-neutral-markdown-package-boundary.md',
    );

    expect(manifest.exports).toHaveProperty('./markdown');
    expect(adr).toContain('Status: Accepted');
    expect(architecture).toContain('Markdown[Protected markdown subpath');
    expect(architecture).toContain('Accepted ADR 0020');
    expect(architecture).not.toContain('Proposed markdown subpath');
    expect(architecture).not.toContain('active PR #114');
    expect(architecture).not.toContain(
      'Until that PR or a verified successor integrates',
    );
  });

  it('does not describe the protected print stylesheet as proposed architecture', () => {
    const architecture = repositoryFile('ARCHITECTURE.md');
    const stylesheet = repositoryFile('src/styles.css');
    const adr = repositoryFile(
      'docs/adr/0021-css-paged-media-print-boundary.md',
    );

    expect(stylesheet).toContain('@media print');
    expect(adr).toContain('Status: Accepted');
    expect(architecture).toContain('Accepted ADR 0021');
    expect(architecture).toContain('protected PR #116');
    expect(architecture).not.toContain('Proposed ADR 0021');
    expect(architecture).not.toContain('active PR #116');
    expect(architecture).not.toContain('Until #116 integrates');
  });

  it('does not describe merged DOCX hyperlinks as active-PR technical scope', () => {
    const trd = repositoryFile('docs/TRD.md');
    const adr = repositoryFile(
      'docs/adr/0026-bounded-docx-external-hyperlinks.md',
    );

    expect(adr).toContain('Status: Accepted');
    expect(trd).toContain('Accepted ADR 0026');
    expect(trd).toContain('protected PR #137');
    expect(trd).toContain('implemented_on_protected_main');
    expect(trd).not.toContain('Active PR #137');
    expect(trd).not.toContain('Proposed ADR 0026');
    expect(trd).not.toContain('implemented_on_active_pr');
    expect(trd).not.toContain('Until protected integration');
  });

});