import { expect, test, type Page } from '@playwright/test';

const recoveryUrl = '/examples/reference-host/browser-host.html?journey=recovery';

async function openRecovery(page: Page, suffix = '') {
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));
  page.on('console', (message) => {
    if (message.type() === 'error') errors.push(message.text());
  });
  await page.route('**/*', async (route) => {
    const requestUrl = new URL(route.request().url());
    if (requestUrl.origin === 'http://127.0.0.1:4173') await route.continue();
    else {
      errors.push('Unexpected external request');
      await route.abort();
    }
  });
  await page.goto(`${recoveryUrl}${suffix}`);
  await expect(page.getByRole('heading', { name: 'Save and recover a draft' })).toBeVisible();
  await expect(page.getByRole('textbox')).toHaveText('Draft');
  return errors;
}

async function savedDocuments(page: Page) {
  return page.evaluate(() => window.referenceHostSavedDocuments());
}

test('saves the newest queued edit and never calls an older submitted draft current', async ({ page }) => {
  const errors = await openRecovery(page);
  await page.getByLabel('Next save in this demo').selectOption('deferred');
  await page.getByRole('textbox').fill('First submitted draft');
  await expect(page.getByRole('status')).toHaveText('Saving changes…');
  await page.getByRole('textbox').fill('Newest draft');
  await expect(page.getByRole('status')).toHaveText('Saving; newer changes are waiting.');
  await page.getByRole('button', { name: 'Finish pending save' }).click();
  await expect(page.getByRole('status')).toHaveText('All changes saved in this demo.');
  expect((await savedDocuments(page)).original).toContain('Newest draft');
  expect(errors).toEqual([]);
});

for (const outcome of ['failure', 'ambiguous_failure', 'ambiguous_commit_failure']) {
  test(`rereads after ${outcome} without losing the local draft or duplicating a confirmed save`, async ({ page }) => {
    const errors = await openRecovery(page);
    await page.getByLabel('Next save in this demo').selectOption(outcome);
    await page.getByRole('textbox').fill('My recoverable draft');
    await expect(page.getByRole('status')).toHaveText('Save not confirmed. Your draft is still here.');
    await expect(page.getByRole('textbox')).toHaveText('My recoverable draft');
    await page.getByRole('button', { name: 'Check saved copy and retry' }).click();
    await expect(page.getByRole('status')).toHaveText('Draft recovered and saved in this demo.');
    const documents = await savedDocuments(page);
    expect(documents.original).toContain('My recoverable draft');
    expect(documents.originalValidator).toBe('"v2"');
    expect(errors).toEqual([]);
  });
}

test('keeps both drafts on conflict and continues autosaving only the separate copy', async ({ page }) => {
  const errors = await openRecovery(page);
  await page.getByLabel('Next save in this demo').selectOption('conflict');
  await page.getByRole('textbox').fill('My conflicting draft');
  await expect(page.getByRole('status')).toHaveText('Another version was saved. Your draft is still here.');
  const original = (await savedDocuments(page)).original;
  expect(original).toContain('Draft saved elsewhere.');
  await page.getByRole('textbox').fill('My newest conflicting draft');
  await page.getByRole('button', { name: 'Save my draft as a separate copy' }).click();
  await expect(page.getByRole('status')).toHaveText('Separate copy saved. The original was not changed.');
  await expect(page.getByRole('textbox')).toHaveText('My newest conflicting draft');
  expect((await savedDocuments(page)).original).toBe(original);
  expect((await savedDocuments(page)).copies[0]).toContain('My newest conflicting draft');
  await page.getByRole('textbox').fill('Continue in my copy');
  await expect(page.getByRole('status')).toHaveText('All changes saved in this demo.');
  expect((await savedDocuments(page)).original).toBe(original);
  expect((await savedDocuments(page)).copies[0]).toContain('Continue in my copy');
  expect(errors).toEqual([]);
});

test('keeps recovery usable at 320px with keyboard and forced colors; read-only never writes', async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 780 });
  await page.emulateMedia({ forcedColors: 'active' });
  const errors = await openRecovery(page);
  await page.getByLabel('Next save in this demo').selectOption('failure');
  await page.getByRole('textbox').fill('Keyboard recovery');
  const retryButton = page.getByRole('button', { name: 'Check saved copy and retry' });
  await expect(retryButton).toBeEnabled();
  await retryButton.focus();
  await page.keyboard.press('Enter');
  await expect(page.getByRole('status')).toHaveText('Draft recovered and saved in this demo.');
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await page.screenshot({ path: test.info().outputPath('recovery-320-forced-colors.png'), fullPage: true });
  await page.emulateMedia({ media: 'print', forcedColors: 'none' });
  await expect(page.getByRole('textbox')).toHaveText('Keyboard recovery');
  await expect(page.getByLabel('Next save in this demo')).not.toBeVisible();
  await page.emulateMedia({ media: 'screen' });
  await page.goto(`${recoveryUrl}&readOnly=1`);
  await expect(page.getByRole('textbox')).toHaveAttribute('contenteditable', 'false');
  await expect(page.getByLabel('Next save in this demo')).toBeDisabled();
  expect((await savedDocuments(page)).originalValidator).toBe('"v1"');
  expect(errors).toEqual([]);
});
