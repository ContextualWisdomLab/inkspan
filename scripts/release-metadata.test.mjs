import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const RELEASE_VERSION = '0.5.29';
const RELEASE_DATE = '2026-08-05';

/** Read one repository UTF-8 text file for release-contract assertions. */
function readRepositoryText(path) {
  return readFileSync(new URL(`../${path}`, import.meta.url), 'utf8');
}

test('binds package metadata to the 0.5.29 changelog release', () => {
  const packageManifest = JSON.parse(readRepositoryText('package.json'));
  const changelog = readRepositoryText('CHANGELOG.md');
  const releaseHeading = `## [${RELEASE_VERSION}] — ${RELEASE_DATE}`;

  assert.equal(packageManifest.version, RELEASE_VERSION);
  assert.equal(changelog.includes(releaseHeading), true);
  assert.equal(changelog.indexOf('## [Unreleased]') < changelog.indexOf(releaseHeading), true);
  assert.equal(
    changelog.includes(`- Package version **${RELEASE_VERSION}**`),
    true,
  );
});

test('keeps release evidence and doctoring on the same release candidate', () => {
  const releaseEvidence = readRepositoryText(`docs/releases/${RELEASE_VERSION}.md`);
  const doctoring = readRepositoryText(
    'docs/doctoring/durable-autosave-session.md',
  );

  assert.equal(
    releaseEvidence.includes(`**Release candidate:** ${RELEASE_VERSION}`),
    true,
  );
  assert.equal(
    releaseEvidence.includes('**Source baseline:** `main` after PR #62'),
    true,
  );
  assert.equal(
    doctoring.includes(`**Target release:** Inkspan ${RELEASE_VERSION}`),
    true,
  );
  assert.equal(
    releaseEvidence.includes(
      'Tag creation, registry publication, provenance, and immutable GitHub Release publication are not complete',
    ),
    true,
  );
});
