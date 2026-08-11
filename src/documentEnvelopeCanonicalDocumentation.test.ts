import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

import { describe, expect, it } from 'vitest';

import {
  encodeDocumentEnvelope,
  type DocumentEnvelopeEncodingOptions,
} from './index.js';

const repositoryFile = (path: string): string =>
  readFileSync(resolve(process.cwd(), path), 'utf8');

describe('canonical document-envelope output-bound contract', () => {
  it('keeps the typed public encoder option available on the active implementation', () => {
    const options: DocumentEnvelopeEncodingOptions = { maxUtf8Bytes: 1024 };

    expect(options.maxUtf8Bytes).toBe(1024);
    expect(typeof encodeDocumentEnvelope).toBe('function');
  });

  it('keeps active-PR maturity and host ownership explicit in canonical documentation', () => {
    const documentation = repositoryFile('docs/document-envelope.md');

    expect(documentation).toContain('`implemented_on_active_pr` in #178');
    expect(documentation).toContain(
      'is **not** protected-main API as\nas of protected `main@50ac98cfa0ad9e8dd75f93ca437a5679fed4d804`',
    );
    expect(documentation).toContain('DocumentEnvelopeEncodingOptions.maxUtf8Bytes');
    expect(documentation).toContain('local allocation defense only');
    for (const hostOwnedBoundary of [
      'transport request',
      'durable object-store',
      'authorization',
      'tenant isolation',
      'persistence',
      'audit',
      'retention',
      'rollback',
    ]) {
      expect(documentation).toContain(hostOwnedBoundary);
    }
  });
});
