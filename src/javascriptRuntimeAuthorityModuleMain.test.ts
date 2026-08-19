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
    "const findings = findRuntimeModuleAuthority(source, 'main-module-authority.js').map(({ kind, specifier }) => ({ kind, specifier }));",
    'process.stdout.write(JSON.stringify(findings));',
  ].join('\n');
  return JSON.parse(
    execFileSync(process.execPath, ['--input-type=module', '--eval', program], {
      encoding: 'utf8',
    }),
  ) as unknown;
}

describe('packed JavaScript CommonJS main-module authority', () => {
  it('recognizes require.main loaders without inventing a module.main authority surface', () => {
    const source = [
      "const direct = require.main.require('require-main-package');",
      "const element = require['main']['require']('require-main-element-package');",
      "const called = require.main.require.call(require.main, 'require-main-call-package');",
      "const nonexistentNodeSurface = module.main.require('not-node-commonjs-authority');",
      'const object = { main: { require() {} } };',
      "const benign = object.main.require('not-commonjs');",
      'void [direct, element, called, nonexistentNodeSurface, benign];',
    ].join('\n');

    expect(scanWithRepositoryAuthority(source)).toEqual([
      { kind: 'commonjs-require', specifier: 'require-main-package' },
      { kind: 'commonjs-require', specifier: 'require-main-element-package' },
      { kind: 'commonjs-require', specifier: 'require-main-call-package' },
    ]);
  });
});
