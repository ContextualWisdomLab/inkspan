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

describe('Node built-in runtime module authority', () => {
  it('reports statically recognizable process.getBuiltinModule calls', () => {
    const source = [
      "const fs = process.getBuiltinModule('node:fs');",
      "const path = globalThis.process.getBuiltinModule('node:path');",
      'const unknown = process.getBuiltinModule(runtimeBuiltinName);',
      'const object = { getBuiltinModule() { return "method-only"; } };',
      'const benign = object.getBuiltinModule("node:crypto");',
      'void [fs, path, unknown, benign];',
    ].join('\n');

    expect(scanWithRepositoryAuthority(source, 'node-builtins.js')).toEqual([
      { kind: 'node-builtin-module', specifier: 'node:fs' },
      { kind: 'node-builtin-module', specifier: 'node:path' },
      { kind: 'node-builtin-module', specifier: undefined },
    ]);
  });

  it('reports comma-indirected ambient built-in loaders without promoting ordinary object methods', () => {
    const source = [
      "const fs = (0, process.getBuiltinModule)('node:fs');",
      "const path = (0, globalThis.process.getBuiltinModule)('node:path');",
      'const unknown = (0, process.getBuiltinModule)(runtimeBuiltinName);',
      "const util = (0, globalThis['process']['getBuiltinModule'])('node:util');",
      'const object = { getBuiltinModule() { return "method-only"; } };',
      'const benign = (0, object.getBuiltinModule)("node:crypto");',
      'void [fs, path, unknown, util, benign];',
    ].join('\n');

    expect(
      scanWithRepositoryAuthority(source, 'node-builtins-comma-indirect.js'),
    ).toEqual([
      { kind: 'node-builtin-module', specifier: 'node:fs' },
      { kind: 'node-builtin-module', specifier: 'node:path' },
      { kind: 'node-builtin-module', specifier: undefined },
      { kind: 'node-builtin-module', specifier: 'node:util' },
    ]);
  });

  it('proves the supported Node runtime can load through comma indirection', () => {
    const result = execFileSync(
      process.execPath,
      [
        '--eval',
        "const loaded = (0, process.getBuiltinModule)('node:path'); process.stdout.write(String(loaded === require('node:path')));",
      ],
      { encoding: 'utf8' },
    );

    expect(result).toBe('true');
  });

  it('reports Function.prototype call/apply and Reflect.apply invocation of the ambient loader', () => {
    const source = [
      "const fs = process.getBuiltinModule.call(undefined, 'node:fs');",
      'const path = globalThis.process.getBuiltinModule.call(null, runtimeBuiltinName);',
      "const util = process['getBuiltinModule']['call'](undefined, 'node:util');",
      "const os = globalThis['process']['getBuiltinModule'].call(null, 'node:os');",
      "const crypto = process.getBuiltinModule.apply(undefined, ['node:crypto']);",
      'const unknownApply = globalThis.process.getBuiltinModule.apply(null, [runtimeBuiltinName]);',
      "const url = Reflect.apply(process.getBuiltinModule, undefined, ['node:url']);",
      'const unknownReflect = Reflect.apply(globalThis.process.getBuiltinModule, null, runtimeBuiltinArgs);',
      'const object = { getBuiltinModule() { return "method-only"; } };',
      'const benignCall = object.getBuiltinModule.call(null, "node:buffer");',
      'const benignApply = object.getBuiltinModule.apply(null, ["node:assert"]);',
      'const benignReflect = Reflect.apply(object.getBuiltinModule, null, ["node:zlib"]);',
      'void [fs, path, util, os, crypto, unknownApply, url, unknownReflect, benignCall, benignApply, benignReflect];',
    ].join('\n');

    expect(
      scanWithRepositoryAuthority(source, 'node-builtins-indirect.js'),
    ).toEqual([
      { kind: 'node-builtin-module', specifier: 'node:fs' },
      { kind: 'node-builtin-module', specifier: undefined },
      { kind: 'node-builtin-module', specifier: 'node:util' },
      { kind: 'node-builtin-module', specifier: 'node:os' },
      { kind: 'node-builtin-module', specifier: 'node:crypto' },
      { kind: 'node-builtin-module', specifier: undefined },
      { kind: 'node-builtin-module', specifier: 'node:url' },
      { kind: 'node-builtin-module', specifier: undefined },
    ]);
  });

  it('reports retained and immediately invoked bound ambient loaders', () => {
    const source = [
      "const fsLoader = process.getBuiltinModule.bind(undefined, 'node:fs');",
      'const unknownLoader = globalThis.process.getBuiltinModule.bind(null, runtimeBuiltinName);',
      "const path = process.getBuiltinModule.bind(undefined)('node:path');",
      'const unknown = globalThis.process.getBuiltinModule.bind(null)(runtimeBuiltinName);',
      'const object = { getBuiltinModule() { return "method-only"; } };',
      'const benign = object.getBuiltinModule.bind(null, "node:crypto");',
      'void [fsLoader, unknownLoader, path, unknown, benign];',
    ].join('\n');

    expect(scanWithRepositoryAuthority(source, 'node-builtins-bind.js')).toEqual([
      { kind: 'node-builtin-module', specifier: 'node:fs' },
      { kind: 'node-builtin-module', specifier: undefined },
      { kind: 'node-builtin-module', specifier: 'node:path' },
      { kind: 'node-builtin-module', specifier: undefined },
    ]);
  });
});
