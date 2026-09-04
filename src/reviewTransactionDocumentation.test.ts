import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

import { describe, expect, it } from 'vitest';

const repositoryFile = (file: string): string =>
  readFileSync(resolve(process.cwd(), file), 'utf8');

describe('review suggestion transaction documentation', () => {
  it('keeps architecture and evidence records connected to the active contract', () => {
    expect(repositoryFile('docs/adr/0005-revision-scoped-review-evidence.md')).toContain(
      'applyReviewSuggestionDecision',
    );
    expect(repositoryFile('docs/UML.md')).toContain('Review suggestion decision');
    expect(repositoryFile('docs/DATA_MODEL.md')).toContain('`review_operation`');
    expect(repositoryFile('docs/THREAT_MODEL.md')).toContain(
      'Review suggestions and transaction admission',
    );
    expect(repositoryFile('docs/TRACEABILITY.md')).toContain(
      'Exact-revision review mutation',
    );
    expect(repositoryFile('docs/TEST_STRATEGY.md')).toContain(
      'review suggestion decisions',
    );
  });
});
