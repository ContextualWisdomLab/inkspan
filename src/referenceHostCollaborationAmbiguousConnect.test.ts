import { execFileSync } from 'node:child_process';
import { pathToFileURL } from 'node:url';
import { resolve } from 'node:path';

import { describe, expect, it } from 'vitest';

const fixturePath = resolve(
  process.cwd(),
  'examples/reference-host/collaboration-provider-lifecycle.mjs',
);

describe('reference-host ambiguous collaboration connect contract', () => {
  it('quarantines a provider after connect throws instead of retrying an indeterminate resource', () => {
    const moduleUrl = JSON.stringify(pathToFileURL(fixturePath).href);
    const script = `
      import { createHostCollaborationLifecycle } from ${moduleUrl};
      const events = [];
      let generation = 0;
      let firstProviderConnectAttempts = 0;
      const lifecycle = createHostCollaborationLifecycle({
        documentFactory() {
          return {
            destroy() { events.push('document:destroy'); },
          };
        },
        providerFactory() {
          generation += 1;
          const current = generation;
          events.push('provider:create:' + current);
          return {
            connect() {
              events.push('provider:connect:' + current);
              if (current === 1) {
                firstProviderConnectAttempts += 1;
                if (firstProviderConnectAttempts === 1) {
                  throw new Error('private ambiguous connect failure');
                }
              }
            },
            disconnect() { events.push('provider:disconnect:' + current); },
            destroy() { events.push('provider:destroy:' + current); },
          };
        },
        roomId: 'reference-room',
        actorId: 'reference-actor',
      });

      let firstError = null;
      try {
        lifecycle.connect();
      } catch (error) {
        firstError = error instanceof Error ? error.message : 'unexpected error';
      }

      let retryError = null;
      let retryResult = null;
      try {
        retryResult = lifecycle.connect();
      } catch (error) {
        retryError = error instanceof Error ? error.message : 'unexpected error';
      }

      const afterFailure = lifecycle.getSnapshot();
      const recovered = lifecycle.reconnect();
      const disposeResult = lifecycle.dispose();
      process.stdout.write(JSON.stringify({
        afterFailure,
        disposeResult,
        events,
        firstError,
        recovered,
        retryError,
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
      disposeResult: true,
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
      firstError: 'collaboration lifecycle connection failed.',
      recovered: { providerGeneration: 2, status: 'connected' },
      retryError: 'collaboration lifecycle connection failed.',
      retryResult: null,
    });
  });

  it('quarantines promise-returning connect attempts without false success or unhandled rejection', () => {
    const moduleUrl = JSON.stringify(pathToFileURL(fixturePath).href);
    const script = `
      import { createHostCollaborationLifecycle } from ${moduleUrl};
      const events = [];
      let generation = 0;
      let unhandledRejections = 0;
      process.on('unhandledRejection', () => {
        unhandledRejections += 1;
      });

      const lifecycle = createHostCollaborationLifecycle({
        documentFactory() {
          return {
            destroy() { events.push('document:destroy'); },
          };
        },
        providerFactory() {
          generation += 1;
          const current = generation;
          events.push('provider:create:' + current);
          return {
            connect() {
              events.push('provider:connect:' + current);
              if (current === 1) {
                return Promise.reject(new Error('private asynchronous connect failure'));
              }
            },
            disconnect() { events.push('provider:disconnect:' + current); },
            destroy() { events.push('provider:destroy:' + current); },
          };
        },
        roomId: 'reference-room',
        actorId: 'reference-actor',
      });

      let firstError = null;
      let firstResult = null;
      try {
        firstResult = lifecycle.connect();
      } catch (error) {
        firstError = error instanceof Error ? error.message : 'unexpected error';
      }

      await new Promise((resolve) => setImmediate(resolve));
      const afterFailure = lifecycle.getSnapshot();
      const recovered = lifecycle.reconnect();
      const disposeResult = lifecycle.dispose();
      process.stdout.write(JSON.stringify({
        afterFailure,
        disposeResult,
        events,
        firstError,
        firstResult,
        recovered,
        unhandledRejections,
      }));
    `;
    const output = execFileSync(
      process.execPath,
      ['--input-type=module', '--eval', script],
      { encoding: 'utf8' },
    );

    expect(JSON.parse(output)).toEqual({
      afterFailure: { providerGeneration: 1, status: 'disconnected' },
      disposeResult: true,
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
      firstError: 'collaboration lifecycle connection failed.',
      firstResult: null,
      recovered: { providerGeneration: 2, status: 'connected' },
      unhandledRejections: 0,
    });
  });
});
