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
  pruneTopLevelConsumerDependencies,
  stageLockedConsumerDependencies,
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
    assert.equal(
      relative(realpathSync(targetNodeModules), stagedPackage).startsWith('..'),
      false,
    );
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test('stages only the declared direct dependency closure', () => {
  const root = mkdtempSync(join(tmpdir(), 'inkspan-node-modules-isolated-'));
  try {
    const sourceNodeModules = join(root, 'source', 'node_modules');
    const targetNodeModules = join(root, 'consumer', 'node_modules');
    const createLinkedPackage = (packageName, virtualStoreName) => {
      const packageSegments = packageName.split('/');
      const packageRoot = join(
        sourceNodeModules,
        '.pnpm',
        virtualStoreName,
        'node_modules',
        ...packageSegments,
      );
      mkdirSync(packageRoot, { recursive: true });
      writeFileSync(
        join(packageRoot, 'package.json'),
        `${JSON.stringify({ name: packageName, version: '1.0.0' })}\n`,
        'utf8',
      );
      const topLevelPackage = join(sourceNodeModules, ...packageSegments);
      mkdirSync(join(topLevelPackage, '..'), { recursive: true });
      symlinkSync(
        relative(join(topLevelPackage, '..'), packageRoot),
        topLevelPackage,
      );
    };

    createLinkedPackage('example', 'example@1.0.0');
    createLinkedPackage('undeclared-package', 'undeclared-package@1.0.0');

    stageLockedConsumerDependencies(
      sourceNodeModules,
      targetNodeModules,
      ['example'],
    );

    assert.equal(existsSync(join(targetNodeModules, 'example')), true);
    assert.equal(
      existsSync(join(targetNodeModules, 'undeclared-package')),
      false,
    );
    assert.equal(existsSync(join(targetNodeModules, '.pnpm')), true);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test('exposes only declared direct dependencies from the staged lockfile tree', () => {
  const root = mkdtempSync(join(tmpdir(), 'inkspan-node-modules-prune-'));
  try {
    const sourceNodeModules = join(root, 'source', 'node_modules');
    const targetNodeModules = join(root, 'consumer', 'node_modules');
    const createLinkedPackage = (packageName, virtualStoreName) => {
      const packageSegments = packageName.split('/');
      const packageRoot = join(
        sourceNodeModules,
        '.pnpm',
        virtualStoreName,
        'node_modules',
        ...packageSegments,
      );
      mkdirSync(packageRoot, { recursive: true });
      writeFileSync(
        join(packageRoot, 'package.json'),
        `${JSON.stringify({ name: packageName, version: '1.0.0' })}\n`,
        'utf8',
      );
      const topLevelPackage = join(sourceNodeModules, ...packageSegments);
      mkdirSync(join(topLevelPackage, '..'), { recursive: true });
      const linkTarget = relative(
        join(topLevelPackage, '..'),
        packageRoot,
      );
      symlinkSync(linkTarget, topLevelPackage);
    };

    createLinkedPackage('example', 'example@1.0.0');
    createLinkedPackage('vitest', 'vitest@3.2.7');
    createLinkedPackage('@types/react', '@types+react@18.3.31');
    createLinkedPackage(
      '@testing-library/react',
      '@testing-library+react@16.3.2',
    );
    mkdirSync(join(sourceNodeModules, '.bin'), { recursive: true });
    writeFileSync(join(sourceNodeModules, '.modules.yaml'), 'layoutVersion: 5\n');

    stageLockedNodeModules(sourceNodeModules, targetNodeModules);
    pruneTopLevelConsumerDependencies(targetNodeModules, [
      'example',
      '@types/react',
    ]);

    assert.equal(existsSync(join(targetNodeModules, 'example')), true);
    assert.equal(existsSync(join(targetNodeModules, '@types', 'react')), true);
    assert.equal(existsSync(join(targetNodeModules, 'vitest')), false);
    assert.equal(existsSync(join(targetNodeModules, '@testing-library')), false);
    assert.equal(existsSync(join(targetNodeModules, '.pnpm')), true);
    assert.equal(existsSync(join(targetNodeModules, '.bin')), true);
    assert.equal(existsSync(join(targetNodeModules, '.modules.yaml')), true);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});
