import { execFileSync } from 'node:child_process';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';

import { describe, expect, it } from 'vitest';

/** Run the repository runtime-authority scanner against one emitted JS fixture. */
function scanWithRepositoryAuthority(source: string): unknown {
  const scannerUrl = pathToFileURL(
    resolve(process.cwd(), 'scripts/javascript-runtime-authority.mjs'),
  ).href;
  const program = [
    `import { findRuntimeModuleAuthority } from ${JSON.stringify(scannerUrl)};`,
    `const source = ${JSON.stringify(source)};`,
    "const findings = findRuntimeModuleAuthority(source, 'bound-capability.js').map(({ kind, specifier }) => ({ kind, specifier }));",
    'process.stdout.write(JSON.stringify(findings));',
  ].join('\n');
  return JSON.parse(
    execFileSync(process.execPath, ['--input-type=module', '--eval', program], {
      encoding: 'utf8',
    }),
  ) as unknown;
}

describe('packed JavaScript retained CommonJS bind authority', () => {
  it('reports directly recognizable bound loader and resolver capabilities before invocation', () => {
    const source = [
      "const direct = require.bind(undefined, 'bound-package');",
      "const resolver = require.resolve.bind(require, 'bound-resolve-package');",
      'const computed = module.require.bind(module, runtimePackageName);',
      "const main = require.main.require.bind(require.main, 'main-bound-package');",
      'const late = require.bind(undefined);',
      'const object = { require() {}, resolve() {} };',
      "const benignLoader = object.require.bind(object, 'not-commonjs');",
      "const benignResolver = object.resolve.bind(object, 'not-commonjs-resolve');",
      'void [direct, resolver, computed, main, late, benignLoader, benignResolver];',
    ].join('\n');

    expect(scanWithRepositoryAuthority(source)).toEqual([
      { kind: 'commonjs-require', specifier: 'bound-package' },
      { kind: 'commonjs-resolve', specifier: 'bound-resolve-package' },
      { kind: 'commonjs-require', specifier: undefined },
      { kind: 'commonjs-require', specifier: 'main-bound-package' },
      { kind: 'commonjs-require', specifier: undefined },
    ]);
  });
});
