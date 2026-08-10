import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

import { describe, expect, it } from 'vitest';

const repositoryFile = (path: string): string =>
  readFileSync(resolve(process.cwd(), path), 'utf8');

const rootManifest = JSON.parse(repositoryFile('package.json')) as {
  version: string;
};
const officeManifest = repositoryFile('office/pyproject.toml');
const changelog = repositoryFile('CHANGELOG.md');

const officeVersion = officeManifest.match(/^version = "([^"]+)"$/mu)?.[1];

describe('unified stable Inkspan release version', () => {
  it('keeps npm and Office artifacts on one product version', () => {
    expect(officeVersion).toBeDefined();
    expect(rootManifest.version).toMatch(/^0\.[0-9]+\.[0-9]+$/u);
    expect(officeVersion).toBe(rootManifest.version);
  });

  it('binds the current product version to a dated changelog release', () => {
    const escapedVersion = rootManifest.version.replaceAll('.', '\\.');
    const releaseHeading = new RegExp(
      `^## \\[${escapedVersion}\\] — 20[0-9]{2}-[0-9]{2}-[0-9]{2}$`,
      'mu',
    );
    expect(changelog).toMatch(releaseHeading);
    expect(changelog.indexOf('## [Unreleased]')).toBeLessThan(
      changelog.search(releaseHeading),
    );
  });
});
