import { expect, test } from '@playwright/test';

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

test('invalidates a completed save claim after the buyer edits the packed editor again', async ({
  page,
}) => {
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

  const response = await page.goto(REFERENCE_HOST_URL);
  expect(response?.ok()).toBe(true);

  const editor = page.getByRole('textbox');
  const field = page.locator(
    '[data-inkspan-form-field][name="message_body"]',
  );
  await expect(editor).toBeVisible();
  await expect(field).toHaveValue('# Draft');

  await page.getByRole('button', { name: 'Save document' }).click();
  await expect(page.getByText('Saved')).toBeVisible();

  await editor.click();
  await page.keyboard.press('Control+A');
  await page.keyboard.type('Edited after save');

  await expect(field).not.toHaveValue('# Draft');
  await expect(page.getByText('Saved')).toHaveCount(0);
  await expect(page.getByText('Not saved yet')).toBeVisible();
  expect(rejectedRequests).toEqual([]);
  expect(pageErrors).toEqual([]);
});
