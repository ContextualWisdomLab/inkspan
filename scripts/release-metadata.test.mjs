import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const HISTORICAL_RELEASE_VERSION = '0.5.29';

/** Read one repository UTF-8 text file for release-contract assertions. */
function readRepositoryText(path) {
  return readFileSync(new URL(`../${path}`, import.meta.url), 'utf8');
}

/** Find one real Markdown heading while ignoring fenced-code lookalikes. */
function findMarkdownHeadingIndex(markdown, heading) {
  let offset = 0;
  let openFence = null;

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
}

test('recognizes only a real Unreleased heading outside fenced code', () => {
  assert.equal(
    findMarkdownHeadingIndex(
      'ordinary text mentioning ## [Unreleased]\n## [0.6.0] — 2026-08-25\n',
      '## [Unreleased]',
    ),
    -1,
  );
  assert.equal(
    findMarkdownHeadingIndex(
      '```md\n## [Unreleased]\n```\n## [0.6.0] — 2026-08-25\n',
      '## [Unreleased]',
    ),
    -1,
  );
  assert.equal(
    findMarkdownHeadingIndex(
      'Preface\n## [Unreleased]  \n## [0.6.0] — 2026-08-25\n',
      '## [Unreleased]',
    ),
    'Preface\n'.length,
  );
});

test('binds package metadata to the current dated changelog release candidate', () => {
  const packageManifest = JSON.parse(readRepositoryText('package.json'));
  const changelog = readRepositoryText('CHANGELOG.md');
  const escapedVersion = packageManifest.version.replaceAll('.', '\\.');
  const releaseHeading = new RegExp(
    `^## \\[${escapedVersion}\\] — \\d{4}-\\d{2}-\\d{2}$`,
    'm',
  );
  const headingMatch = changelog.match(releaseHeading);
  const unreleasedIndex = findMarkdownHeadingIndex(changelog, '## [Unreleased]');

  assert.notEqual(headingMatch, null);
  assert.notEqual(unreleasedIndex, -1);
  assert.equal(unreleasedIndex < (headingMatch?.index ?? -1), true);
  assert.equal(
    changelog.includes(
      `Unified the npm editor and \`inkspan-office\` package manifests at **${packageManifest.version}**`,
    ),
    true,
  );
  assert.equal(
    changelog.includes(
      'Added bounded relationship-backed external HTTP(S) hyperlinks to DOCX rich-text runs',
    ),
    true,
  );
});

test('preserves historical 0.5.29 release evidence and doctoring identity', () => {
  const releaseEvidence = readRepositoryText(
    `docs/releases/${HISTORICAL_RELEASE_VERSION}.md`,
  );
  const doctoring = readRepositoryText(
    'docs/doctoring/durable-autosave-session.md',
  );

  assert.equal(
    releaseEvidence.includes(
      `**Release candidate:** ${HISTORICAL_RELEASE_VERSION}`,
    ),
    true,
  );
  assert.equal(
    releaseEvidence.includes('**Source baseline:** `main` after PR #62'),
    true,
  );
  assert.equal(
    doctoring.includes(
      `**Target release:** Inkspan ${HISTORICAL_RELEASE_VERSION}`,
    ),
    true,
  );
  assert.equal(
    releaseEvidence.includes(
      'Tag creation, registry publication, provenance, and immutable GitHub Release publication are not complete',
    ),
    true,
  );
});
