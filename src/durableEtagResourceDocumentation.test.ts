import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';

import { describe, expect, it } from 'vitest';

const repositoryFile = (path: string): string =>
  readFileSync(resolve(process.cwd(), path), 'utf8');

describe('durable ETag resource-boundary documentation', () => {
  it('keeps the active proposal discoverable without claiming protected-main maturity', () => {
    const index = repositoryFile('docs/README.md');
    const recordPath = 'docs/doctoring/durable-etag-resource-boundary.md';

    expect(existsSync(resolve(process.cwd(), recordPath))).toBe(true);
    expect(index).toContain('doctoring/durable-etag-resource-boundary.md');
    expect(index).toContain('Active PR / Proposed');

    const record = repositoryFile(recordPath);
    expect(record).toContain('**Status:** Active PR / Proposed');
    expect(record).toContain('does not yet apply the resource ceiling');
    expect(record).toContain('64 Ki UTF-16 code units');
    expect(record).toContain('not** claim that RFC 9110 defines a 64 Ki');
    expect(record).toContain('Until that active PR reaches protected `main`');
    expect(record).toContain('authentication');
    expect(record).toContain('durable audit');
  });

  it('keeps the protected autosave contract in the canonical graph', () => {
    const index = repositoryFile('docs/README.md');

    expect(index).toContain('[`document-autosave.md`](document-autosave.md)');
    expect(index).toContain('host-owned persistence boundary');
  });
});
