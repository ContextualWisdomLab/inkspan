import { describe, expect, it } from 'vitest';

import { findRuntimeModuleAuthority } from '../scripts/javascript-runtime-authority.mjs';

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

    expect(
      findRuntimeModuleAuthority(source, 'node-builtins.js').map(
        ({ kind, specifier }) => ({ kind, specifier }),
      ),
    ).toEqual([
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
      findRuntimeModuleAuthority(source, 'node-builtins-comma-indirect.js').map(
        ({ kind, specifier }) => ({ kind, specifier }),
      ),
    ).toEqual([
      { kind: 'node-builtin-module', specifier: 'node:fs' },
      { kind: 'node-builtin-module', specifier: 'node:path' },
      { kind: 'node-builtin-module', specifier: undefined },
      { kind: 'node-builtin-module', specifier: 'node:util' },
    ]);
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
      findRuntimeModuleAuthority(source, 'node-builtins-indirect.js').map(
        ({ kind, specifier }) => ({ kind, specifier }),
      ),
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

    expect(
      findRuntimeModuleAuthority(source, 'node-builtins-bind.js').map(
        ({ kind, specifier }) => ({ kind, specifier }),
      ),
    ).toEqual([
      { kind: 'node-builtin-module', specifier: 'node:fs' },
      { kind: 'node-builtin-module', specifier: undefined },
      { kind: 'node-builtin-module', specifier: 'node:path' },
      { kind: 'node-builtin-module', specifier: undefined },
    ]);
  });
});
