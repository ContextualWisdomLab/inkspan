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
    "const findings = findRuntimeModuleAuthority(source, 'reflect-construct-authority.js').map(({ kind, specifier }) => ({ kind, specifier }));",
    'process.stdout.write(JSON.stringify(findings));',
  ].join('\n');
  return JSON.parse(
    execFileSync(process.execPath, ['--input-type=module', '--eval', program], {
      encoding: 'utf8',
    }),
  ) as unknown;
}

describe('packed JavaScript Reflect.construct CommonJS authority', () => {
  it('reports statically recognizable CommonJS loaders and resolvers used as constructors', () => {
    const source = [
      "Reflect.construct(require, ['reflect-package']);",
      "Reflect['construct'](require.resolve, ['reflect-resolve-package']);",
      'Reflect.construct((0, require), [runtimePackageName]);',
      "Reflect.construct(require.bind(undefined, 'bound-reflect-package'), []);",
      'const object = { construct() { return {}; } };',
      "object.construct(require, ['not-reflect']);",
    ].join('\n');

    expect(scanWithRepositoryAuthority(source)).toEqual([
      { kind: 'commonjs-require', specifier: 'reflect-package' },
      { kind: 'commonjs-resolve', specifier: 'reflect-resolve-package' },
      { kind: 'commonjs-require', specifier: undefined },
      { kind: 'commonjs-require', specifier: 'bound-reflect-package' },
    ]);
  });

  it('proves the supported Node CommonJS require function is constructible through Reflect.construct', () => {
    const result = execFileSync(
      process.execPath,
      [
        '--eval',
        "const loaded = Reflect.construct(require, ['node:path']); process.stdout.write(String(loaded === require('node:path')));",
      ],
      { encoding: 'utf8' },
    );

    expect(result).toBe('true');
  });
});
