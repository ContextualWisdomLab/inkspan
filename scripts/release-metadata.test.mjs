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

  assert.notEqual(headingMatch, null);
  assert.equal(
    changelog.indexOf('## [Unreleased]') < (headingMatch?.index ?? -1),
    true,
  );
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

test('CI browser evidence installs the exact packed editor instead of source fallback', () => {
  const ciWorkflow = readRepositoryText('.github/workflows/ci.yml');
  const packIndex = ciWorkflow.indexOf(
    '- name: Pack exact editor artifact for browser verification',
  );
  const entryIndex = ciWorkflow.indexOf('INKSPAN_BROWSER_PACKAGE_ENTRY=');
  const playwrightIndex = ciWorkflow.indexOf(
    '- name: Verify real-engine rich clipboard release evidence',
  );

  assert.notEqual(packIndex, -1);
  assert.notEqual(entryIndex, -1);
  assert.notEqual(playwrightIndex, -1);
  assert.equal(ciWorkflow.includes('npm pack --ignore-scripts --json'), true);
  assert.equal(ciWorkflow.includes("package_name != '@contextualwisdomlab/cwl-editor'"), true);
  assert.equal(packIndex < entryIndex, true);
  assert.equal(entryIndex < playwrightIndex, true);
});
