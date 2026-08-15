import { execFileSync } from 'node:child_process';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';

import { describe, expect, it } from 'vitest';

function scanWithRepositoryAuthority(source: string): unknown {
  const scannerUrl = pathToFileURL(
    resolve(process.cwd(), 'scripts/javascript-runtime-authority.mjs'),
  ).href;
  const program = [
    `import { findRuntimeModuleAuthority } from ${JSON.stringify(scannerUrl)};`,
    `const source = ${JSON.stringify(source)};`,
    "const findings = findRuntimeModuleAuthority(source, 'construct-authority.js').map(({ kind, specifier }) => ({ kind, specifier }));",
    'process.stdout.write(JSON.stringify(findings));',
  ].join('\n');
  return JSON.parse(
    execFileSync(process.execPath, ['--input-type=module', '--eval', program], {
      encoding: 'utf8',
    }),
  ) as unknown;
}

describe('packed JavaScript CommonJS constructor authority', () => {
  it('reports statically recognizable CommonJS loaders invoked through new', () => {
    const source = [
      "const direct = new require('construct-package');",
      "const parenthesized = new (require)('parenthesized-construct-package');",
      "const comma = new (0, require)('comma-construct-package');",
      'const computed = new require(runtimePackageName);',
      'const object = { require() { return {}; } };',
      "const benign = new object.require('not-commonjs');",
      'void [direct, parenthesized, comma, computed, benign];',
    ].join('\n');

    expect(scanWithRepositoryAuthority(source)).toEqual([
      { kind: 'commonjs-require', specifier: 'construct-package' },
      { kind: 'commonjs-require', specifier: 'parenthesized-construct-package' },
      { kind: 'commonjs-require', specifier: 'comma-construct-package' },
      { kind: 'commonjs-require', specifier: undefined },
    ]);
  });

  it('proves the supported Node CommonJS require function can load through new', () => {
    const result = execFileSync(
      process.execPath,
      [
        '--eval',
        "const loaded = new require('node:path'); process.stdout.write(String(loaded === require('node:path')));",
      ],
      { encoding: 'utf8' },
    );

    expect(result).toBe('true');
  });
});
