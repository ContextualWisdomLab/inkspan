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

async function failUnexpectedNetwork(page: Page) {
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

test('invalidates a completed save claim after the buyer edits the packed editor again', async ({
  page,
}) => {
  const { rejectedRequests, pageErrors } = await failUnexpectedNetwork(page);
  const response = await page.goto(REFERENCE_HOST_URL);
  expect(response?.ok()).toBe(true);

  const editor = page.getByRole('textbox');
  const field = page.locator(
    '[data-inkspan-form-field][name="message_body"]',
  );
  await expect(editor).toBeVisible();
  await expect(field).toHaveValue('# Draft');

  await page.getByRole('button', { name: 'Save document' }).click();
  await expect(page.getByText('Saved', { exact: true })).toBeVisible();

  await editor.click();
  await page.keyboard.press('Control+A');
  await page.keyboard.type('Edited after save');

  await expect(field).not.toHaveValue('# Draft');
  await expect(page.getByText('Saved', { exact: true })).toHaveCount(0);
  await expect(page.getByText('Not saved yet', { exact: true })).toBeVisible();
  expect(rejectedRequests).toEqual([]);
  expect(pageErrors).toEqual([]);
});

test('does not claim a newer document is saved when the submitted version settles later', async ({
  page,
}) => {
  const { rejectedRequests, pageErrors } = await failUnexpectedNetwork(page);
  const response = await page.goto(`${REFERENCE_HOST_URL}?deferSubmission=1`);
  expect(response?.ok()).toBe(true);

  const editor = page.getByRole('textbox');
  const saveButton = page.getByRole('button', { name: 'Save document' });
  await expect(editor).toBeVisible();

  await editor.click();
  await page.keyboard.press('Control+A');
  await page.keyboard.type('Submitted version');
  await saveButton.click();
  await expect(page.getByText('Saving…', { exact: true })).toBeVisible();
  await expect(saveButton).toBeDisabled();

  await editor.click();
  await page.keyboard.press('Control+A');
  await page.keyboard.type('Newer unsaved version');
  await page.evaluate(() => window.referenceHostResolveSubmission?.());

  await expect(page.getByText('Saving…', { exact: true })).toHaveCount(0);
  await expect(page.getByText('Saved', { exact: true })).toHaveCount(0);
  await expect(page.getByText('Not saved yet', { exact: true })).toBeVisible();
  expect(await page.evaluate(() => window.referenceHostSubmissions)).toEqual([
    'Submitted version',
  ]);
  expect(rejectedRequests).toEqual([]);
  expect(pageErrors).toEqual([]);
});

test('blocks a same-turn native reset after durable submission admission before React presentation commits', async ({
  page,
}) => {
  const { rejectedRequests, pageErrors } = await failUnexpectedNetwork(page);
  const response = await page.goto(`${REFERENCE_HOST_URL}?deferSubmission=1`);
  expect(response?.ok()).toBe(true);

  const editor = page.getByRole('textbox');
  const field = page.locator(
    '[data-inkspan-form-field][name="message_body"]',
  );
  await expect(editor).toBeVisible();

  await editor.click();
  await page.keyboard.press('Control+A');
  await page.keyboard.type('Durable gate payload');
  await expect(field).toHaveValue('Durable gate payload');

  await page.evaluate(() => {
    const form = document.querySelector('form');
    if (!(form instanceof HTMLFormElement)) {
      throw new Error('Reference host form is missing.');
    }
    form.requestSubmit();
    form.reset();
  });

  await expect(field).toHaveValue('Durable gate payload');
  expect(await page.evaluate(() => window.referenceHostSubmissions)).toEqual([
    'Durable gate payload',
  ]);

  await page.evaluate(() => window.referenceHostResolveSubmission?.());
  await expect(page.getByText('Saved', { exact: true })).toBeVisible();
  expect(rejectedRequests).toEqual([]);
  expect(pageErrors).toEqual([]);
});
