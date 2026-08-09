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

interface BrowserEvidence {
  readonly schemaVersion: number;
  readonly corpusVersion: number;
  readonly engine: CrossEngineClipboardEngine;
  readonly playwrightVersion: string;
  readonly browserVersion: string;
  readonly osPlatform: string;
  readonly runnerImage: string | null;
  readonly headSha: string | null;
  readonly lockSha256: string;
  readonly representativeWordMillis: number;
  readonly observations: readonly CrossEngineClipboardObservation[];
}

const evidenceDirectory = resolve(dirname(fileURLToPath(import.meta.url)), '../.browser-evidence');
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
  const evidence = await Promise.all(engines.map(readEvidence));
  const [reference] = evidence;
  if (!reference) throw new Error('Cross-engine browser evidence is missing.');

  for (const [index, item] of evidence.entries()) {
    expect(item.schemaVersion).toBe(1);
    expect(item.corpusVersion).toBe(SAFE_CLIPBOARD_CROSS_ENGINE_CORPUS_VERSION);
    expect(item.engine).toBe(engines[index]);
    expect(item.playwrightVersion).toBe('1.62.0');
    expect(item.browserVersion.length).toBeGreaterThan(0);
    expect(item.lockSha256).toBe(reference.lockSha256);
    expect(item.headSha).toBe(reference.headSha);
    expect(item.observations).toHaveLength(SAFE_CLIPBOARD_CROSS_ENGINE_CORPUS.length);
    expect(item.representativeWordMillis).toBeGreaterThanOrEqual(0);
    expect(item.representativeWordMillis).toBeLessThan(8_000);
  }

  if (process.env.GITHUB_ACTIONS === 'true') {
    expect(reference.headSha).toBe(process.env.GITHUB_SHA);
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
    schemaVersion: 1,
    corpusVersion: SAFE_CLIPBOARD_CROSS_ENGINE_CORPUS_VERSION,
    headSha: reference.headSha,
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
