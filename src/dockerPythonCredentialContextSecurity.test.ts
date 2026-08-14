import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

import { describe, expect, it } from 'vitest';

const dockerIgnore = readFileSync(resolve(process.cwd(), '.dockerignore'), 'utf8');

describe('Docker build-context Python credential boundary', () => {
  it('excludes Python registry and installer credential files recursively', () => {
    expect(dockerIgnore).toContain('**/.pypirc');
    expect(dockerIgnore).toContain('**/pip.conf');
  });
});
