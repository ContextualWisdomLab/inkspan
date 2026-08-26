import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const HISTORICAL_RELEASE_VERSION = '0.5.29';

/** Read one repository UTF-8 text file for release-contract assertions. */
function readRepositoryText(path) {
  return readFileSync(new URL(`../${path}`, import.meta.url), 'utf8');
}

test('binds package metadata to the current dated changelog release candidate', () => {
  const packageManifest = JSON.parse(readRepositoryText('package.json'));
  const changelog = readRepositoryText('CHANGELOG.md');
  const escapedVersion = packageManifest.version.replaceAll('.', '\\.');
  const releaseHeading = new RegExp(
    `^## \\[${escapedVersion}\\] — \\d{4}-\\d{2}-\\d{2}$`,
    'm',
  );
  const headingMatch = changelog.match(releaseHeading);
  const unreleasedIndex = changelog.indexOf('## [Unreleased]');

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
