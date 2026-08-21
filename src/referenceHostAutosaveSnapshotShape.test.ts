import { execFileSync } from 'node:child_process';
import { pathToFileURL } from 'node:url';
import { resolve } from 'node:path';

import { describe, expect, it } from 'vitest';

const fixturePath = resolve(
  process.cwd(),
  'examples/reference-host/autosave-view-model.mjs',
);

const baseSnapshotSource = `
  const validSnapshot = (state = 'idle', blockedReason = null) => ({
    state,
    blockedReason,
    activeStrongEntityTag: null,
    pendingStrongEntityTag: null,
    lastSavedStrongEntityTag: null,
  });
`;

describe('reference-host autosave snapshot shape', () => {
  it('rejects unknown authority-looking fields across enumerable, hidden, and symbol keys', () => {
    const moduleUrl = JSON.stringify(pathToFileURL(fixturePath).href);
    const script = `
      import { createAutosaveViewModel } from ${moduleUrl};
      ${baseSnapshotSource}

      function observeError(kind) {
        const candidate = validSnapshot();
        if (kind === 'enumerable') {
          candidate.authorization = 'owner';
        } else if (kind === 'hidden') {
          Object.defineProperty(candidate, 'authorization', {
            value: 'owner',
            enumerable: false,
          });
        } else {
          candidate[Symbol('authorization')] = 'owner';
        }
        try {
          createAutosaveViewModel().observe(candidate);
          return null;
        } catch (error) {
          return error instanceof Error ? error.message : 'unexpected error';
        }
      }

      process.stdout.write(JSON.stringify({
        enumerable: observeError('enumerable'),
        hidden: observeError('hidden'),
        symbol: observeError('symbol'),
      }));
    `;
    const output = execFileSync(
      process.execPath,
      ['--input-type=module', '--eval', script],
      { encoding: 'utf8' },
    );

    expect(JSON.parse(output)).toEqual({
      enumerable: 'autosave snapshot is invalid.',
      hidden: 'autosave snapshot is invalid.',
      symbol: 'autosave snapshot is invalid.',
    });
  });

  it('does not mutate retry presentation state when a malformed blocked snapshot is rejected', () => {
    const moduleUrl = JSON.stringify(pathToFileURL(fixturePath).href);
    const script = `
      import { createAutosaveViewModel } from ${moduleUrl};
      ${baseSnapshotSource}

      const viewModel = createAutosaveViewModel();
      const malformed = validSnapshot('blocked', 'conflict');
      malformed.authorization = 'owner';
      let malformedError = null;
      try {
        viewModel.observe(malformed);
      } catch (error) {
        malformedError = error instanceof Error ? error.message : 'unexpected error';
      }
      const afterRejected = viewModel.observe(validSnapshot('saving')).viewState;
      process.stdout.write(JSON.stringify({ afterRejected, malformedError }));
    `;
    const output = execFileSync(
      process.execPath,
      ['--input-type=module', '--eval', script],
      { encoding: 'utf8' },
    );

    expect(JSON.parse(output)).toEqual({
      afterRejected: 'saving',
      malformedError: 'autosave snapshot is invalid.',
    });
  });
});
