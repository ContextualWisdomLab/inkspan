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

  it('redacts ambiguous provider connect failures and requires provider replacement', () => {
    if (!existsSync(fixturePath)) return;
    const moduleUrl = JSON.stringify(pathToFileURL(fixturePath).href);
    const script = `
      import { createHostCollaborationLifecycle } from ${moduleUrl};
      const privateCause = 'private provider connect cause';
      const events = [];
      let providerGeneration = 0;
      const lifecycle = createHostCollaborationLifecycle({
        documentFactory() {
          return { destroy() { events.push('document:destroy'); } };
        },
        providerFactory() {
          providerGeneration += 1;
          const generation = providerGeneration;
          events.push('provider:create:' + generation);
          return {
            connect() {
              events.push('provider:connect:' + generation);
              if (generation === 1) throw new Error(privateCause);
            },
            disconnect() { events.push('provider:disconnect:' + generation); },
            destroy() { events.push('provider:destroy:' + generation); },
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
      let retryError = null;
      try {
        lifecycle.connect();
      } catch (failure) {
        retryError = failure instanceof Error ? failure.message : 'unexpected error';
      }
      const recovered = lifecycle.reconnect();
      lifecycle.dispose();
      process.stdout.write(JSON.stringify({
        afterFailure,
        error,
        events,
        leakedPrivateCause:
          (typeof error === 'string' && error.includes(privateCause)) ||
          (typeof retryError === 'string' && retryError.includes(privateCause)),
        recovered,
        retryError,
      }));
    `;
    const output = execFileSync(
      process.execPath,
      ['--input-type=module', '--eval', script],
      { encoding: 'utf8' },
    );

    expect(JSON.parse(output)).toEqual({
      afterFailure: { providerGeneration: 1, status: 'disconnected' },
      error: 'collaboration lifecycle connection failed.',
      events: [
        'provider:create:1',
        'provider:connect:1',
        'provider:disconnect:1',
        'provider:destroy:1',
        'provider:create:2',
        'provider:connect:2',
        'provider:disconnect:2',
        'provider:destroy:2',
        'document:destroy',
      ],
      leakedPrivateCause: false,
      recovered: { providerGeneration: 2, status: 'connected' },
      retryError: 'collaboration lifecycle connection failed.',
    });
  });
});
