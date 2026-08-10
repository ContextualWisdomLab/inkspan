import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

import { describe, expect, it } from 'vitest';

const repositoryText = (path: string): string =>
  readFileSync(resolve(process.cwd(), path), 'utf8');

const toolbar = repositoryText('src/components/Toolbar.tsx');
const changelog = repositoryText('CHANGELOG.md');

describe('0.6.0 protected-main accessibility release metadata', () => {
  it('records the explicit image alternative-text intent behavior now on protected main', () => {
    expect(toolbar).toContain(
      'Image alternative text. Leave empty only if this image is decorative.',
    );
    expect(changelog).toContain(
      'Require explicit author alternative-text intent before inline image insertion',
    );
  });
});
