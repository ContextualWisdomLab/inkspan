import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';

const repositoryRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const packageJson = JSON.parse(
  readFileSync(join(repositoryRoot, 'package.json'), 'utf8'),
);
const packageName = packageJson.name;
const verificationDirectory = mkdtempSync(
  join(repositoryRoot, '.text-position-selector-verification-'),
);

/** Execute one strict package-consumer verification command. */
function run(command, argumentsList) {
  return execFileSync(command, argumentsList, {
    cwd: repositoryRoot,
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'inherit'],
  });
}

try {
  const esmPackage = await import(packageName);
  assert.equal(
    esmPackage.TEXT_POSITION_PROJECTION_ID,
    'inkspan-prosemirror-text',
  );
  assert.equal(esmPackage.TEXT_POSITION_PROJECTION_VERSION, 1);
  assert.equal(typeof esmPackage.TextPositionSelectorEvidenceError, 'function');
  assert.equal(typeof esmPackage.createTextPositionSelector, 'function');

  const require = createRequire(import.meta.url);
  const commonJsPackage = require(packageName);
  assert.equal(
    commonJsPackage.TEXT_POSITION_PROJECTION_ID,
    'inkspan-prosemirror-text',
  );
  assert.equal(commonJsPackage.TEXT_POSITION_PROJECTION_VERSION, 1);
  assert.equal(
    typeof commonJsPackage.TextPositionSelectorEvidenceError,
    'function',
  );
  assert.equal(typeof commonJsPackage.createTextPositionSelector, 'function');

  const consumerPath = join(verificationDirectory, 'consumer.ts');
  writeFileSync(
    consumerPath,
    `import {
  TEXT_POSITION_PROJECTION_ID,
  TEXT_POSITION_PROJECTION_VERSION,
  TextPositionSelectorEvidenceError,
  type CwlEditorHandle,
  type CwlEditorTextPositionSelectorEvidence,
  type CwlEditorTextProjectionIdentity,
  type TextPositionSelectorEvidenceErrorCode,
} from '${packageName}';

declare const handle: CwlEditorHandle;
const captured: Promise<CwlEditorTextPositionSelectorEvidence | null> =
  handle.getTextPositionSelectorEvidence();
const projection: CwlEditorTextProjectionIdentity = {
  id: TEXT_POSITION_PROJECTION_ID,
  version: TEXT_POSITION_PROJECTION_VERSION,
};
const failureCode: TextPositionSelectorEvidenceErrorCode =
  'segmenter_unavailable';
const failure = new TextPositionSelectorEvidenceError(failureCode);
const checked: Promise<void> = captured.then((evidence) => {
  if (evidence === null) return;
  const start: number = evidence.selector.start;
  const end: number = evidence.selector.end;
  const tag: string = evidence.revision.strongEntityTag;
  void [start, end, tag, projection];
});
void [failure.code, checked];
`,
    'utf8',
  );

  run('pnpm', [
    'exec',
    'tsc',
    '--noEmit',
    '--strict',
    '--skipLibCheck',
    'false',
    '--module',
    'NodeNext',
    '--moduleResolution',
    'NodeNext',
    '--target',
    'ES2022',
    '--lib',
    'ES2022,DOM,DOM.Iterable',
    consumerPath,
  ]);

  console.log(
    `Verified ${packageName}: W3C text-position selector ESM, CommonJS, and strict TypeScript consumer contracts.`,
  );
} finally {
  rmSync(verificationDirectory, { recursive: true, force: true });
}
