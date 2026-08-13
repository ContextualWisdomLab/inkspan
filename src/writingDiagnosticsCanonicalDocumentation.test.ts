import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

import { describe, expect, it } from 'vitest';

function repositoryFile(path: string): string {
  return readFileSync(resolve(process.cwd(), path), 'utf8');
}

function normalizeProse(value: string): string {
  return value.replace(/`/gu, '').replace(/\s+/gu, ' ').trim();
}

describe('canonical writing diagnostics documentation', () => {
  it('publishes the complete host and Inkspan authority contract', () => {
    const guide = normalizeProse(
      repositoryFile('docs/WRITING_DIAGNOSTICS.md'),
    );

    expect(guide).toContain('Host semantic authority');
    expect(guide).toContain('Inkspan deterministic integrity');
    expect(guide).toContain(
      '@contextualwisdomlab/cwl-editor/writing-diagnostics',
    );
    expect(guide).toContain(
      'Every local or collaborative transaction with docChanged === true invalidates the complete active diagnostic generation.',
    );
    expect(guide).toContain(
      'Version 1 applies exactly one explicitly selected diagnostic at a time.',
    );
    expect(guide).toContain(
      'Confidence, priority, and category are host labels, not editor truth or submission policy.',
    );
    expect(guide).toContain('Focus, Apply, Ignore, Dismiss, and Explain');
    expect(guide).toContain(
      'Diagnostics never block submission, sending, persistence, export, or collaboration.',
    );
    expect(guide).toContain('server rendering');
    expect(guide).toContain('collaborative editing');
    expect(guide).toContain('privacy');
    expect(guide).toContain('rollback');
  });

  it('prohibits semantic fallback and indexes the guide canonically', () => {
    const guide = normalizeProse(
      repositoryFile('docs/WRITING_DIAGNOSTICS.md'),
    );
    const index = repositoryFile('docs/README.md');

    expect(guide).toContain(
      'No keyword, regex, phrase-list, language-name, sender-domain, recipient-count, nearest-text, quote-search, or word-position fallback is permitted.',
    );
    expect(guide).not.toContain('Inkspan infers grammar');
    expect(guide).not.toContain('Apply all');
    expect(index).toContain(
      '[`WRITING_DIAGNOSTICS.md`](WRITING_DIAGNOSTICS.md)',
    );
  });
});
