import { execFileSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import { pathToFileURL } from 'node:url';
import { resolve } from 'node:path';

import { describe, expect, it } from 'vitest';

const authorizationFixturePath = resolve(
  process.cwd(),
  'examples/reference-host/host-authorized-collaboration.mjs',
);
const lifecycleFixturePath = resolve(
  process.cwd(),
  'examples/reference-host/collaboration-provider-lifecycle.mjs',
);

describe('reference-host authorized collaboration journey', () => {
  it('ships a host-owned authorization gate outside the published Inkspan runtime', () => {
    expect(existsSync(authorizationFixturePath)).toBe(true);
  });

  it('redacts host authorization failures before provider construction', () => {
    if (!existsSync(authorizationFixturePath)) return;
    const moduleUrl = JSON.stringify(pathToFileURL(authorizationFixturePath).href);
    const script = `
      import { createHostAuthorizedProviderFactory } from ${moduleUrl};
      const privateCause = 'private buyer authorization reason';
      const events = [];
      const providerFactory = createHostAuthorizedProviderFactory({
        authorize(context) {
          events.push('authorize:' + context.actorId + ':' + context.roomId + ':' + context.generation);
          throw new Error(privateCause);
        },
        createProvider() {
          events.push('provider:create');
          return {};
        },
      });
      let error = null;
      try {
        providerFactory({
          document: {},
          roomId: 'buyer-room',
          actorId: 'buyer-actor',
          generation: 1,
        });
      } catch (failure) {
        error = failure instanceof Error ? failure.message : 'unexpected error';
      }
      process.stdout.write(JSON.stringify({
        error,
        events,
        leakedPrivateCause: typeof error === 'string' && error.includes(privateCause),
      }));
    `;
    const output = execFileSync(
      process.execPath,
      ['--input-type=module', '--eval', script],
      { encoding: 'utf8' },
    );

    expect(JSON.parse(output)).toEqual({
      error: 'collaboration provider authorization failed.',
      events: ['authorize:buyer-actor:buyer-room:1'],
      leakedPrivateCause: false,
    });
  });

  it('requires an exact synchronous true decision before constructing a provider', () => {
    if (!existsSync(authorizationFixturePath)) return;
    const moduleUrl = JSON.stringify(pathToFileURL(authorizationFixturePath).href);
    const script = `
      import { createHostAuthorizedProviderFactory } from ${moduleUrl};
      const events = [];
      const providerFactory = createHostAuthorizedProviderFactory({
        authorize() {
          events.push('authorize');
          return Promise.resolve(true);
        },
        createProvider() {
          events.push('provider:create');
          return {};
        },
      });
      let error = null;
      try {
        providerFactory({ document: {}, roomId: 'buyer-room', actorId: 'buyer-actor', generation: 1 });
      } catch (failure) {
        error = failure instanceof Error ? failure.message : 'unexpected error';
      }
      process.stdout.write(JSON.stringify({ error, events }));
    `;
    const output = execFileSync(
      process.execPath,
      ['--input-type=module', '--eval', script],
      { encoding: 'utf8' },
    );

    expect(JSON.parse(output)).toEqual({
      error: 'collaboration provider authorization failed.',
      events: ['authorize'],
    });
  });

  it('re-authorizes the exact host room and actor before every provider generation', () => {
    if (!existsSync(authorizationFixturePath) || !existsSync(lifecycleFixturePath)) return;
    const authorizationUrl = JSON.stringify(pathToFileURL(authorizationFixturePath).href);
    const lifecycleUrl = JSON.stringify(pathToFileURL(lifecycleFixturePath).href);
    const script = `
      import { createHostAuthorizedProviderFactory } from ${authorizationUrl};
      import { createHostCollaborationLifecycle } from ${lifecycleUrl};
      const events = [];
      const providerFactory = createHostAuthorizedProviderFactory({
        authorize(context) {
          events.push('authorize:' + context.actorId + ':' + context.roomId + ':' + context.generation);
          return true;
        },
        createProvider(context) {
          const generation = context.generation;
          events.push('provider:create:' + generation);
          return {
            connect() { events.push('provider:connect:' + generation); },
            disconnect() { events.push('provider:disconnect:' + generation); },
            destroy() { events.push('provider:destroy:' + generation); },
          };
        },
      });
      const lifecycle = createHostCollaborationLifecycle({
        documentFactory() {
          return { destroy() { events.push('document:destroy'); } };
        },
        providerFactory,
        roomId: 'buyer-room',
        actorId: 'buyer-actor',
      });
      lifecycle.connect();
      lifecycle.reconnect();
      lifecycle.dispose();
      process.stdout.write(JSON.stringify({ events, snapshot: lifecycle.getSnapshot() }));
    `;
    const output = execFileSync(
      process.execPath,
      ['--input-type=module', '--eval', script],
      { encoding: 'utf8' },
    );

    expect(JSON.parse(output)).toEqual({
      events: [
        'authorize:buyer-actor:buyer-room:1',
        'provider:create:1',
        'provider:connect:1',
        'provider:disconnect:1',
        'provider:destroy:1',
        'authorize:buyer-actor:buyer-room:2',
        'provider:create:2',
        'provider:connect:2',
        'provider:disconnect:2',
        'provider:destroy:2',
        'document:destroy',
      ],
      snapshot: { providerGeneration: 2, status: 'disposed' },
    });
  });
});
