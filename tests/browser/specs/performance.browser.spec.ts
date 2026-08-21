import { expect, test } from '@playwright/test';
import {
  PERFORMANCE_CORPUS_VERSION,
  PERFORMANCE_DOCUMENT_PROFILES,
  type PerformanceDocumentProfile,
} from '../performanceCorpus.js';

interface BrowserPerformanceProbeResult {
  readonly mountMillis: number;
  readonly snapshotMillis: number;
  readonly envelopeMillis: number;
  readonly revisionMillis: number;
  readonly sourceCodeUnits: number;
  readonly snapshotCodeUnits: number;
  readonly revisionAvailable: boolean;
}

declare global {
  interface Window {
    runInkspanDocumentPerformanceProbe(
      sourceValue: string,
    ): Promise<BrowserPerformanceProbeResult>;
  }
}

const HARNESS_URL = 'http://127.0.0.1:4173/tests/browser/harness.html';

const allowHarnessRequest = (requestUrl: string): boolean => {
  const url = new URL(requestUrl);
  return url.hostname === '127.0.0.1' && url.port === '4173';
};

function assertMeasurement(
  profile: PerformanceDocumentProfile,
  result: BrowserPerformanceProbeResult,
): void {
  for (const value of [
    result.mountMillis,
    result.snapshotMillis,
    result.envelopeMillis,
    result.revisionMillis,
  ]) {
    expect(Number.isFinite(value)).toBe(true);
    expect(value).toBeGreaterThanOrEqual(0);
  }
  expect(result.sourceCodeUnits).toBe(profile.value.length);
  expect(result.snapshotCodeUnits).toBeGreaterThan(0);
  expect(result.revisionAvailable).toBe(true);
}

test.describe.configure({ mode: 'serial' });

test.beforeEach(async ({ page }) => {
  const rejectedExternalRequests: string[] = [];
  await page.route('**/*', async (route) => {
    if (allowHarnessRequest(route.request().url())) {
      await route.continue();
      return;
    }
    rejectedExternalRequests.push(new URL(route.request().url()).origin);
    await route.abort('blockedbyclient');
  });
  await page.goto(HARNESS_URL);
  expect(rejectedExternalRequests).toEqual([]);
});

for (const profile of PERFORMANCE_DOCUMENT_PROFILES) {
  test(`measures ${profile.id} synthetic document without body telemetry`, async ({
    page,
  }) => {
    test.setTimeout(30_000);
    const result = await page.evaluate(
      async (sourceValue) =>
        window.runInkspanDocumentPerformanceProbe(sourceValue),
      profile.value,
    );
    assertMeasurement(profile, result);
    await test.info().attach(`${profile.id}-${PERFORMANCE_CORPUS_VERSION}.json`, {
      body: JSON.stringify({
        corpusVersion: PERFORMANCE_CORPUS_VERSION,
        profile: profile.id,
        paragraphCount: profile.paragraphCount,
        ...result,
      }),
      contentType: 'application/json',
    });
  });
}
