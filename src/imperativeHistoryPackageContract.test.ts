import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

import { describe, expect, it } from 'vitest';

const verifier = readFileSync(
  resolve(process.cwd(), 'tests/package/verify-package.mjs'),
  'utf8',
);

describe('imperative history packed-package contract', () => {
  it('compiles every public history operation through the strict packed consumer', () => {
    expect(verifier).toContain('editorHandle.canUndo()');
    expect(verifier).toContain('editorHandle.undo()');
    expect(verifier).toContain('editorHandle.canRedo()');
    expect(verifier).toContain('editorHandle.redo()');
  });
});
