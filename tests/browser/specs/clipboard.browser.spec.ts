import { createHash } from 'node:crypto';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
import { expect, test, type Page } from '@playwright/test';
import {
  SAFE_CLIPBOARD_CROSS_ENGINE_CORPUS,
  SAFE_CLIPBOARD_CROSS_ENGINE_CORPUS_VERSION,
  type CrossEngineClipboardEngine,
  type CrossEngineClipboardObservation,
} from '../../../src/crossEngineClipboardEvidence.js';
import {
  BROWSER_EVIDENCE_SCHEMA_VERSION,
  BROWSER_PERFORMANCE_BUDGET_MILLIS,
  packedPackageSha256,
} from '../evidenceContract.js';

type BrowserProbe = (request: {
  sourceHtml: string;
  clipboardConfig?: unknown;
}) => {
  sanitizedHtml: string;
  documentJson: unknown;
  errorCode: string | null;
};

type HostileDocumentProbe = (sourceHtml: string) => {
  errorCode: string | null;
  message: string;
};

const specDirectory = dirname(fileURLToPath(import.meta.url));
const repositoryRoot = resolve(specDirectory, '../../..');
const evidenceDirectory = resolve(specDirectory, '../.browser-evidence');
const lockfilePath = resolve(specDirectory, '../pnpm-lock.yaml');
const packagePath = resolve(specDirectory, '../package.json');
const rejectedRequestsByPage = new WeakMap<Page, string[]>();
const observations: CrossEngineClipboardObservation[] = [];
let representativeWordMillis: number | null = null;

const allowHarnessRequest = (requestUrl: string): boolean => {
  const url = new URL(requestUrl);
  return url.hostname === '127.0.0.1' && url.port === '4173';
};

test.describe.configure({ mode: 'serial' });

test.beforeEach(async ({ page }) => {
  const rejectedExternalRequests: string[] = [];
  rejectedRequestsByPage.set(page, rejectedExternalRequests);
  await page.route('**/*', async (route) => {
    if (allowHarnessRequest(route.request().url())) {
      await route.continue();
      return;
    }
    rejectedExternalRequests.push(new URL(route.request().url()).origin);
    await route.abort('blockedbyclient');
  });
  await page.goto('/tests/browser/harness.html');
});

test.afterEach(async ({ page }) => {
  await page.waitForLoadState('networkidle');
  expect(rejectedRequestsByPage.get(page) ?? []).toEqual([]);
});

for (const testCase of SAFE_CLIPBOARD_CROSS_ENGINE_CORPUS) {
  test(`sanitizes corpus case ${testCase.id}`, async ({ page, browserName }) => {
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

  expect(result.errorCode).toBe('dom_unavailable');
  expect(result.message).toBe(
    'Rich clipboard sanitization requires a DOM-capable document.',
  );
  expect(result.message).not.toContain('private source');
});

test('keeps representative Word-like sanitization within the release alarm budget', async ({
  page,
}) => {
  test.setTimeout(35_000);
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
  expect(measurement.elapsedMillis).toBeLessThan(BROWSER_PERFORMANCE_BUDGET_MILLIS);
  representativeWordMillis = Math.round(measurement.elapsedMillis * 100) / 100;
});

test.afterAll(async ({ browser, browserName }) => {
  const lockfile = await readFile(lockfilePath);
  const runId = (await readFile(resolve(evidenceDirectory, '.run-id'), 'utf8')).trim();
  if (!runId) {
    throw new Error('Cross-engine browser evidence run identity is missing.');
  }
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
    schemaVersion: BROWSER_EVIDENCE_SCHEMA_VERSION,
    corpusVersion: SAFE_CLIPBOARD_CROSS_ENGINE_CORPUS_VERSION,
    runId,
    engine: browserName,
    playwrightVersion,
    browserVersion: browser.version(),
    osPlatform: process.platform,
    runnerImage: process.env.ImageOS ?? null,
    headSha:
      process.env.INKSPAN_EXPECTED_HEAD_SHA ?? process.env.GITHUB_SHA ?? null,
    packageSha256: await packedPackageSha256(repositoryRoot),
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
