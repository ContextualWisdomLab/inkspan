import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
import { expect, test } from '@playwright/test';
import {
  SAFE_CLIPBOARD_CROSS_ENGINE_CORPUS,
  SAFE_CLIPBOARD_CROSS_ENGINE_CORPUS_VERSION,
  assertCrossEngineClipboardConsensus,
  type CrossEngineClipboardEngine,
  type CrossEngineClipboardObservation,
} from '../../../src/crossEngineClipboardEvidence.js';
import {
  BROWSER_EVIDENCE_SCHEMA_VERSION,
  BROWSER_PERFORMANCE_BUDGET_MILLIS,
} from '../evidenceContract.js';

interface BrowserEvidence {
  readonly schemaVersion: number;
  readonly corpusVersion: number;
  readonly runId: string;
  readonly engine: CrossEngineClipboardEngine;
  readonly playwrightVersion: string;
  readonly browserVersion: string;
  readonly osPlatform: string;
  readonly runnerImage: string | null;
  readonly headSha: string | null;
  readonly packageSha256: string | null;
  readonly lockSha256: string;
  readonly representativeWordMillis: number;
  readonly observations: readonly CrossEngineClipboardObservation[];
}

const specDirectory = dirname(fileURLToPath(import.meta.url));
const evidenceDirectory = resolve(specDirectory, '../.browser-evidence');
const lockfilePath = resolve(specDirectory, '../pnpm-lock.yaml');
const engines: readonly CrossEngineClipboardEngine[] = [
  'chromium',
  'firefox',
  'webkit',
];

const readEvidence = async (
  engine: CrossEngineClipboardEngine,
): Promise<BrowserEvidence> =>
  JSON.parse(
    await readFile(resolve(evidenceDirectory, `${engine}.json`), 'utf8'),
  ) as BrowserEvidence;

test('requires complete exact-head browser evidence and exact corpus consensus', async () => {
  const currentRunId = (
    await readFile(resolve(evidenceDirectory, '.run-id'), 'utf8')
  ).trim();
  expect(currentRunId.length).toBeGreaterThan(0);
  const currentLockSha256 = createHash('sha256')
    .update(await readFile(lockfilePath))
    .digest('hex');
  const expectedPackageSha256 =
    process.env.INKSPAN_EXPECTED_PACKAGE_SHA256?.trim() || null;
  const evidence = await Promise.all(engines.map(readEvidence));
  const [reference] = evidence;
  if (!reference) throw new Error('Cross-engine browser evidence is missing.');

  expect(reference.runId).toBe(currentRunId);
  for (const [index, item] of evidence.entries()) {
    expect(item.schemaVersion).toBe(BROWSER_EVIDENCE_SCHEMA_VERSION);
    expect(item.corpusVersion).toBe(SAFE_CLIPBOARD_CROSS_ENGINE_CORPUS_VERSION);
    expect(item.runId).toBe(reference.runId);
    expect(item.runId).toBe(currentRunId);
    expect(item.engine).toBe(engines[index]);
    expect(item.playwrightVersion).toBe('1.62.0');
    expect(item.browserVersion.length).toBeGreaterThan(0);
    expect(item.lockSha256).toBe(reference.lockSha256);
    expect(item.lockSha256).toBe(currentLockSha256);
    expect(item.packageSha256).toBe(expectedPackageSha256);
    expect(item.headSha).toBe(reference.headSha);
    expect(item.observations).toHaveLength(SAFE_CLIPBOARD_CROSS_ENGINE_CORPUS.length);
    expect(item.representativeWordMillis).toBeGreaterThanOrEqual(0);
    expect(item.representativeWordMillis).toBeLessThan(
      BROWSER_PERFORMANCE_BUDGET_MILLIS,
    );
  }

  if (process.env.GITHUB_ACTIONS === 'true') {
    expect(reference.headSha).toBe(process.env.INKSPAN_EXPECTED_HEAD_SHA);
    expect(reference.runnerImage).not.toBeNull();
  }

  for (const testCase of SAFE_CLIPBOARD_CROSS_ENGINE_CORPUS) {
    const observations = evidence.map((item) => {
      const observation = item.observations.find(
        (candidate) => candidate.caseId === testCase.id,
      );
      if (!observation) {
        throw new Error(
          `Cross-engine browser evidence is missing corpus case ${testCase.id}.`,
        );
      }
      return observation;
    });
    assertCrossEngineClipboardConsensus(observations);
  }

  const summary = {
    schemaVersion: BROWSER_EVIDENCE_SCHEMA_VERSION,
    corpusVersion: SAFE_CLIPBOARD_CROSS_ENGINE_CORPUS_VERSION,
    runId: reference.runId,
    headSha: reference.headSha,
    packageSha256: reference.packageSha256,
    lockSha256: reference.lockSha256,
    playwrightVersion: reference.playwrightVersion,
    engines: evidence.map((item) => ({
      engine: item.engine,
      browserVersion: item.browserVersion,
      osPlatform: item.osPlatform,
      runnerImage: item.runnerImage,
      representativeWordMillis: item.representativeWordMillis,
    })),
  };
  console.log(`[inkspan-cross-engine-evidence] ${JSON.stringify(summary)}`);
});
