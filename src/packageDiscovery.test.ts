import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

import { describe, expect, it } from 'vitest';

interface PackageMetadata {
  readonly exports: Readonly<Record<string, unknown>>;
  readonly keywords: readonly string[];
}

const repositoryFile = (path: string): string =>
  readFileSync(resolve(process.cwd(), path), 'utf8');

const packageMetadata = (): PackageMetadata =>
  JSON.parse(repositoryFile('package.json')) as PackageMetadata;

describe('buyer-visible package discovery', () => {
  it('documents every persistence-oriented public package subpath', () => {
    const readme = repositoryFile('README.md');
    const metadata = packageMetadata();

    for (const subpath of ['./autosave', './revision-evidence'] as const) {
      expect(metadata.exports).toHaveProperty([subpath]);
      expect(readme).toContain(
        `@contextualwisdomlab/cwl-editor/${subpath.slice(2)}`,
      );
    }
  });

  it('provides a copyable fail-closed autosave path and explicit host boundary', () => {
    const readme = repositoryFile('README.md');

    expect(readme).toContain('## Provider-neutral autosave');
    expect(readme).toContain(
      "import { createDocumentAutosaveQueue } from '@contextualwisdomlab/cwl-editor/autosave';",
    );
    expect(readme).toContain(
      'let durableStrongEntityTag = loadedStrongEntityTag;',
    );
    expect(readme).not.toContain('loadedRevision.strongEntityTag');
    expect(readme).toContain('if (!response.ok)');
    expect(readme).toContain("throw new Error('Private transport failure');");
    expect(readme).toContain(
      "const nextDurableStrongEntityTag = response.headers.get('ETag');",
    );
    expect(readme).toContain('const isQuotedOpaqueTag =');
    expect(readme).toContain(
      '/^"[\\u0021\\u0023-\\u007e\\u0080-\\u00ff]*"$/.test(',
    );
    expect(readme).toContain('nextDurableStrongEntityTag === null');
    expect(readme).toContain("nextDurableStrongEntityTag.startsWith('W/')");
    expect(readme).toContain('!isQuotedOpaqueTag');
    expect(readme).toContain(
      "throw new Error('Durable save response omitted a strong ETag');",
    );
    expect(readme).toContain(
      'durableStrongEntityTag = nextDurableStrongEntityTag;',
    );
    expect(readme).not.toContain(
      'durableStrongEntityTag = evidence.revision.strongEntityTag;',
    );
    expect(readme).toContain('authorization, tenant isolation, persistence');
    expect(readme).toContain('RFC 9110 `If-Match`');
    expect(readme).toContain('[`docs/document-autosave.md`](docs/document-autosave.md)');
  });

  it('makes persistence capabilities discoverable in npm metadata', () => {
    const metadata = packageMetadata();

    expect(metadata.keywords).toEqual(
      expect.arrayContaining([
        'autosave',
        'document-persistence',
        'optimistic-concurrency',
      ]),
    );
  });

  it('records the commercial discoverability decision and unreleased change', () => {
    const changelog = repositoryFile('CHANGELOG.md');
    const doctoring = repositoryFile(
      'docs/doctoring/autosave-product-discovery.md',
    );

    expect(changelog).toContain('buyer-visible autosave onboarding');
    expect(changelog).toContain('missing, weak, or malformed validators');
    expect(doctoring).toContain('Node.js package subpath exports');
    expect(doctoring).toContain('npm search');
    expect(doctoring).toContain('GitHub repository README guidance');
    expect(doctoring).toContain('server-selected opaque validator');
    expect(doctoring).toContain('quoted opaque-tag syntax');
    expect(doctoring).toContain('RFC 9110');
  });
});
