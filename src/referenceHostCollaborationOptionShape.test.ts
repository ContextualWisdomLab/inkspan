import { execFileSync } from 'node:child_process';
import { pathToFileURL } from 'node:url';
import { resolve } from 'node:path';

import { describe, expect, it } from 'vitest';

const fixturePath = resolve(
  process.cwd(),
  'examples/reference-host/collaboration-provider-lifecycle.mjs',
);

describe('reference-host collaboration option shape', () => {
  it('rejects unknown authority-looking option fields before invoking host factories', () => {
    const moduleUrl = JSON.stringify(pathToFileURL(fixturePath).href);
    const script = `
      import { createHostCollaborationLifecycle } from ${moduleUrl};

      function run(kind) {
        let documentFactoryCalls = 0;
        let providerFactoryCalls = 0;
        const options = {
          documentFactory() {
            documentFactoryCalls += 1;
            return { destroy() {} };
          },
          providerFactory() {
            providerFactoryCalls += 1;
            return { connect() {}, disconnect() {}, destroy() {} };
          },
          roomId: 'reference-room',
          actorId: 'reference-actor',
        };

        if (kind === 'enumerable') {
          options.authorization = 'owner';
        } else if (kind === 'hidden') {
          Object.defineProperty(options, 'authorization', {
            value: 'owner',
            enumerable: false,
          });
        } else {
          options[Symbol('authorization')] = 'owner';
        }

        let error = null;
        try {
          const lifecycle = createHostCollaborationLifecycle(options);
          lifecycle.dispose();
        } catch (failure) {
          error = failure instanceof Error ? failure.message : 'unexpected error';
        }
        return { documentFactoryCalls, error, providerFactoryCalls };
      }

      process.stdout.write(JSON.stringify({
        enumerable: run('enumerable'),
        hidden: run('hidden'),
        symbol: run('symbol'),
      }));
    `;
    const output = execFileSync(
      process.execPath,
      ['--input-type=module', '--eval', script],
      { encoding: 'utf8' },
    );

    const rejected = {
      documentFactoryCalls: 0,
      error: 'collaboration options are invalid.',
      providerFactoryCalls: 0,
    };
    expect(JSON.parse(output)).toEqual({
      enumerable: rejected,
      hidden: rejected,
      symbol: rejected,
    });
  });
});
