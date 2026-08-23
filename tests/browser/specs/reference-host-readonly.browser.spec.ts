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

  page.on('pageerror', (error) => {
    pageErrors.push(error.message);
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

  return { rejectedRequests, pageErrors };
}

test('keeps the read-only reference host inert at the native-form write boundary', async ({
  page,
}) => {
  const evidence = await observeReferenceHost(page);
  const response = await page.goto(`${REFERENCE_HOST_URL}?readOnly=1`);
  expect(response?.ok()).toBe(true);

  const textbox = page.getByRole('textbox');
  const field = page.locator(
    '[data-inkspan-form-field][name="message_body"]',
  );
  const saveButton = page.getByRole('button', { name: 'Save document' });
  const resetButton = page.getByRole('button', { name: 'Reset draft' });
  const form = page.locator('form');

  await expect(textbox).toBeVisible();
  await expect(textbox).toHaveAttribute('contenteditable', 'false');
  await expect(textbox).toHaveText('Draft');
  await expect(field).toBeDisabled();
  await expect(field).toHaveValue('# Draft');
  await expect(saveButton).toBeDisabled();
  await expect(resetButton).toBeDisabled();

  await form.evaluate((element) => {
    element.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));
    element.dispatchEvent(new Event('reset', { bubbles: true, cancelable: true }));
  });

  await expect(textbox).toHaveText('Draft');
  await expect(field).toHaveValue('# Draft');
  expect(await page.evaluate(() => window.referenceHostSubmissions)).toEqual([]);
  expect(evidence.rejectedRequests).toEqual([]);
  expect(evidence.pageErrors).toEqual([]);
});
