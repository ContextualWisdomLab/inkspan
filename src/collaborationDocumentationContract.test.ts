import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

import { describe, expect, it } from 'vitest';

const collaborationGuide = (): string =>
  readFileSync(resolve(process.cwd(), 'docs/collaboration.md'), 'utf8');

describe('collaboration documentation contract', () => {
  it('keeps public awareness bounds and authority semantics explicit', () => {
    const guide = collaborationGuide();

    expect(guide).toMatch(
      /`userId` must be nonempty, descriptive, not numeric-only, and no longer than 80\s+Unicode code points/u,
    );
    expect(guide).toMatch(
      /`displayName` must be nonempty and is published and rendered\s+as at most 80 Unicode code points/u,
    );
    expect(guide).toMatch(
      /Remote collaborator\s+counts ignore blank, numeric-only, and over-80-code-point public identifiers/u,
    );
    expect(guide).toContain('awareness state is ephemeral');
    expect(guide).toContain('intentionally not used as an authorization source');
  });
});
