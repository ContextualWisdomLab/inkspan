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

const findMarkdownHeadingIndex = (markdown: string, heading: string): number => {
  let offset = 0;
  let openFence: string | null = null;

  for (const sourceLine of markdown.split('\n')) {
    const line = sourceLine.endsWith('\r') ? sourceLine.slice(0, -1) : sourceLine;
    const fenceStart = line.match(/^[ \t]{0,3}(`{3,}|~{3,})/u);

    if (openFence === null && fenceStart !== null) {
      openFence = fenceStart[1];
    } else if (openFence !== null) {
      const fenceEnd = line.match(/^[ \t]{0,3}(`{3,}|~{3,})[ \t]*$/u);
      if (
        fenceEnd !== null &&
        fenceEnd[1][0] === openFence[0] &&
        fenceEnd[1].length >= openFence.length
      ) {
        openFence = null;
      }
    } else if (line.trimEnd() === heading) {
      return offset;
    }

    offset += sourceLine.length + 1;
  }

  return -1;
};

const releaseSection = (headingPattern: RegExp): string => {
  const headingMatch = headingPattern.exec(changelog);
  expect(headingMatch).not.toBeNull();
  const headingIndex = headingMatch?.index ?? -1;
  const afterHeadingIndex = headingIndex + (headingMatch?.[0].length ?? 0);
  const nextReleaseMatch = /^## \[/mu.exec(changelog.slice(afterHeadingIndex));
  const endIndex =
    nextReleaseMatch?.index === undefined
      ? changelog.length
      : afterHeadingIndex + nextReleaseMatch.index;
  return changelog.slice(headingIndex, endIndex);
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

  it('recognizes only a real Unreleased heading outside fenced code', () => {
    expect(
      findMarkdownHeadingIndex(
        'ordinary text mentioning ## [Unreleased]\n## [0.6.0] — 2026-08-25\n',
        '## [Unreleased]',
      ),
    ).toBe(-1);
    expect(
      findMarkdownHeadingIndex(
        '```md\n## [Unreleased]\n```\n## [0.6.0] — 2026-08-25\n',
        '## [Unreleased]',
      ),
    ).toBe(-1);
    expect(
      findMarkdownHeadingIndex(
        'Preface\n## [Unreleased]  \n## [0.6.0] — 2026-08-25\n',
        '## [Unreleased]',
      ),
    ).toBe('Preface\n'.length);
  });

  it('binds the current product version to a dated changelog release', () => {
    const escapedVersion = rootManifest.version.split('.').join('\\.');
    const releaseHeading = new RegExp(
      `^## \\[${escapedVersion}\\] — 20[0-9]{2}-[0-9]{2}-[0-9]{2}$`,
      'mu',
    );
    const unreleasedIndex = findMarkdownHeadingIndex(changelog, '## [Unreleased]');
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
