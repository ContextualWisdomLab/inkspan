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

test('captures the original draft before delayed preparation and admits only one preparation', async ({ page }) => {
  await page.addInitScript(() => {
    const digest = crypto.subtle.digest.bind(crypto.subtle);
    const observed = window as typeof window & { releasePreparation?: () => void; preparationCaptures: number };
    observed.preparationCaptures = 0;
    crypto.subtle.digest = async (algorithm, data) => {
      const result = await digest(algorithm, data);
      observed.preparationCaptures += 1;
      if (observed.preparationCaptures === 1) {
        await new Promise<void>((resolve) => { observed.releasePreparation = resolve; });
      }
      return result;
    };
  });
  const errors = await openProposal(page);
  await page.getByRole('button', { name: 'Prepare example suggestion' }).evaluate((button: HTMLButtonElement) => { button.click(); button.click(); });
  await expect.poll(() => page.evaluate(() => typeof (window as typeof window & { releasePreparation?: () => void }).releasePreparation)).toBe('function');
  await expect(page.getByRole('status')).toHaveText('Preparing a local suggestion…');
  expect(await page.evaluate(() => (window as typeof window & { preparationCaptures: number }).preparationCaptures)).toBe(1);
  await replaceDraft(page, 'New text during suggestion preparation');
  await page.evaluate(() => (window as typeof window & { releasePreparation?: () => void }).releasePreparation?.());
  await expect(page.getByRole('status')).toHaveText('Suggestion ready. Review it before applying.');
  page.once('dialog', (dialog) => dialog.accept());
  await page.getByRole('button', { name: 'Apply suggestion', exact: true }).click();
  await expect(page.getByRole('status')).toHaveText('Your draft changed. Prepare a new suggestion.');
  await expect(page.getByRole('textbox', { name: 'Draft' })).toHaveText('New text during suggestion preparation');
  expect(errors).toEqual([]);
});

test('preserves edits during asynchronous application and admits only one apply', async ({ page }) => {
  await page.addInitScript(() => {
    const digest = crypto.subtle.digest.bind(crypto.subtle);
    const observed = window as typeof window & { releaseSuggestionDigest?: () => void; proposalConfirmations: number };
    observed.proposalConfirmations = 0;
    let delayed = false;
    crypto.subtle.digest = async (algorithm, data) => {
      const result = await digest(algorithm, data);
      if (!delayed && new TextDecoder().decode(data).includes('An example suggestion for this draft.')) {
        delayed = true;
        await new Promise<void>((resolve) => { observed.releaseSuggestionDigest = resolve; });
      }
      return result;
    };
    window.confirm = () => { observed.proposalConfirmations += 1; return true; };
  });
  const errors = await openProposal(page);
  await page.getByRole('button', { name: 'Prepare example suggestion' }).click();
  await expect(page.getByRole('status')).toHaveText('Suggestion ready. Review it before applying.');
  await page.getByRole('button', { name: 'Apply suggestion', exact: true }).evaluate((button: HTMLButtonElement) => {
    button.click();
    button.click();
    Array.from(document.querySelectorAll('button')).find((candidate) => candidate.textContent === 'Discard suggestion')?.click();
  });
  await expect.poll(() => page.evaluate(() => typeof (window as typeof window & { releaseSuggestionDigest?: () => void }).releaseSuggestionDigest)).toBe('function');
  expect(await page.evaluate(() => (window as typeof window & { proposalConfirmations: number }).proposalConfirmations)).toBe(1);
  await expect(page.getByRole('button', { name: 'Discard suggestion' })).toBeDisabled();
  await replaceDraft(page, 'New text while the suggestion is being checked');
  await page.evaluate(() => (window as typeof window & { releaseSuggestionDigest?: () => void }).releaseSuggestionDigest?.());
  await expect(page.getByRole('status')).toHaveText('Your draft changed. Prepare a new suggestion.');
  await expect(page.getByRole('textbox', { name: 'Draft' })).toHaveText('New text while the suggestion is being checked');
  await page.getByRole('button', { name: 'Prepare example suggestion' }).click();
  await expect(page.getByRole('status')).toHaveText('Suggestion ready. Review it before applying.');
  await page.getByRole('button', { name: 'Apply suggestion', exact: true }).click();
  await expect(page.getByRole('status')).toHaveText('Suggestion applied. Nothing has been saved.');
  await expect(page.getByRole('textbox', { name: 'Draft' })).toHaveText(suggestionText);
  expect(errors).toEqual([]);
});

test('supports keyboard discard and narrow forced-color review while read-only prevents preparation', async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 780 });
  await page.emulateMedia({ forcedColors: 'active' });
  const errors = await openProposal(page);
  await page.getByRole('button', { name: 'Prepare example suggestion' }).click();
  await expect(page.getByRole('status')).toHaveText('Suggestion ready. Review it before applying.');
  await page.getByRole('button', { name: 'Discard suggestion' }).focus();
  expect(await page.evaluate(() => matchMedia('(forced-colors: active)').matches)).toBe(true);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await page.screenshot({ path: test.info().outputPath('proposal-review-320.png'), fullPage: true });
  await page.keyboard.press('Enter');
  await expect(page.getByRole('status')).toHaveText('Edit your draft or prepare an example suggestion.');
  await expect(page.getByRole('textbox', { name: 'Draft' })).toHaveText('Draft');
  await expect(page.getByRole('textbox', { name: 'Draft' })).toBeFocused();
  await page.emulateMedia({ media: 'print' });
  await expect(page.getByRole('button', { name: 'Prepare example suggestion' })).not.toBeVisible();
  await expect(page.getByRole('textbox', { name: 'Draft' })).toBeVisible();
  await page.emulateMedia({ media: 'screen' });
  await page.goto(`${proposalUrl}&readOnly=1`);
  await expect(page.getByRole('textbox', { name: 'Draft' })).toHaveAttribute('contenteditable', 'false');
  await expect(page.getByRole('button', { name: 'Prepare example suggestion' })).toBeDisabled();
  expect(errors).toEqual([]);
});

test('contains a failed revision capture without exposing its private cause or changing the draft', async ({ page }) => {
  await page.addInitScript(() => {
    crypto.subtle.digest = async () => { throw new Error('Private digest failure detail'); };
  });
  const errors = await openProposal(page);
  await page.getByRole('button', { name: 'Prepare example suggestion' }).click();
  await expect(page.getByRole('status')).toHaveText('The suggestion could not be used. Your draft is still here.');
  await expect(page.getByRole('textbox', { name: 'Draft' })).toHaveText('Draft');
  await expect(page.getByText('Private digest failure detail')).toHaveCount(0);
  await expect(page.getByRole('button', { name: 'Prepare example suggestion' })).toBeEnabled();
  expect(errors).toEqual([]);
});
