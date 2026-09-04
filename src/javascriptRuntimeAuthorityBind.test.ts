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
    "const findings = findRuntimeModuleAuthority(source, 'bind-authority.js').map(({ kind, specifier }) => ({ kind, specifier }));",
    'process.stdout.write(JSON.stringify(findings));',
  ].join('\n');
  return JSON.parse(
    execFileSync(process.execPath, ['--input-type=module', '--eval', program], {
      encoding: 'utf8',
    }),
  ) as unknown;
}

describe('packed JavaScript CommonJS bind authority', () => {
  it('reports statically recognizable bound CommonJS loader and resolver invocations', () => {
    const source = [
      "const required = require.bind(undefined)('bind-package');",
      "const prebound = module.require.bind(module, 'prebound-module-package')();",
      'const mainRequired = require.main.require.bind(require.main)(runtimePackageName);',
      "const resolved = require.resolve.bind(require)('bind-resolve-package');",
      "const computedResolved = require['resolve']['bind'](require)(runtimePackageName);",
      'const object = { require() {}, resolve() {} };',
      "const benignRequire = object.require.bind(object)('not-commonjs');",
      "const benignResolve = object.resolve.bind(object)('not-commonjs-resolve');",
      'void [required, prebound, mainRequired, resolved, computedResolved, benignRequire, benignResolve];',
    ].join('\n');

    expect(scanWithRepositoryAuthority(source)).toEqual([
      { kind: 'commonjs-require', specifier: 'bind-package' },
      { kind: 'commonjs-require', specifier: 'prebound-module-package' },
      { kind: 'commonjs-require', specifier: undefined },
      { kind: 'commonjs-resolve', specifier: 'bind-resolve-package' },
      { kind: 'commonjs-resolve', specifier: undefined },
    ]);
  });
});
