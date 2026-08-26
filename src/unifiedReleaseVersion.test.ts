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

const releaseSection = (headingPattern: RegExp): string => {
  const headingIndex = changelog.search(headingPattern);
  expect(headingIndex).toBeGreaterThanOrEqual(0);
  const releaseTail = changelog.slice(headingIndex);
  const nextReleaseIndex = releaseTail.slice(1).search(/^## \[/mu);
  return nextReleaseIndex < 0 ? releaseTail : releaseTail.slice(0, nextReleaseIndex + 1);
};

const subsection = (release: string, heading: string): string => {
  const marker = `### ${heading}`;
  const start = release.indexOf(marker);
  expect(start).toBeGreaterThanOrEqual(0);
  const tail = release.slice(start + marker.length);
  const nextHeading = tail.search(/^### /mu);
  return nextHeading < 0 ? tail : tail.slice(0, nextHeading);
};

describe('unified stable Inkspan release version', () => {
  it('keeps npm and Office artifacts on one product version', () => {
    expect(officeVersion).toBeDefined();
    expect(rootManifest.version).toMatch(/^0\.[0-9]+\.[0-9]+$/u);
    expect(officeVersion).toBe(rootManifest.version);
  });

  it('binds the current product version to a dated changelog release', () => {
    const escapedVersion = rootManifest.version.split('.').join('\\.');
    const releaseHeading = new RegExp(
      `^## \\[${escapedVersion}\\] — 20[0-9]{2}-[0-9]{2}-[0-9]{2}$`,
      'mu',
    );
    const unreleasedIndex = changelog.indexOf('## [Unreleased]');
    const currentReleaseIndex = changelog.search(releaseHeading);
    expect(unreleasedIndex).toBeGreaterThanOrEqual(0);
    expect(currentReleaseIndex).toBeGreaterThanOrEqual(0);
    expect(unreleasedIndex).toBeLessThan(currentReleaseIndex);
  });

  it('preserves the current release category boundary for the SSR native form-field repair', () => {
    const escapedVersion = rootManifest.version.split('.').join('\\.');
    const releaseHeading = new RegExp(
      `^## \\[${escapedVersion}\\] — 20[0-9]{2}-[0-9]{2}-[0-9]{2}$`,
      'mu',
    );
    const currentRelease = releaseSection(releaseHeading);
    const ssrFormFieldEntry =
      'Added the selected standalone Markdown or HTML value to an explicitly configured SSR native form field';

    expect(subsection(currentRelease, 'Fixed')).toContain(ssrFormFieldEntry);
    expect(subsection(currentRelease, 'Security')).not.toContain(ssrFormFieldEntry);
  });
});
