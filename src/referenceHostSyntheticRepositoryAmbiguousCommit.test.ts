import { execFileSync } from 'node:child_process';
import { pathToFileURL } from 'node:url';
import { resolve } from 'node:path';

import { describe, expect, it } from 'vitest';

const fixturePath = resolve(
  process.cwd(),
  'examples/reference-host/synthetic-document-repository.mjs',
);

describe('reference-host ambiguous persistence reconciliation', () => {
  it('models a transport-ambiguous write as possibly committed and forces a durable read before retry', () => {
    const fixtureUrl = JSON.stringify(pathToFileURL(fixturePath).href);
    const script = `
      import {
        ReferencePersistenceError,
        createSyntheticDocumentRepository,
      } from ${fixtureUrl};
      const repository = createSyntheticDocumentRepository({
        documentId: 'buyer-document',
        initialDocument: 'Buyer draft v1',
      });
      const initial = repository.read('buyer-document');
      let ambiguousError = null;
      try {
        repository.save({
          documentId: 'buyer-document',
          document: 'Possibly committed draft',
          ifMatch: initial.validator,
          outcome: 'ambiguous_failure',
        });
      } catch (error) {
        ambiguousError =
          error instanceof ReferencePersistenceError ? error.code : 'unexpected_error';
      }
      const reconciled = repository.read('buyer-document');
      const staleRetry = repository.save({
        documentId: 'buyer-document',
        document: 'Blind retry must not overwrite',
        ifMatch: initial.validator,
      });
      process.stdout.write(JSON.stringify({
        ambiguousError,
        initialValidator: initial.validator,
        reconciledDocument: reconciled.document,
        reconciledValidator: reconciled.validator,
        staleRetry,
      }));
    `;
    const output = execFileSync(
      process.execPath,
      ['--input-type=module', '--eval', script],
      { encoding: 'utf8' },
    );

    expect(JSON.parse(output)).toEqual({
      ambiguousError: 'ambiguous_failure',
      initialValidator: '"v1"',
      reconciledDocument: 'Possibly committed draft',
      reconciledValidator: '"v2"',
      staleRetry: { status: 'conflict', currentValidator: '"v2"' },
    });
  });
});
