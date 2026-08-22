import { expect, test } from '@playwright/test';

const REFERENCE_HOST_URL =
  'http://127.0.0.1:4173/examples/reference-host/browser-host.html';

function isReferenceHostRequest(requestUrl: string): boolean {
  const url = new URL(requestUrl);
  return url.protocol === 'http:' && url.hostname === '127.0.0.1' && url.port === '4173';
}

test.describe.configure({ mode: 'serial' });

test('hydrates the real native-form reference host without external runtime requests', async ({
  page,
}) => {
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

  const response = await page.goto(REFERENCE_HOST_URL);
  expect(response?.ok()).toBe(true);

  await expect(
    page.getByRole('heading', { name: 'Inkspan reference host' }),
  ).toBeVisible();
  await expect(
    page.locator('[data-inkspan-form-field][name="message_body"]'),
  ).toHaveValue('# Draft');
  await expect(page.getByText('Loading buyer editor')).toHaveCount(0);

  await page.getByRole('button', { name: 'Save document' }).click();
  await expect
    .poll(() =>
      page.evaluate(() => {
        const hostWindow = window as typeof window & {
          referenceHostSubmissions?: string[];
        };
        return hostWindow.referenceHostSubmissions ?? [];
      }),
    )
    .toEqual(['# Draft']);

  expect(rejectedRequests).toEqual([]);
  expect(pageErrors).toEqual([]);
  expect(
    consoleErrors.filter((message) =>
      /hydration|did not match|server html/iu.test(message),
    ),
  ).toEqual([]);
});

test('keeps the buyer host readable while read-only mode fail-closes native writes', async ({
  page,
}) => {
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

  const response = await page.goto(`${REFERENCE_HOST_URL}?readOnly=1`);
  expect(response?.ok()).toBe(true);

  await expect(
    page.getByRole('heading', { name: 'Inkspan reference host' }),
  ).toBeVisible();
  await expect(page.getByRole('textbox')).toHaveAttribute('aria-readonly', 'true');
  await expect(page.getByRole('textbox')).toContainText('Draft');
  await expect(
    page.locator('[data-inkspan-form-field][name="message_body"]'),
  ).toBeDisabled();
  await expect(
    page.locator('[data-inkspan-form-field][name="message_body"]'),
  ).toHaveValue('# Draft');
  await expect(page.getByRole('button', { name: 'Save document' })).toBeDisabled();
  await expect(page.getByRole('button', { name: 'Reset draft' })).toBeDisabled();
  await expect(page.getByText('Loading buyer editor')).toHaveCount(0);

  await expect
    .poll(() =>
      page.evaluate(() => {
        const hostWindow = window as typeof window & {
          referenceHostSubmissions?: string[];
        };
        return hostWindow.referenceHostSubmissions ?? [];
      }),
    )
    .toEqual([]);

  expect(rejectedRequests).toEqual([]);
  expect(pageErrors).toEqual([]);
  expect(
    consoleErrors.filter((message) =>
      /hydration|did not match|server html/iu.test(message),
    ),
  ).toEqual([]);
});
