import { expect, test, type Page } from '@playwright/test';

const REFERENCE_HOST_URL =
  'http://127.0.0.1:4173/examples/reference-host/browser-host.html';

function isReferenceHostRequest(requestUrl: string): boolean {
  const url = new URL(requestUrl);
  return (
    url.protocol === 'http:' &&
    url.hostname === '127.0.0.1' &&
    url.port === '4173'
  );
}

async function observeReferenceHost(page: Page) {
  const rejectedRequests: string[] = [];
  const pageErrors: string[] = [];
  const consoleErrors: string[] = [];

  page.on('pageerror', (error) => {
    pageErrors.push(error.message);
  });
  page.on('console', (message) => {
    if (message.type() === 'error') {
      consoleErrors.push(message.text());
    }
  });
  await page.route('**/*', async (route) => {
    const requestUrl = route.request().url();
    if (isReferenceHostRequest(requestUrl)) {
      await route.continue();
      return;
    }
    rejectedRequests.push(requestUrl);
    await route.abort('blockedbyclient');
  });

  return { rejectedRequests, pageErrors, consoleErrors };
}

test('preserves an accessible pre-hydration shell and hydrates the packed reference host without mismatch or external network', async ({
  browser,
}) => {
  const staticContext = await browser.newContext({ javaScriptEnabled: false });
  const staticPage = await staticContext.newPage();
  const staticEvidence = await observeReferenceHost(staticPage);

  const staticResponse = await staticPage.goto(REFERENCE_HOST_URL);
  expect(staticResponse?.ok()).toBe(true);
  await expect(
    staticPage.getByRole('heading', { name: 'Inkspan reference host' }),
  ).toBeVisible();
  await expect(
    staticPage.getByText('Loading buyer editor', { exact: true }),
  ).toBeVisible();
  await expect(staticPage.locator('[aria-busy="true"]')).toHaveText(
    'Loading buyer editor',
  );
  await expect(staticPage.getByRole('textbox')).toHaveCount(0);
  expect(staticEvidence.rejectedRequests).toEqual([]);
  expect(staticEvidence.pageErrors).toEqual([]);
  expect(staticEvidence.consoleErrors).toEqual([]);
  await staticContext.close();

  const hydratedContext = await browser.newContext();
  const hydratedPage = await hydratedContext.newPage();
  const hydratedEvidence = await observeReferenceHost(hydratedPage);

  const hydratedResponse = await hydratedPage.goto(REFERENCE_HOST_URL);
  expect(hydratedResponse?.ok()).toBe(true);
  await expect(
    hydratedPage.getByRole('heading', { name: 'Inkspan reference host' }),
  ).toBeVisible();
  await expect(hydratedPage.getByRole('textbox')).toBeVisible();
  await expect(
    hydratedPage.getByRole('button', { name: 'Save document' }),
  ).toBeVisible();
  await expect(
    hydratedPage.getByText('Loading buyer editor', { exact: true }),
  ).toHaveCount(0);
  await expect(hydratedPage.locator('[aria-busy="true"]')).toHaveCount(0);
  await expect(
    hydratedPage.locator('[data-inkspan-form-field][name="message_body"]'),
  ).toHaveValue('# Draft');
  expect(hydratedEvidence.rejectedRequests).toEqual([]);
  expect(hydratedEvidence.pageErrors).toEqual([]);
  expect(hydratedEvidence.consoleErrors).toEqual([]);
  await hydratedContext.close();
});
