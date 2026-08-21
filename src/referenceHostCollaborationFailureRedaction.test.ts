import { execFileSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import { pathToFileURL } from 'node:url';
import { resolve } from 'node:path';

import { describe, expect, it } from 'vitest';

const fixturePath = resolve(
  process.cwd(),
  'examples/reference-host/collaboration-provider-lifecycle.mjs',
);

describe('reference-host collaboration callback failure redaction', () => {
  it('redacts document factory failures at initialization', () => {
    if (!existsSync(fixturePath)) return;
    const moduleUrl = JSON.stringify(pathToFileURL(fixturePath).href);
    const script = `
      import { createHostCollaborationLifecycle } from ${moduleUrl};
      const privateCause = 'private document factory cause';
      let error = null;
      try {
        createHostCollaborationLifecycle({
          documentFactory() { throw new Error(privateCause); },
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
      }));
    `;
    const output = execFileSync(
      process.execPath,
      ['--input-type=module', '--eval', script],
      { encoding: 'utf8' },
    );

    expect(JSON.parse(output)).toEqual({
      error: 'collaboration lifecycle initialization failed.',
      leakedPrivateCause: false,
    });
  });

  it('redacts transient provider connect failures and permits an explicit retry', () => {
    if (!existsSync(fixturePath)) return;
    const moduleUrl = JSON.stringify(pathToFileURL(fixturePath).href);
    const script = `
      import { createHostCollaborationLifecycle } from ${moduleUrl};
      const privateCause = 'private provider connect cause';
      const events = [];
      let connectAttempts = 0;
      const lifecycle = createHostCollaborationLifecycle({
        documentFactory() {
          return { destroy() { events.push('document:destroy'); } };
        },
        providerFactory() {
          return {
            connect() {
              connectAttempts += 1;
              events.push('provider:connect:' + connectAttempts);
              if (connectAttempts === 1) throw new Error(privateCause);
            },
            disconnect() { events.push('provider:disconnect'); },
            destroy() { events.push('provider:destroy'); },
          };
        },
        roomId: 'reference-room',
        actorId: 'reference-actor',
      });
      let error = null;
      try {
        lifecycle.connect();
      } catch (failure) {
        error = failure instanceof Error ? failure.message : 'unexpected error';
      }
      const afterFailure = lifecycle.getSnapshot();
      const retryResult = lifecycle.connect();
      const afterRetry = lifecycle.getSnapshot();
      lifecycle.dispose();
      process.stdout.write(JSON.stringify({
        afterFailure,
        afterRetry,
        error,
        events,
        leakedPrivateCause: typeof error === 'string' && error.includes(privateCause),
        retryResult,
      }));
    `;
    const output = execFileSync(
      process.execPath,
      ['--input-type=module', '--eval', script],
      { encoding: 'utf8' },
    );

    expect(JSON.parse(output)).toEqual({
      afterFailure: { providerGeneration: 1, status: 'disconnected' },
      afterRetry: { providerGeneration: 1, status: 'connected' },
      error: 'collaboration lifecycle connection failed.',
      events: [
        'provider:connect:1',
        'provider:connect:2',
        'provider:disconnect',
        'provider:destroy',
        'document:destroy',
      ],
      leakedPrivateCause: false,
      retryResult: true,
    });
  });
});
