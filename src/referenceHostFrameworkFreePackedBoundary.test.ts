import { execFileSync } from 'node:child_process';
import {
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  readdirSync,
  renameSync,
  rmSync,
  writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';

import { afterAll, beforeAll, describe, expect, it } from 'vitest';

const repositoryRoot = process.cwd();
const packageMetadata = JSON.parse(
  readFileSync(resolve(repositoryRoot, 'package.json'), 'utf8'),
) as { name: string; version: string };

const temporaryRoot = mkdtempSync(
  join(tmpdir(), 'inkspan-reference-host-framework-free-'),
);
const extractionDirectory = join(temporaryRoot, 'extracted');
const consumerDirectory = join(temporaryRoot, 'consumer');
const packageDirectory = join(
  consumerDirectory,
  'node_modules',
  ...packageMetadata.name.split('/'),
);

function run(command: string, argumentsList: string[], cwd = repositoryRoot) {
  return execFileSync(command, argumentsList, {
    cwd,
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'pipe'],
    timeout: 180_000,
  });
}

beforeAll(
  () => {
    run('pnpm', ['build']);
    mkdirSync(extractionDirectory, { recursive: true });
    mkdirSync(dirname(packageDirectory), { recursive: true });

    const packResult = JSON.parse(
      run('npm', [
        'pack',
        '--json',
        '--ignore-scripts',
        '--pack-destination',
        temporaryRoot,
      ]),
    ) as Array<{ filename: string; name: string; version: string }>;

    expect(packResult).toHaveLength(1);
    expect(packResult[0]?.name).toBe(packageMetadata.name);
    expect(packResult[0]?.version).toBe(packageMetadata.version);

    const tarballPath = join(temporaryRoot, packResult[0]!.filename);
    expect(existsSync(tarballPath)).toBe(true);
    run('tar', ['-xzf', tarballPath, '-C', extractionDirectory]);
    renameSync(join(extractionDirectory, 'package'), packageDirectory);
    writeFileSync(
      join(consumerDirectory, 'package.json'),
      '{"name":"inkspan-reference-host-framework-free-consumer","private":true,"type":"module"}\n',
      'utf8',
    );
  },
  180_000,
);

afterAll(() => {
  rmSync(temporaryRoot, { recursive: true, force: true });
});

describe('reference-host framework-free packed package boundary', () => {
  it('contains no installed framework or editor dependency beside the exact packed Inkspan artifact', () => {
    expect(readdirSync(join(consumerDirectory, 'node_modules'))).toEqual([
      '@contextualwisdomlab',
    ]);
    expect(
      readdirSync(join(consumerDirectory, 'node_modules', '@contextualwisdomlab')),
    ).toEqual(['cwl-editor']);
  });

  it('executes the packed autosave, converter, and Markdown ESM subpaths without React, TipTap, Yjs, browser, network, credential, or model dependencies', () => {
    const consumerPath = join(consumerDirectory, 'consumer.mjs');
    writeFileSync(
      consumerPath,
      `import assert from 'node:assert/strict';
Object.defineProperty(globalThis, 'document', {
  configurable: true,
  get() { throw new Error('browser document authority is forbidden'); },
});
Object.defineProperty(globalThis, 'window', {
  configurable: true,
  get() { throw new Error('browser window authority is forbidden'); },
});
globalThis.fetch = () => { throw new Error('network authority is forbidden'); };

const autosave = await import('${packageMetadata.name}/autosave');
const converter = await import('${packageMetadata.name}/converter');
const markdown = await import('${packageMetadata.name}/markdown');

assert.equal(typeof autosave.createDocumentAutosaveQueue, 'function');
assert.deepEqual(
  Array.from(converter.dataUriToBytes('data:text/plain;base64,SGk=').bytes),
  [72, 105],
);
assert.equal(markdown.markdownToPlainText('# Buyer boundary'), 'Buyer boundary');
assert.equal(
  markdown.markdownToHtml('**Buyer boundary**'),
  markdown.markdownToHtml('**Buyer boundary**'),
);

for (const specifier of ['autosave', 'converter', 'markdown']) {
  const resolved = import.meta.resolve(\`${packageMetadata.name}/\${specifier}\`);
  assert.match(resolved, /\\/dist\\/cwl-(?:autosave|converter|markdown)\\.js$/u);
}
`,
      'utf8',
    );

    expect(() => run(process.execPath, [consumerPath], consumerDirectory)).not.toThrow();
  });

  it('executes the same packed CommonJS subpaths without installing framework dependencies', () => {
    const consumerPath = join(consumerDirectory, 'consumer.cjs');
    writeFileSync(
      consumerPath,
      `const assert = require('node:assert/strict');
Object.defineProperty(globalThis, 'document', {
  configurable: true,
  get() { throw new Error('browser document authority is forbidden'); },
});
Object.defineProperty(globalThis, 'window', {
  configurable: true,
  get() { throw new Error('browser window authority is forbidden'); },
});
globalThis.fetch = () => { throw new Error('network authority is forbidden'); };

const autosave = require('${packageMetadata.name}/autosave');
const converter = require('${packageMetadata.name}/converter');
const markdown = require('${packageMetadata.name}/markdown');

assert.equal(typeof autosave.createDocumentAutosaveQueue, 'function');
assert.deepEqual(
  Array.from(converter.dataUriToBytes('data:text/plain;base64,T0s=').bytes),
  [79, 75],
);
assert.equal(markdown.markdownToPlainText('# Buyer boundary'), 'Buyer boundary');
for (const specifier of ['autosave', 'converter', 'markdown']) {
  assert.match(
    require.resolve(\`${packageMetadata.name}/\${specifier}\`),
    /\\/dist\\/cwl-(?:autosave|converter|markdown)\\.cjs$/u,
  );
}
`,
      'utf8',
    );

    expect(() => run(process.execPath, [consumerPath], consumerDirectory)).not.toThrow();
  });
});
