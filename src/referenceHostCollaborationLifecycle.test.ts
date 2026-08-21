import { execFileSync } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';
import { pathToFileURL } from 'node:url';
import { resolve } from 'node:path';

import { describe, expect, it } from 'vitest';

const fixturePath = resolve(
  process.cwd(),
  'examples/reference-host/collaboration-provider-lifecycle.mjs',
);

describe('reference-host collaboration lifecycle contract', () => {
  it('ships one host-owned collaboration lifecycle fixture outside the published runtime', () => {
    expect(existsSync(fixturePath)).toBe(true);
  });

  it('keeps provider creation and teardown host-owned and provider-neutral', () => {
    if (!existsSync(fixturePath)) return;
    const source = readFileSync(fixturePath, 'utf8');

    expect(source).not.toMatch(/(?:from|import\()\s*['"][^'"]*src\//u);
    expect(source).not.toMatch(/\b(?:fetch|XMLHttpRequest|WebSocket|process\.env)\b/u);
    expect(source).toContain('REFERENCE_ONLY');
    expect(source).toContain('providerFactory');
    expect(source).toContain('reconnect');
    expect(source).toContain('dispose');
  });

  it('reuses one real host-created Y.Doc across provider reconnects and tears it down exactly once', () => {
    if (!existsSync(fixturePath)) return;
    const output = execFileSync(process.execPath, [fixturePath, '--self-test'], {
      encoding: 'utf8',
    });

    expect(JSON.parse(output)).toEqual({
      events: [
        'document:create',
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
      hostDocumentIsYjs: true,
      providerGeneration: 2,
      sameDocumentAcrossReconnect: true,
      status: 'disposed',
      yjsText: 'Buyer draft',
    });
  });

  it('retains a provider whose destroy failed so reconnect can retry cleanup before replacement', () => {
    if (!existsSync(fixturePath)) return;
    const moduleUrl = JSON.stringify(pathToFileURL(fixturePath).href);
    const script = `
      import { createHostCollaborationLifecycle } from ${moduleUrl};
      const events = [];
      let generation = 0;
      let firstDestroyAttempts = 0;
      const lifecycle = createHostCollaborationLifecycle({
        documentFactory() {
          return { destroy() { events.push('document:destroy'); } };
        },
        providerFactory() {
          generation += 1;
          const current = generation;
          events.push('provider:create:' + current);
          return {
            connect() { events.push('provider:connect:' + current); },
            disconnect() { events.push('provider:disconnect:' + current); },
            destroy() {
              events.push('provider:destroy:' + current);
              if (current === 1 && firstDestroyAttempts === 0) {
                firstDestroyAttempts += 1;
                throw new Error('private transient destroy failure');
              }
            },
          };
        },
        roomId: 'reference-room',
        actorId: 'reference-actor',
      });
      lifecycle.connect();
      let firstError = null;
      try {
        lifecycle.reconnect();
      } catch (error) {
        firstError = error instanceof Error ? error.message : 'unexpected error';
      }
      lifecycle.reconnect();
      process.stdout.write(JSON.stringify({
        events,
        firstError,
        snapshot: lifecycle.getSnapshot(),
      }));
    `;
    const output = execFileSync(
      process.execPath,
      ['--input-type=module', '--eval', script],
      { encoding: 'utf8' },
    );

    expect(JSON.parse(output)).toEqual({
      events: [
        'provider:create:1',
        'provider:connect:1',
        'provider:disconnect:1',
        'provider:destroy:1',
        'provider:destroy:1',
        'provider:create:2',
        'provider:connect:2',
      ],
      firstError: 'collaboration lifecycle teardown failed.',
      snapshot: { providerGeneration: 2, status: 'connected' },
    });
  });

  it('redacts reconnect provider construction failures and remains recoverable', () => {
    if (!existsSync(fixturePath)) return;
    const moduleUrl = JSON.stringify(pathToFileURL(fixturePath).href);
    const script = `
      import { createHostCollaborationLifecycle } from ${moduleUrl};
      const privateCause = 'private reconnect provider cause';
      const events = [];
      let generation = 0;
      const lifecycle = createHostCollaborationLifecycle({
        documentFactory() {
          return { destroy() { events.push('document:destroy'); } };
        },
        providerFactory() {
          generation += 1;
          const current = generation;
          events.push('provider:create:' + current);
          if (current === 2) throw new Error(privateCause);
          return {
            connect() { events.push('provider:connect:' + current); },
            disconnect() { events.push('provider:disconnect:' + current); },
            destroy() { events.push('provider:destroy:' + current); },
          };
        },
        roomId: 'reference-room',
        actorId: 'reference-actor',
      });
      lifecycle.connect();
      let reconnectError = null;
      try {
        lifecycle.reconnect();
      } catch (error) {
        reconnectError = error instanceof Error ? error.message : 'unexpected error';
      }
      const afterFailure = lifecycle.getSnapshot();
      const recovered = lifecycle.reconnect();
      lifecycle.dispose();
      process.stdout.write(JSON.stringify({
        afterFailure,
        events,
        leakedPrivateCause:
          typeof reconnectError === 'string' && reconnectError.includes(privateCause),
        reconnectError,
        recovered,
      }));
    `;
    const output = execFileSync(
      process.execPath,
      ['--input-type=module', '--eval', script],
      { encoding: 'utf8' },
    );

    expect(JSON.parse(output)).toEqual({
      afterFailure: { providerGeneration: 2, status: 'disconnected' },
      events: [
        'provider:create:1',
        'provider:connect:1',
        'provider:disconnect:1',
        'provider:destroy:1',
        'provider:create:2',
        'provider:create:3',
        'provider:connect:3',
        'provider:disconnect:3',
        'provider:destroy:3',
        'document:destroy',
      ],
      leakedPrivateCause: false,
      reconnectError: 'collaboration lifecycle reconnect failed.',
      recovered: { providerGeneration: 3, status: 'connected' },
    });
  });

  it('rejects accessor-backed lifecycle options and resource methods without invoking them', () => {
    if (!existsSync(fixturePath)) return;
    const output = execFileSync(
      process.execPath,
      [fixturePath, '--hostile-accessor-self-test'],
      { encoding: 'utf8' },
    );

    expect(JSON.parse(output)).toEqual({
      documentError: 'documentFactory returned an invalid document.',
      documentGetterCalls: 0,
      optionsError: 'collaboration options are invalid.',
      optionsGetterCalls: 0,
      providerError: 'providerFactory returned an invalid provider.',
      providerGetterCalls: 0,
    });
  });

  it('unwinds the acquired host document when initial provider construction fails', () => {
    if (!existsSync(fixturePath)) return;
    const output = execFileSync(
      process.execPath,
      [fixturePath, '--initialization-failure-self-test'],
      { encoding: 'utf8' },
    );

    expect(JSON.parse(output)).toEqual({
      error: 'collaboration lifecycle initialization failed.',
      events: ['document:create', 'provider:create', 'document:destroy'],
      leakedPrivateCause: false,
    });
  });

  it('attempts provider and document cleanup after teardown failure without leaking private causes', () => {
    if (!existsSync(fixturePath)) return;
    const output = execFileSync(
      process.execPath,
      [fixturePath, '--cleanup-failure-self-test'],
      { encoding: 'utf8' },
    );

    expect(JSON.parse(output)).toEqual({
      error: 'collaboration lifecycle teardown failed.',
      events: [
        'provider:connect',
        'provider:disconnect',
        'provider:destroy',
        'document:destroy',
      ],
      leakedPrivateCause: false,
      status: 'disposed',
    });
  });

  it('retries incomplete provider destruction without destroying the host document twice', () => {
    if (!existsSync(fixturePath)) return;
    const moduleUrl = JSON.stringify(pathToFileURL(fixturePath).href);
    const script = `
      import { createHostCollaborationLifecycle } from ${moduleUrl};
      const events = [];
      let providerDestroyAttempts = 0;
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
                throw new Error('private transient provider destroy failure');
              }
            },
          };
        },
        roomId: 'reference-room',
        actorId: 'reference-actor',
      });
      lifecycle.connect();
      let firstError = null;
      try {
        lifecycle.dispose();
      } catch (error) {
        firstError = error instanceof Error ? error.message : 'unexpected error';
      }
      const afterFailure = lifecycle.getSnapshot();
      const retryResult = lifecycle.dispose();
      const afterRetry = lifecycle.getSnapshot();
      const idempotentResult = lifecycle.dispose();
      process.stdout.write(JSON.stringify({
        afterFailure,
        afterRetry,
        events,
        firstError,
        idempotentResult,
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
      afterRetry: { providerGeneration: 1, status: 'disposed' },
      events: [
        'provider:connect',
        'provider:disconnect',
        'provider:destroy:1',
        'document:destroy',
        'provider:destroy:2',
      ],
      firstError: 'collaboration lifecycle teardown failed.',
      idempotentResult: false,
      retryResult: true,
    });
  });
});
