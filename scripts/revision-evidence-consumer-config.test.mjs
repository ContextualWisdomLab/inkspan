import assert from 'node:assert/strict';
import {
  existsSync,
  mkdirSync,
  mkdtempSync,
  realpathSync,
  rmSync,
  symlinkSync,
  writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import { join, relative } from 'node:path';
import test from 'node:test';

import {
  createIndependentConsumerManifest,
  createTypeScriptVerificationArguments,
  stageLockedNodeModules,
} from './revision-evidence-consumer-config.mjs';

test('pins the isolated TypeScript compiler in the consumer manifest', () => {
  const manifest = createIndependentConsumerManifest({
    packageName: '@contextualwisdomlab/cwl-editor',
    packageManager: 'pnpm@11.5.3',
    tarballFileName: 'contextualwisdomlab-cwl-editor-0.5.26.tgz',
    exactRuntimeDependencies: { react: '18.3.1' },
    exactTypeDependencies: { '@types/react': '18.3.18' },
    exactTypeScriptVersion: '5.7.3',
  });

  assert.deepEqual(manifest.devDependencies, {
    '@types/react': '18.3.18',
    typescript: '5.7.3',
  });
  assert.equal(
    manifest.dependencies['@contextualwisdomlab/cwl-editor'],
    'file:./contextualwisdomlab-cwl-editor-0.5.26.tgz',
  );
});

test('scopes TypeScript execution to the independent consumer directory', () => {
  const argumentsList = createTypeScriptVerificationArguments(
    '/tmp/inkspan-revision-evidence-consumer',
    '/tmp/inkspan-revision-evidence-consumer/consumer.ts',
  );

  assert.deepEqual(argumentsList.slice(0, 4), [
    '--dir',
    '/tmp/inkspan-revision-evidence-consumer',
    'exec',
    'tsc',
  ]);
  assert.equal(
    argumentsList.at(-1),
    '/tmp/inkspan-revision-evidence-consumer/consumer.ts',
  );
});

test('copies the locked pnpm dependency tree into the independent consumer', () => {
  const root = mkdtempSync(join(tmpdir(), 'inkspan-node-modules-stage-'));
  try {
    const sourceNodeModules = join(root, 'source', 'node_modules');
    const targetNodeModules = join(root, 'consumer', 'node_modules');
    const packageRoot = join(
      sourceNodeModules,
      '.pnpm',
      'example@1.0.0',
      'node_modules',
      'example',
    );
    mkdirSync(packageRoot, { recursive: true });
    writeFileSync(
      join(packageRoot, 'package.json'),
      '{"name":"example","version":"1.0.0"}\n',
      'utf8',
    );
    symlinkSync(
      join('.pnpm', 'example@1.0.0', 'node_modules', 'example'),
      join(sourceNodeModules, 'example'),
    );

    stageLockedNodeModules(sourceNodeModules, targetNodeModules);

    assert.equal(
      existsSync(join(targetNodeModules, 'example', 'package.json')),
      true,
    );
    const stagedPackage = realpathSync(join(targetNodeModules, 'example'));
    assert.equal(relative(targetNodeModules, stagedPackage).startsWith('..'), false);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});
