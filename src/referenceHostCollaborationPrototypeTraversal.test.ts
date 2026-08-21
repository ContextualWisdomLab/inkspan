import { execFileSync } from 'node:child_process';
import { pathToFileURL } from 'node:url';
import { resolve } from 'node:path';

import { describe, expect, it } from 'vitest';

const fixturePath = resolve(
  process.cwd(),
  'examples/reference-host/collaboration-provider-lifecycle.mjs',
);

describe('reference-host collaboration prototype traversal', () => {
  it('bounds hostile resource prototype traversal before caller-controlled work can continue indefinitely', () => {
    const fixtureUrl = JSON.stringify(pathToFileURL(fixturePath).href);
    const script = `
      import { createHostCollaborationLifecycle } from ${fixtureUrl};
      const privateCause = 'private prototype traversal cause';
      let prototypeReads = 0;
      let hostileDocument;
      hostileDocument = new Proxy({}, {
        getPrototypeOf() {
          prototypeReads += 1;
          if (prototypeReads > 64) throw new Error(privateCause);
          return hostileDocument;
        },
      });
      let error = null;
      try {
        createHostCollaborationLifecycle({
          documentFactory() { return hostileDocument; },
          providerFactory() {
            return { connect() {}, disconnect() {}, destroy() {} };
          },
          roomId: 'reference-room',
          actorId: 'reference-actor',
        });
      } catch (failure) {
        error = failure instanceof Error ? failure.message : 'unexpected error';
      }
      process.stdout.write(JSON.stringify({
        error,
        leakedPrivateCause: typeof error === 'string' && error.includes(privateCause),
        prototypeReads,
      }));
    `;
    const output = execFileSync(
      process.execPath,
      ['--input-type=module', '--eval', script],
      { encoding: 'utf8' },
    );

    expect(JSON.parse(output)).toEqual({
      error: 'documentFactory returned an invalid document.',
      leakedPrivateCause: false,
      prototypeReads: 64,
    });
  });
});
