import { createHash } from 'node:crypto';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
import { expect, test } from '@playwright/test';
import {
  SAFE_CLIPBOARD_CROSS_ENGINE_CORPUS,
  SAFE_CLIPBOARD_CROSS_ENGINE_CORPUS_VERSION,
  type CrossEngineClipboardEngine,
  type CrossEngineClipboardObservation,
} from '../../../src/crossEngineClipboardEvidence.js';

type BrowserProbe = (request: {
  sourceHtml: string;
  clipboardConfig?: unknown;
}) => {
  sanitizedHtml: string;
  documentJson: unknown | null;
  errorCode: string | null;
};

type HostileDocumentProbe = (sourceHtml: string) => {
  errorCode: string | null;
  message: string;
};

const evidenceDirectory = resolve(dirname(fileURLToPath(import.meta.url)), '../.browser-evidence');
const lockfilePath = resolve(dirname(fileURLToPath(import.meta.url)), '../pnpm-lock.yaml');
const packagePath = resolve(dirname(fileURLToPath(import.meta.url)), '../package.json');
const observations: CrossEngineClipboardObservation[] = [];
let representativeWordMillis: number | null = null;

const allowHarnessRequest = (requestUrl: string): boolean => {
  const url = new URL(requestUrl);
  return url.hostname === '127.0.0.1' && url.port === '4173';
};

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
  await page.goto('http://127.0.0.1:4173/tests/browser/harness.html');
  expect(rejectedExternalRequests).toEqual([]);
});

for (const testCase of SAFE_CLIPBOARD_CROSS_ENGINE_CORPUS) {
  test(`sanitizes corpus case ${testCase.id}`, async ({ page, browserName }) => {
    const rejectedExternalRequests: string[] = [];
    page.on('request', (request) => {
      if (!allowHarnessRequest(request.url())) {
        rejectedExternalRequests.push(new URL(request.url()).origin);
      }
    });

    const result = await page.evaluate(
      ({ sourceHtml, clipboardConfig }) =>
        (
          window as unknown as {
            runInkspanClipboardProbe: BrowserProbe;
          }
        ).runInkspanClipboardProbe({ sourceHtml, clipboardConfig }),
      {
        sourceHtml: testCase.sourceHtml,
        clipboardConfig: testCase.clipboardConfig,
      },
    );

    expect(result.sanitizedHtml).toBe(testCase.expectedSanitizedHtml);
    expect(result.errorCode).toBe(testCase.expectedErrorCode);
    if (testCase.expectedErrorCode === null) {
      expect(result.documentJson).not.toBeNull();
    } else {
      expect(result.documentJson).toBeNull();
    }
    expect(rejectedExternalRequests).toEqual([]);

    observations.push({
      caseId: testCase.id,
      engine: browserName as CrossEngineClipboardEngine,
      sanitizedHtml: result.sanitizedHtml,
      documentJson: result.documentJson,
      errorCode: result.errorCode as CrossEngineClipboardObservation['errorCode'],
    });
  });
}

test('redacts hostile document capability failures without source disclosure', async ({
  page,
}) => {
  const privateSource = '<p>private source must not escape</p>';
  const result = await page.evaluate(
    (sourceHtml) =>
      (
        window as unknown as {
          runInkspanHostileDocumentProbe: HostileDocumentProbe;
        }
      ).runInkspanHostileDocumentProbe(sourceHtml),
    privateSource,
  );

  expect(result.errorCode).toBe('invalid_html');
  expect(result.message).toBe('Rich clipboard HTML could not be sanitized.');
  expect(result.message).not.toContain('private source');
});

test('keeps representative Word-like sanitization within the release alarm budget', async ({
  page,
}) => {
  const sourceHtml = `<div>${Array.from(
    { length: 800 },
    (_, index) =>
      `<p class="MsoNormal"><span style="font-weight:${index % 2 === 0 ? '700' : '400'}">paragraph-${index}</span></p>`,
  ).join('')}</div>`;

  const measurement = await page.evaluate((html) => {
    const started = performance.now();
    const result = (
      window as unknown as { runInkspanClipboardProbe: BrowserProbe }
    ).runInkspanClipboardProbe({ sourceHtml: html });
    return { elapsedMillis: performance.now() - started, result };
  }, sourceHtml);

  expect(measurement.result.errorCode).toBeNull();
  expect(measurement.elapsedMillis).toBeLessThan(8_000);
  representativeWordMillis = Math.round(measurement.elapsedMillis * 100) / 100;
});

test.afterAll(async ({ browser, browserName }) => {
  const lockfile = await readFile(lockfilePath);
  const browserPackage = JSON.parse(await readFile(packagePath, 'utf8')) as {
    devDependencies?: Record<string, string>;
  };
  const playwrightVersion = browserPackage.devDependencies?.['@playwright/test'];
  if (playwrightVersion !== '1.62.0') {
    throw new Error('Cross-engine browser evidence requires pinned @playwright/test 1.62.0.');
  }
  if (observations.length !== SAFE_CLIPBOARD_CROSS_ENGINE_CORPUS.length) {
    throw new Error('Cross-engine browser evidence is incomplete for the shared corpus.');
  }
  if (representativeWordMillis === null) {
    throw new Error('Cross-engine browser performance evidence is missing.');
  }

  await mkdir(evidenceDirectory, { recursive: true });
  const evidence = Object.freeze({
    schemaVersion: 1,
    corpusVersion: SAFE_CLIPBOARD_CROSS_ENGINE_CORPUS_VERSION,
    engine: browserName,
    playwrightVersion,
    browserVersion: browser.version(),
    osPlatform: process.platform,
    runnerImage: process.env.ImageOS ?? null,
    headSha: process.env.GITHUB_SHA ?? null,
    lockSha256: createHash('sha256').update(lockfile).digest('hex'),
    representativeWordMillis,
    observations,
  });
  await writeFile(
    resolve(evidenceDirectory, `${browserName}.json`),
    `${JSON.stringify(evidence)}\n`,
    'utf8',
  );
});
