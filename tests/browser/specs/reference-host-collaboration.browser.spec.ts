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
  await expect(page.getByRole('button', { name: 'Start local session', exact: true })).toBeFocused();
  await page.keyboard.press('Enter');
  await expect(page.getByRole('textbox', { name: 'Your draft', exact: true })).toBeEmpty();
  expect(errors).toEqual([]);
});

test('replaces an indeterminate connection without duplicate admission or stale listeners', async ({ page }) => {
  const errors = await openCollaboration(page);
  await page.getByLabel('Fail the next connection').check();
  await page.getByRole('button', { name: 'Start local session', exact: true }).evaluate((button: HTMLButtonElement) => { button.click(); button.click(); });
  await expect(page.locator('output')).toHaveText('The connection could not be confirmed. Reconnect to try again; your local draft is still here.');
  await expect(page.locator('body')).not.toContainText('Disconnected');
  await expect(page.locator('body')).not.toContainText('private local connection fixture cause');
  expect((await events(page)).filter((event) => event.startsWith('provider:create:'))).toEqual(['provider:create:1']);
  await replaceDraft(page, 'Draft after uncertain connection');
  await page.getByRole('button', { name: 'Reconnect', exact: true }).evaluate((button: HTMLButtonElement) => { button.click(); button.click(); });
  await expect(page.locator('output')).toHaveText('Local views connected. Nothing is saved or sent to a server.');
  await expect(page.getByRole('textbox', { name: 'Other local view', exact: true })).toHaveText('Draft after uncertain connection');
  const recorded = await events(page);
  expect(recorded.indexOf('provider:destroy:1')).toBeLessThan(recorded.indexOf('provider:create:2'));
  expect(recorded.filter((event) => event.startsWith('provider:create:'))).toEqual(['provider:create:1', 'provider:create:2']);
  await replaceDraft(page, 'Only the new connection receives this');
  expect((await events(page)).slice(recorded.length).filter((event) => event.startsWith('provider:forward:'))).not.toContain('provider:forward:1');
  await expect(page.getByRole('textbox', { name: 'Other local view', exact: true })).toHaveText('Only the new connection receives this');
  expect(errors).toEqual([]);
});

test('rechecks admission on replacement and preserves disconnected edits for authorized retry', async ({ page }) => {
  const errors = await openCollaboration(page);
  await page.getByRole('button', { name: 'Start local session', exact: true }).click();
  await replaceDraft(page, 'Last connected draft');
  await page.getByLabel('Allow the next local connection').uncheck();
  await page.getByRole('button', { name: 'Reconnect', exact: true }).click();
  await expect(page.locator('output')).toContainText('The local connection is not allowed.');
  await replaceDraft(page, 'Kept while disconnected');
  await expect(page.getByRole('textbox', { name: 'Other local view', exact: true })).toHaveText('Last connected draft');
  await page.getByLabel('Allow the next local connection').check();
  await page.getByRole('button', { name: 'Reconnect', exact: true }).click();
  await expect(page.getByRole('textbox', { name: 'Other local view', exact: true })).toHaveText('Kept while disconnected');
  expect((await events(page)).filter((event) => event.startsWith('authorize:'))).toEqual(['authorize:1', 'authorize:2', 'authorize:3']);
  expect((await events(page)).filter((event) => event.startsWith('provider:create:'))).toEqual(['provider:create:1', 'provider:create:3']);
  expect(errors).toEqual([]);
});

test('keeps read-only local views usable at 320px, in forced colors and print', async ({ page }, testInfo) => {
  await page.setViewportSize({ width: 320, height: 900 });
  await page.emulateMedia({ forcedColors: 'active' });
  const errors = await openCollaboration(page, '&readOnly=1');
  await page.getByRole('button', { name: 'Start local session', exact: true }).click();
  await expect(page.getByRole('textbox', { name: 'Your draft', exact: true })).toHaveAttribute('contenteditable', 'false');
  await expect(page.getByRole('textbox', { name: 'Other local view', exact: true })).toHaveAttribute('contenteditable', 'false');
  expect(await page.evaluate(() => matchMedia('(forced-colors: active)').matches)).toBe(true);
  expect(await page.evaluate(() => Math.max(document.documentElement.scrollWidth, document.body.scrollWidth))).toBeLessThanOrEqual(320);
  await page.screenshot({ path: testInfo.outputPath('collaboration-320.png'), fullPage: true });
  await page.emulateMedia({ media: 'print' });
  await expect(page.getByRole('button', { name: 'Reconnect', exact: true })).toBeHidden();
  await expect(page.getByRole('textbox', { name: 'Your draft', exact: true })).toBeVisible();
  expect(errors).toEqual([]);
});

test('tears down the actual host documents and connection when the application unmounts', async ({ page }) => {
  const errors = await openCollaboration(page);
  await page.getByRole('button', { name: 'Start local session', exact: true }).click();
  await replaceDraft(page, 'Draft before leaving');
  await page.evaluate(() => (window as typeof window & { referenceHostUnmount: () => void }).referenceHostUnmount());
  await expect(page.getByRole('textbox')).toHaveCount(0);
  const recorded = await events(page);
  expect(recorded.filter((event) => event.startsWith('document:destroy:')).sort()).toEqual(['document:destroy:local', 'document:destroy:peer']);
  expect(recorded.filter((event) => event.startsWith('provider:destroy:'))).toEqual(['provider:destroy:1']);
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
