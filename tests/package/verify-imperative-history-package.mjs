import { execFileSync } from 'node:child_process';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const repositoryRoot = resolve(
  dirname(fileURLToPath(import.meta.url)),
  '..',
  '..',
);
const verificationDirectory = mkdtempSync(
  join(repositoryRoot, '.history-package-verification-'),
);

try {
  const consumerPath = join(verificationDirectory, 'consumer.ts');
  writeFileSync(
    consumerPath,
    `import type { CwlEditorHandle } from '@contextualwisdomlab/cwl-editor';

declare const editorHandle: CwlEditorHandle;

const undoAvailable: boolean = editorHandle.canUndo();
const undoExecuted: boolean = editorHandle.undo();
const redoAvailable: boolean = editorHandle.canRedo();
const redoExecuted: boolean = editorHandle.redo();

void [undoAvailable, undoExecuted, redoAvailable, redoExecuted];
`,
    'utf8',
  );

  execFileSync(
    'pnpm',
    [
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
    ],
    {
      cwd: repositoryRoot,
      stdio: 'inherit',
    },
  );

  console.log('Verified imperative history methods through public package declarations.');
} finally {
  rmSync(verificationDirectory, { recursive: true, force: true });
}
