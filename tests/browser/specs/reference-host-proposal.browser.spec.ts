import { expect, test, type Page } from '@playwright/test';

const proposalUrl = '/examples/reference-host/browser-host.html?journey=proposal';
const suggestionText = 'An example suggestion for this draft.';

async function openProposal(page: Page, suffix = '') {
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));
  page.on('console', (message) => { if (message.type() === 'error') errors.push(message.text()); });
  await page.route('**/*', async (route) => {
    if (new URL(route.request().url()).origin === 'http://127.0.0.1:4173') await route.continue();
    else { errors.push('Unexpected external request'); await route.abort(); }
  });
  await page.goto(`${proposalUrl}${suffix}`);
  await expect(page.getByRole('heading', { name: 'Review a suggested change' })).toBeVisible();
  await expect(page.getByRole('textbox', { name: 'Draft' })).toHaveText('Draft');
  return errors;
}

async function replaceDraft(page: Page, text: string) {
  const textbox = page.getByRole('textbox', { name: 'Draft' });
  await textbox.focus();
  await page.keyboard.press('ControlOrMeta+A');
  await page.keyboard.insertText(text);
  await expect(textbox).toHaveText(text);
}

test('reviews a local suggestion and applies it only after confirmation', async ({ page }) => {
  const errors = await openProposal(page);
  await page.getByRole('button', { name: 'Prepare example suggestion' }).click();
  await expect(page.getByRole('status')).toHaveText('Suggestion ready. Review it before applying.');
  await expect(page.getByRole('blockquote')).toHaveText(suggestionText);
  page.once('dialog', (dialog) => dialog.dismiss());
  await page.getByRole('button', { name: 'Apply suggestion', exact: true }).click();
  await expect(page.getByRole('textbox', { name: 'Draft' })).toHaveText('Draft');
  page.once('dialog', (dialog) => dialog.accept());
  await page.getByRole('button', { name: 'Apply suggestion', exact: true }).click();
  await expect(page.getByRole('status')).toHaveText('Suggestion applied. Nothing has been saved.');
  await expect(page.getByRole('textbox', { name: 'Draft' })).toHaveText(suggestionText);
  await expect(page.getByRole('textbox', { name: 'Draft' })).toBeFocused();
  expect(errors).toEqual([]);
});

test('rejects a suggestion prepared before newer local edits', async ({ page }) => {
  const errors = await openProposal(page);
  await page.getByRole('button', { name: 'Prepare example suggestion' }).click();
  await expect(page.getByRole('status')).toHaveText('Suggestion ready. Review it before applying.');
  await replaceDraft(page, 'My newer draft must stay');
  page.once('dialog', (dialog) => dialog.accept());
  await page.getByRole('button', { name: 'Apply suggestion', exact: true }).click();
  await expect(page.getByRole('status')).toHaveText('Your draft changed. Prepare a new suggestion.');
  await expect(page.getByRole('textbox', { name: 'Draft' })).toHaveText('My newer draft must stay');
  expect(errors).toEqual([]);
});
