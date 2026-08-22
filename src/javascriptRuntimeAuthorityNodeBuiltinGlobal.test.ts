import { execFileSync } from 'node:child_process';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';

import { describe, expect, it } from 'vitest';

function scanWithRepositoryAuthority(
  source: string,
  filename: string,
): unknown {
  const scannerUrl = pathToFileURL(
    resolve(process.cwd(), 'scripts/javascript-runtime-authority.mjs'),
  ).href;
  const program = [
    `import { findRuntimeModuleAuthority } from ${JSON.stringify(scannerUrl)};`,
    `const source = ${JSON.stringify(source)};`,
    `const findings = findRuntimeModuleAuthority(source, ${JSON.stringify(filename)}).map(({ kind, specifier }) => ({ kind, specifier }));`,
    'process.stdout.write(JSON.stringify(findings));',
  ].join('\n');
  return JSON.parse(
    execFileSync(process.execPath, ['--input-type=module', '--eval', program], {
      encoding: 'utf8',
    }),
  ) as unknown;
}

describe('Node global.process built-in runtime module authority', () => {
  it('reports exact ambient global.process loaders without promoting ordinary objects', () => {
    const source = [
      "const fs = global.process.getBuiltinModule('node:fs');",
      "const util = global['process']['getBuiltinModule']('node:util');",
      'const ordinaryGlobal = { process: { getBuiltinModule() { return "method-only"; } } };',
      'const benign = ordinaryGlobal.process.getBuiltinModule("node:crypto");',
      'void [fs, util, benign];',
    ].join('\n');

    expect(
      scanWithRepositoryAuthority(source, 'node-builtins-global-process.js'),
    ).toEqual([
      { kind: 'node-builtin-module', specifier: 'node:fs' },
      { kind: 'node-builtin-module', specifier: 'node:util' },
    ]);
  });

  it('proves the supported Node runtime exposes global.process as the ambient process', () => {
    const result = execFileSync(
      process.execPath,
      [
        '--eval',
        "const loaded = global.process.getBuiltinModule('node:path'); process.stdout.write(String(global.process === process && loaded === require('node:path')));",
      ],
      { encoding: 'utf8' },
    );

    expect(result).toBe('true');
  });
});
