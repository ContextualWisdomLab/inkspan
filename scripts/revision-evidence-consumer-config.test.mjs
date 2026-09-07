import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import {
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
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

test('canonical containment detects a symlinked dependency that escapes the consumer tree', () => {
  const root = realpathSync(
    mkdtempSync(join(tmpdir(), 'inkspan-symlink-containment-')),
  );
  try {
    const consumer = join(root, 'consumer');
    const outside = join(root, 'outside');
    const linkedPackage = join(consumer, 'node_modules', 'example');
    mkdirSync(join(consumer, 'node_modules'), { recursive: true });
    mkdirSync(outside, { recursive: true });
    writeFileSync(join(outside, 'package.json'), '{}\n', 'utf8');
    symlinkSync(outside, linkedPackage, 'dir');

    assert.equal(relative(consumer, linkedPackage).startsWith('..'), false);
    assert.equal(
      relative(realpathSync(consumer), realpathSync(linkedPackage)).startsWith(
        '..',
      ),
      true,
    );
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test('generated ESM and CommonJS package checks canonicalize runtime resolution paths', () => {
  const verifierSource = readFileSync(
    new URL('./verify-revision-evidence-package.mjs', import.meta.url),
    'utf8',
  );

  assert.equal(
    verifierSource.includes("import { realpathSync } from 'node:fs';"),
    true,
  );
  assert.equal(
    verifierSource.includes('const consumerDirectory = realpathSync('),
    true,
  );
  assert.equal(
    verifierSource.includes(
      "const resolvedEntry = realpathSync(fileURLToPath(import.meta.resolve('",
    ),
    true,
  );
  assert.equal(
    verifierSource.includes(
      "const { realpathSync } = require('node:fs');",
    ),
    true,
  );
  assert.equal(
    verifierSource.includes(
      "const resolvedEntry = realpathSync(require.resolve('",
    ),
    true,
  );
});

function extractGeneratedRuntimeSource(verifierSource, functionName) {
  const functionStart = verifierSource.indexOf(`function ${functionName}`);
  assert.notEqual(functionStart, -1, `missing verifier function ${functionName}`);
  const writeStart = verifierSource.indexOf('writeFileSync(', functionStart);
  assert.notEqual(writeStart, -1, `missing writeFileSync in ${functionName}`);
  const templateStart = verifierSource.indexOf('`', writeStart);
  const templateEnd = verifierSource.indexOf("`,\n    'utf8',", templateStart);
  assert.notEqual(templateStart, -1, `missing generated source in ${functionName}`);
  assert.notEqual(templateEnd, -1, `missing generated source end in ${functionName}`);
  return verifierSource.slice(templateStart + 1, templateEnd);
}

function instantiateGeneratedRuntimeSource(
  generatedSource,
  { packageName, verificationDirectory, packageDirectory },
) {
  return generatedSource
    .replaceAll('${packageJson.name}', packageName)
    .replaceAll(
      '${JSON.stringify(verificationDirectory)}',
      JSON.stringify(verificationDirectory),
    )
    .replaceAll(
      '${JSON.stringify(packageDirectory)}',
      JSON.stringify(packageDirectory),
    );
}

test('generated ESM and CommonJS validators reject symlink escapes before package execution', () => {
  const root = realpathSync(
    mkdtempSync(join(tmpdir(), 'inkspan-generated-containment-')),
  );
  try {
    const consumer = join(root, 'consumer');
    const outside = join(root, 'outside-package');
    const linkedPackage = join(consumer, 'node_modules', 'example');
    const executionMarker = join(root, 'outside-package-executed');
    mkdirSync(join(consumer, 'node_modules'), { recursive: true });
    mkdirSync(outside, { recursive: true });
    writeFileSync(
      join(outside, 'package.json'),
      `${JSON.stringify({
        name: 'example',
        version: '1.0.0',
        type: 'module',
        exports: {
          '.': {
            import: './index.mjs',
            require: './index.cjs',
          },
        },
      })}\n`,
      'utf8',
    );
    writeFileSync(
      join(outside, 'index.mjs'),
      "import { writeFileSync } from 'node:fs';\nwriteFileSync(process.env.INKSPAN_ESCAPE_MARKER, 'esm');\nexport const sentinel = true;\n",
      'utf8',
    );
    writeFileSync(
      join(outside, 'index.cjs'),
      "const { writeFileSync } = require('node:fs');\nwriteFileSync(process.env.INKSPAN_ESCAPE_MARKER, 'cjs');\nmodule.exports = { sentinel: true };\n",
      'utf8',
    );
    symlinkSync(outside, linkedPackage, 'dir');

    const verifierSource = readFileSync(
      new URL('./verify-revision-evidence-package.mjs', import.meta.url),
      'utf8',
    );
    const cases = [
      {
        functionName: 'verifyRevisionEvidenceEsmRuntime',
        extension: 'mjs',
        expectedError: 'packed ESM entry escaped consumer tree',
      },
      {
        functionName: 'verifyRevisionEvidenceCommonJsRuntime',
        extension: 'cjs',
        expectedError: 'packed CommonJS entry escaped consumer tree',
      },
    ];

    for (const { functionName, extension, expectedError } of cases) {
      rmSync(executionMarker, { force: true });
      const generatedSource = instantiateGeneratedRuntimeSource(
        extractGeneratedRuntimeSource(verifierSource, functionName),
        {
          packageName: 'example',
          verificationDirectory: consumer,
          packageDirectory: linkedPackage,
        },
      );
      const scriptPath = join(consumer, `generated-containment.${extension}`);
      writeFileSync(scriptPath, generatedSource, 'utf8');
      const result = spawnSync(
        process.execPath,
        ['--preserve-symlinks', scriptPath],
        {
          cwd: consumer,
          encoding: 'utf8',
          env: {
            ...process.env,
            INKSPAN_ESCAPE_MARKER: executionMarker,
          },
        },
      );

      assert.notEqual(result.status, 0, `${extension} validator accepted escape`);
      assert.equal(
        result.stderr.includes(expectedError),
        true,
        `${extension} validator failed for the wrong reason: ${result.stderr}`,
      );
      assert.equal(
        existsSync(executionMarker),
        false,
        `${extension} validator executed the escaped package before rejection`,
      );
    }
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});
