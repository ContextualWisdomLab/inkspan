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
    "const findings = findRuntimeModuleAuthority(source, 'module-main-authority.js').map(({ kind, specifier }) => ({ kind, specifier }));",
    'process.stdout.write(JSON.stringify(findings));',
  ].join('\n');
  return JSON.parse(
    execFileSync(process.execPath, ['--input-type=module', '--eval', program], {
      encoding: 'utf8',
    }),
  ) as unknown;
}

describe('packed JavaScript module.main CommonJS authority', () => {
  it('reports statically recognizable module.main loaders without promoting arbitrary object members', () => {
    const source = [
      "const direct = module.main.require('module-main-package');",
      "const element = module['main']['require']('module-main-element-package');",
      "const called = module.main.require.call(module.main, 'module-main-call-package');",
      'const object = { main: { require() {} } };',
      "const benign = object.main.require('not-commonjs');",
      'void [direct, element, called, benign];',
    ].join('\n');

    expect(scanWithRepositoryAuthority(source)).toEqual([
      { kind: 'commonjs-require', specifier: 'module-main-package' },
      { kind: 'commonjs-require', specifier: 'module-main-element-package' },
      { kind: 'commonjs-require', specifier: 'module-main-call-package' },
    ]);
  });
});
