import { expect, test, type Page } from '@playwright/test';

const collaborationUrl = '/examples/reference-host/browser-host.html?journey=collaboration';

async function openCollaboration(page: Page, suffix = '') {
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));
  page.on('console', (message) => { if (message.type() === 'error') errors.push(message.text()); });
  await page.route('**/*', async (route) => {
    if (new URL(route.request().url()).origin === 'http://127.0.0.1:4173') await route.continue();
    else { errors.push('Unexpected external request'); await route.abort(); }
  });
  await page.goto(`${collaborationUrl}${suffix}`);
  await expect(page.getByRole('heading', { name: 'Try a local collaboration session' })).toBeVisible();
  return errors;
}

async function replaceDraft(page: Page, text: string) {
  const textbox = page.getByRole('textbox', { name: 'Your draft', exact: true });
  await textbox.focus();
  await page.keyboard.press('ControlOrMeta+A');
  await page.keyboard.insertText(text);
  await expect(textbox).toHaveText(text);
}

async function events(page: Page) {
  return page.evaluate(() => (window as typeof window & { referenceHostCollaborationEvents: string[] }).referenceHostCollaborationEvents);
}

test('synchronizes local views, replaces the connection and confirms final teardown', async ({ page }) => {
  const errors = await openCollaboration(page);
  await page.getByRole('button', { name: 'Start local session', exact: true }).click();
  await replaceDraft(page, 'My local shared draft');
  await expect(page.getByRole('textbox', { name: 'Other local view', exact: true })).toHaveText('My local shared draft');
  await page.getByRole('button', { name: 'Reconnect', exact: true }).click();
  await expect(page.locator('output')).toHaveText('Local views connected. Nothing is saved or sent to a server.');
  await expect(page.getByRole('textbox', { name: 'Your draft', exact: true })).toHaveText('My local shared draft');
  await replaceDraft(page, 'Still shared after reconnect');
  await expect(page.getByRole('textbox', { name: 'Other local view', exact: true })).toHaveText('Still shared after reconnect');
  expect((await events(page)).filter((event) => event.startsWith('authorize:'))).toEqual(['authorize:1', 'authorize:2']);
  expect((await events(page)).filter((event) => event.startsWith('provider:destroy:'))).toEqual(['provider:destroy:1']);
  page.once('dialog', (dialog) => dialog.dismiss());
  await page.getByRole('button', { name: 'Close local session', exact: true }).click();
  await expect(page.getByRole('textbox', { name: 'Your draft', exact: true })).toHaveText('Still shared after reconnect');
  page.once('dialog', (dialog) => dialog.accept());
  await page.getByRole('button', { name: 'Close local session', exact: true }).click();
  await expect(page.getByRole('textbox')).toHaveCount(0);
  expect((await events(page)).filter((event) => event.startsWith('document:destroy:')).sort()).toEqual(['document:destroy:local', 'document:destroy:peer']);
  expect(errors).toEqual([]);
});

test('denies provider construction before starting and permits a later authorized session', async ({ page }) => {
  const errors = await openCollaboration(page);
  await page.getByLabel('Allow the next local connection').uncheck();
  await page.getByRole('button', { name: 'Start local session', exact: true }).click();
  await expect(page.locator('output')).toHaveText('The local connection is not allowed. Enable the demo permission and try again.');
  await expect(page.getByRole('textbox')).toHaveCount(0);
  expect((await events(page)).filter((event) => event.startsWith('provider:create:'))).toEqual([]);
  await page.getByLabel('Allow the next local connection').check();
  await page.getByRole('button', { name: 'Start local session', exact: true }).click();
  await replaceDraft(page, 'Allowed local draft');
  await expect(page.getByRole('textbox', { name: 'Other local view', exact: true })).toHaveText('Allowed local draft');
  expect(errors).toEqual([]);
});
