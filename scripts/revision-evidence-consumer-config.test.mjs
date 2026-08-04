import assert from 'node:assert/strict';
import test from 'node:test';

import {
  createIndependentConsumerManifest,
  createTypeScriptVerificationArguments,
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
