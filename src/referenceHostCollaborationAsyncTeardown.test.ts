import { execFileSync } from 'node:child_process';
import { pathToFileURL } from 'node:url';
import { resolve } from 'node:path';

import { describe, expect, it } from 'vitest';

const fixturePath = resolve(
  process.cwd(),
  'examples/reference-host/collaboration-provider-lifecycle.mjs',
);

describe('reference-host asynchronous teardown contract', () => {
  it('quarantines promise-returning provider destruction and retries cleanup without an unhandled rejection', () => {
    const moduleUrl = JSON.stringify(pathToFileURL(fixturePath).href);
    const script = `
      import { createHostCollaborationLifecycle } from ${moduleUrl};
      const events = [];
      let providerDestroyAttempts = 0;
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
          return {
            connect() { events.push('provider:connect'); },
            disconnect() { events.push('provider:disconnect'); },
            destroy() {
              providerDestroyAttempts += 1;
              events.push('provider:destroy:' + providerDestroyAttempts);
              if (providerDestroyAttempts === 1) {
                return Promise.reject(new Error('private asynchronous provider destroy failure'));
              }
            },
          };
        },
        roomId: 'reference-room',
        actorId: 'reference-actor',
      });

      lifecycle.connect();
      let firstError = null;
      let firstResult = null;
      try {
        firstResult = lifecycle.dispose();
      } catch (error) {
        firstError = error instanceof Error ? error.message : 'unexpected error';
      }

      await new Promise((resolve) => setImmediate(resolve));
      const afterFailure = lifecycle.getSnapshot();
      const retryResult = lifecycle.dispose();
      const afterRetry = lifecycle.getSnapshot();
      const idempotentResult = lifecycle.dispose();
      process.stdout.write(JSON.stringify({
        afterFailure,
        afterRetry,
        events,
        firstError,
        firstResult,
        idempotentResult,
        retryResult,
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
      afterRetry: { providerGeneration: 1, status: 'disposed' },
      events: [
        'provider:connect',
        'provider:disconnect',
        'provider:destroy:1',
        'document:destroy',
        'provider:destroy:2',
      ],
      firstError: 'collaboration lifecycle teardown failed.',
      firstResult: null,
      idempotentResult: false,
      retryResult: true,
      unhandledRejections: 0,
    });
  });

  it('retries promise-returning document destruction without repeating successful provider teardown', () => {
    const moduleUrl = JSON.stringify(pathToFileURL(fixturePath).href);
    const script = `
      import { createHostCollaborationLifecycle } from ${moduleUrl};
      const events = [];
      let documentDestroyAttempts = 0;
      let unhandledRejections = 0;
      process.on('unhandledRejection', () => {
        unhandledRejections += 1;
      });

      const lifecycle = createHostCollaborationLifecycle({
        documentFactory() {
          return {
            destroy() {
              documentDestroyAttempts += 1;
              events.push('document:destroy:' + documentDestroyAttempts);
              if (documentDestroyAttempts === 1) {
                return Promise.reject(new Error('private asynchronous document destroy failure'));
              }
            },
          };
        },
        providerFactory() {
          return {
            connect() { events.push('provider:connect'); },
            disconnect() { events.push('provider:disconnect'); },
            destroy() { events.push('provider:destroy'); },
          };
        },
        roomId: 'reference-room',
        actorId: 'reference-actor',
      });

      lifecycle.connect();
      let firstError = null;
      let firstResult = null;
      try {
        firstResult = lifecycle.dispose();
      } catch (error) {
        firstError = error instanceof Error ? error.message : 'unexpected error';
      }

      await new Promise((resolve) => setImmediate(resolve));
      const afterFailure = lifecycle.getSnapshot();
      const retryResult = lifecycle.dispose();
      const afterRetry = lifecycle.getSnapshot();
      process.stdout.write(JSON.stringify({
        afterFailure,
        afterRetry,
        events,
        firstError,
        firstResult,
        retryResult,
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
      afterRetry: { providerGeneration: 1, status: 'disposed' },
      events: [
        'provider:connect',
        'provider:disconnect',
        'provider:destroy',
        'document:destroy:1',
        'document:destroy:2',
      ],
      firstError: 'collaboration lifecycle teardown failed.',
      firstResult: null,
      retryResult: true,
      unhandledRejections: 0,
    });
  });

  it('contains promise-returning document cleanup while unwinding initial provider failure', () => {
    const moduleUrl = JSON.stringify(pathToFileURL(fixturePath).href);
    const script = `
      import { createHostCollaborationLifecycle } from ${moduleUrl};
      const events = [];
      let unhandledRejections = 0;
      process.on('unhandledRejection', () => {
        unhandledRejections += 1;
      });

      let initializationError = null;
      try {
        createHostCollaborationLifecycle({
          documentFactory() {
            events.push('document:create');
            return {
              destroy() {
                events.push('document:destroy');
                return Promise.reject(new Error('private asynchronous initialization cleanup failure'));
              },
            };
          },
          providerFactory() {
            events.push('provider:create');
            throw new Error('private provider construction failure');
          },
          roomId: 'reference-room',
          actorId: 'reference-actor',
        });
      } catch (error) {
        initializationError = error instanceof Error ? error.message : 'unexpected error';
      }

      await new Promise((resolve) => setImmediate(resolve));
      process.stdout.write(JSON.stringify({
        events,
        initializationError,
        unhandledRejections,
      }));
    `;
    const output = execFileSync(
      process.execPath,
      ['--input-type=module', '--eval', script],
      { encoding: 'utf8' },
    );

    expect(JSON.parse(output)).toEqual({
      events: ['document:create', 'provider:create', 'document:destroy'],
      initializationError: 'collaboration lifecycle initialization failed.',
      unhandledRejections: 0,
    });
  });

  it('contains promise-returning provider disconnection before completing synchronous destruction', () => {
    const moduleUrl = JSON.stringify(pathToFileURL(fixturePath).href);
    const script = `
      import { createHostCollaborationLifecycle } from ${moduleUrl};
      const events = [];
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
          return {
            connect() { events.push('provider:connect'); },
            disconnect() {
              events.push('provider:disconnect');
              return Promise.reject(new Error('private asynchronous provider disconnect failure'));
            },
            destroy() { events.push('provider:destroy'); },
          };
        },
        roomId: 'reference-room',
        actorId: 'reference-actor',
      });

      lifecycle.connect();
      let firstError = null;
      let firstResult = null;
      try {
        firstResult = lifecycle.dispose();
      } catch (error) {
        firstError = error instanceof Error ? error.message : 'unexpected error';
      }

      await new Promise((resolve) => setImmediate(resolve));
      const afterFailure = lifecycle.getSnapshot();
      const retryResult = lifecycle.dispose();
      process.stdout.write(JSON.stringify({
        afterFailure,
        events,
        firstError,
        firstResult,
        retryResult,
        unhandledRejections,
      }));
    `;
    const output = execFileSync(
      process.execPath,
      ['--input-type=module', '--eval', script],
      { encoding: 'utf8' },
    );

    expect(JSON.parse(output)).toEqual({
      afterFailure: { providerGeneration: 1, status: 'disposed' },
      events: [
        'provider:connect',
        'provider:disconnect',
        'provider:destroy',
        'document:destroy',
      ],
      firstError: 'collaboration lifecycle teardown failed.',
      firstResult: null,
      retryResult: false,
      unhandledRejections: 0,
    });
  });
});
