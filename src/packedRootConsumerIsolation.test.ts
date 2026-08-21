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

  it('keeps the consumer outside the checkout dependency-resolution ancestry', () => {
    expect(verifierSource).toContain("from 'node:os'");
    expect(verifierSource).toContain('tmpdir()');
    expect(verifierSource).not.toContain(
      "join(repositoryRoot, '.package-verification-')",
    );
  });

  it('reuses only the frozen dependency substrate outside the packed package tree', () => {
    expect(verifierSource).toContain('symlinkSync(');
    expect(verifierSource).toContain(
      "join(repositoryRoot, 'node_modules')",
    );
    expect(verifierSource).toContain(
      "join(verificationDirectory, 'node_modules')",
    );
  });

  it('proves resolved entrypoints are canonically contained by the extracted package', () => {
    expect(verifierSource).toContain('realpathSync');
    expect(verifierSource).toContain('relative(');
    expect(verifierSource).toContain('isAbsolute(');
    expect(verifierSource).toContain('assertResolvedInsidePackedPackage');
    expect(verifierSource).not.toContain('includes(packagePathFragment)');
  });

  it('executes only the exact canonical module entries that passed containment validation', () => {
    expect(verifierSource).toContain(
      "import { fileURLToPath, pathToFileURL } from 'node:url';",
    );
    expect(verifierSource).not.toContain(
      "import * as editor from '${packageName}';",
    );
    expect(verifierSource).not.toContain(
      "import * as autosave from '${packageName}/autosave';",
    );
    expect(verifierSource).not.toContain(
      "import * as collaboration from '${packageName}/collaboration';",
    );
    expect(verifierSource).not.toContain(
      "import * as converter from '${packageName}/converter';",
    );
    expect(verifierSource).toContain(
      "const rootEntrypoint = assertResolvedInsidePackedPackage(\n  import.meta.resolve('${packageName}')",
    );
    expect(verifierSource).toContain(
      'const editor = await import(pathToFileURL(rootEntrypoint).href);',
    );
    expect(verifierSource).toContain(
      'const autosave = await import(pathToFileURL(autosaveEntrypoint).href);',
    );
    expect(verifierSource).toContain(
      'const collaboration = await import(\n  pathToFileURL(collaborationEntrypoint).href\n);',
    );
    expect(verifierSource).toContain(
      'const converter = await import(pathToFileURL(converterEntrypoint).href);',
    );

    expect(verifierSource).not.toContain(
      "const editor = require('${packageName}');",
    );
    expect(verifierSource).not.toContain(
      "const autosave = require('${packageName}/autosave');",
    );
    expect(verifierSource).not.toContain(
      "const collaboration = require('${packageName}/collaboration');",
    );
    expect(verifierSource).not.toContain(
      "const converter = require('${packageName}/converter');",
    );
    expect(verifierSource).toContain('const editor = require(rootEntrypoint);');
    expect(verifierSource).toContain(
      'const autosave = require(autosaveEntrypoint);',
    );
    expect(verifierSource).toContain(
      'const collaboration = require(collaborationEntrypoint);',
    );
    expect(verifierSource).toContain(
      'const converter = require(converterEntrypoint);',
    );
  });
});
