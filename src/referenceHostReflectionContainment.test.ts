import { execFileSync } from 'node:child_process';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';

import { describe, expect, it } from 'vitest';

function observeHostileReflectionFailure(
  fixture: string,
  invocation: string,
): string {
  const fixtureUrl = pathToFileURL(resolve(process.cwd(), fixture)).href;
  const script = `
    const module = await import(${JSON.stringify(fixtureUrl)});
    const privateSentinel = 'private-reflection-sentinel';
    const hostileError = new Proxy({}, {
      getPrototypeOf() {
        throw privateSentinel;
      },
    });
    const hostileSource = new Proxy({}, ${invocation});
    let observed = 'no-error';
    try {
      module.runReflectionBoundarySelfTest(hostileSource);
    } catch (error) {
      if (typeof error === 'object' && error !== null) {
        const descriptor = Object.getOwnPropertyDescriptor(error, 'message');
        observed = descriptor && Object.prototype.hasOwnProperty.call(descriptor, 'value')
          ? descriptor.value
          : 'object-error';
      } else {
        observed = String(error);
      }
    }
    process.stdout.write(JSON.stringify({ observed }));
  `;
  const output = execFileSync(
    process.execPath,
    ['--input-type=module', '--eval', script],
    { encoding: 'utf8' },
  );
  return (JSON.parse(output) as { observed: string }).observed;
}

describe('reference-host hostile reflection containment', () => {
  it('redacts hostile meta-object failures across every reference boundary', () => {
    const prototypeTrap = `{
      getPrototypeOf() {
        throw hostileError;
      },
    }`;
    const descriptorTrap = `{
      getOwnPropertyDescriptor() {
        throw hostileError;
      },
    }`;

    expect(
      observeHostileReflectionFailure(
        'examples/reference-host/synthetic-document-repository.mjs',
        prototypeTrap,
      ),
    ).toBe('Reference persistence invalid_options.');
    expect(
      observeHostileReflectionFailure(
        'examples/reference-host/delayed-proposal.mjs',
        prototypeTrap,
      ),
    ).toBe('proposal creation is invalid.');
    expect(
      observeHostileReflectionFailure(
        'examples/reference-host/autosave-view-model.mjs',
        descriptorTrap,
      ),
    ).toBe('autosave snapshot is invalid.');
    expect(
      observeHostileReflectionFailure(
        'examples/reference-host/collaboration-provider-lifecycle.mjs',
        descriptorTrap,
      ),
    ).toBe('collaboration options are invalid.');
  });
});
