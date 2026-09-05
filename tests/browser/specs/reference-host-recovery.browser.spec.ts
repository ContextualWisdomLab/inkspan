import { expect, test, type Page } from '@playwright/test';

const recoveryUrl = '/examples/reference-host/browser-host.html?journey=recovery';

async function openRecovery(page: Page, suffix = '', initialText = 'Draft') {
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
  await expect(page.getByRole('textbox')).toHaveText(initialText);
  expect((await savedDocuments(page)).originalValidator).toBe('"v1"');
  return errors;
}

async function savedDocuments(page: Page) {
  return page.evaluate(() => window.referenceHostSavedDocuments());
}

async function replaceDraft(page: Page, text: string) {
  const textbox = page.getByRole('textbox');
  await textbox.focus();
  await page.keyboard.press('ControlOrMeta+A');
  await page.keyboard.insertText(text);
  await expect(textbox).toHaveText(text);
}

for (const forcedColors of ['none', 'active'] as const) {
  test(`keeps host control styles outside the editor toolbar with forced colors ${forcedColors}`, async ({ page }) => {
    await page.setViewportSize({ width: 320, height: 800 });
    await page.emulateMedia({ forcedColors });
    const errors = await openRecovery(page);
    const styles = await page.getByRole('button', { name: 'Delete row', exact: true }).evaluate((button) => {
      const properties = ['fontSize', 'fontWeight', 'lineHeight', 'paddingTop', 'paddingBottom', 'height', 'minBlockSize'] as const;
      const readStyles = () => {
        const computed = getComputedStyle(button);
        return Object.fromEntries(properties.map((property) => [property, computed[property]]));
      };
      const host = button.closest('.reference-recovery')!;
      const insideHost = readStyles();
      host.classList.remove('reference-recovery');
      try {
        return { insideHost, withoutHost: readStyles() };
      } finally {
        host.classList.add('reference-recovery');
      }
    });
    await page.screenshot({ path: test.info().outputPath('toolbar-style-boundary-320.png'), fullPage: true });
    expect(styles.insideHost).toEqual(styles.withoutHost);
    const selectBounds = await page.getByLabel('Next save in this demo').boundingBox();
    expect(selectBounds!.height).toBeGreaterThanOrEqual(44);
    expect(errors).toEqual([]);
  });
}

test('saves the newest queued edit and never calls an older submitted draft current', async ({ page }) => {
  const errors = await openRecovery(page);
  await page.getByLabel('Next save in this demo').selectOption('deferred');
  await replaceDraft(page, 'First submitted draft');
  await expect(page.getByRole('status')).toHaveText('Saving changes…');
  await replaceDraft(page, 'Newest draft');
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
    await replaceDraft(page, 'My recoverable draft');
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
  await replaceDraft(page, 'My conflicting draft');
  await expect(page.getByRole('status')).toHaveText('Another version was saved. Your draft is still here.');
  await page.screenshot({ path: test.info().outputPath('recovery-conflict-desktop.png'), fullPage: true });
  const original = (await savedDocuments(page)).original;
  expect(original).toContain('Draft saved elsewhere.');
  await replaceDraft(page, 'My newest conflicting draft');
  const copyButton = page.getByRole('button', { name: 'Save my draft as a separate copy' });
  await expect(copyButton).toBeEnabled();
  await copyButton.evaluate((button: HTMLButtonElement) => { button.click(); button.click(); });
  await expect(page.getByRole('status')).toHaveText('Separate copy saved. The original was not changed.');
  await expect(page.getByRole('textbox')).toHaveText('My newest conflicting draft');
  expect((await savedDocuments(page)).original).toBe(original);
  expect((await savedDocuments(page)).copies[0]).toContain('My newest conflicting draft');
  expect((await savedDocuments(page)).copies).toHaveLength(1);
  await replaceDraft(page, 'Continue in my copy');
  await expect(page.getByRole('status')).toHaveText('All changes saved in this demo.');
  expect((await savedDocuments(page)).original).toBe(original);
  expect((await savedDocuments(page)).copies[0]).toContain('Continue in my copy');
  expect(errors).toEqual([]);
});

test('keeps recovery usable at 320px with keyboard and forced colors; read-only never writes', async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 780 });
  await page.emulateMedia({ forcedColors: 'active' });
  const errors = await openRecovery(page);
  expect(await page.evaluate(() => matchMedia('(forced-colors: active)').matches)).toBe(true);
  await page.getByLabel('Next save in this demo').selectOption('failure');
  await replaceDraft(page, 'Keyboard recovery');
  const retryButton = page.getByRole('button', { name: 'Check saved copy and retry' });
  await expect(retryButton).toBeEnabled();
  await retryButton.focus();
  await page.screenshot({ path: test.info().outputPath('recovery-retry-320-forced-colors.png'), fullPage: true });
  await page.keyboard.press('Enter');
  await expect(page.getByRole('status')).toHaveText('Draft recovered and saved in this demo.');
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await page.screenshot({ path: test.info().outputPath('recovery-320-forced-colors.png'), fullPage: true });
  await page.emulateMedia({ media: 'print', forcedColors: 'none' });
  await expect(page.getByRole('textbox')).toHaveText('Keyboard recovery');
  await expect(page.getByLabel('Next save in this demo')).not.toBeVisible();
  await page.screenshot({ path: test.info().outputPath('recovery-print.png'), fullPage: true });
  await page.emulateMedia({ media: 'screen' });
  await page.goto(`${recoveryUrl}&readOnly=1`);
  await expect(page.getByRole('textbox')).toHaveAttribute('contenteditable', 'false');
  await expect(page.getByLabel('Next save in this demo')).toBeDisabled();
  await expect(page.getByRole('button', { name: 'Use saved version', exact: true })).toHaveCount(0);
  expect((await savedDocuments(page)).originalValidator).toBe('"v1"');
  expect(errors).toEqual([]);
});

test('recovers newer local edits after a lost confirmation and admits a same-turn retry only once', async ({ page }) => {
  const errors = await openRecovery(page);
  await page.getByLabel('Next save in this demo').selectOption('ambiguous_commit_failure');
  await replaceDraft(page, 'Committed without confirmation');
  await expect(page.getByRole('status')).toContainText('Save not confirmed');
  await replaceDraft(page, 'Newer local edit');
  const retryButton = page.getByRole('button', { name: 'Check saved copy and retry' });
  await expect(retryButton).toBeEnabled();
  await retryButton.evaluate((button: HTMLButtonElement) => { button.click(); button.click(); });
  await expect(page.getByRole('status')).toHaveText('Draft recovered and saved in this demo.');
  expect((await savedDocuments(page)).original).toContain('Newer local edit');
  expect((await savedDocuments(page)).originalValidator).toBe('"v3"');
  expect(errors).toEqual([]);
});

test('does not overwrite a competing save that arrives after the recovery reread', async ({ page }) => {
  const errors = await openRecovery(page);
  await page.getByLabel('Next save in this demo').selectOption('failure');
  await replaceDraft(page, 'Keep my version');
  await expect(page.getByRole('status')).toContainText('Save not confirmed');
  await page.getByLabel('Next save in this demo').selectOption('conflict');
  await page.getByRole('button', { name: 'Check saved copy and retry' }).click();
  await expect(page.getByRole('status')).toHaveText('Another version was saved. Your draft is still here.');
  await expect(page.getByRole('textbox')).toHaveText('Keep my version');
  expect((await savedDocuments(page)).original).toContain('Draft saved elsewhere.');
  expect((await savedDocuments(page)).originalValidator).toBe('"v2"');
  expect(errors).toEqual([]);
});

test('ignores an older digest that settles after a newer draft has saved', async ({ page }) => {
  await page.addInitScript(() => {
    const digest = crypto.subtle.digest.bind(crypto.subtle);
    const pending = window as typeof window & { releaseOldDigest?: () => void; oldDigestFinished?: boolean };
    crypto.subtle.digest = async (algorithm, data) => {
      const result = await digest(algorithm, data);
      if (new TextDecoder().decode(data).includes('Older slow draft')) {
        await new Promise<void>((resolve) => { pending.releaseOldDigest = resolve; });
        pending.oldDigestFinished = true;
      }
      return result;
    };
  });
  const errors = await openRecovery(page);
  await replaceDraft(page, 'Older slow draft');
  await expect.poll(() => page.evaluate(() => typeof (window as Window & { releaseOldDigest?: () => void }).releaseOldDigest)).toBe('function');
  await replaceDraft(page, 'Newer fast draft');
  await expect(page.getByRole('textbox')).toHaveText('Newer fast draft');
  await expect(page.getByRole('status')).toHaveText('All changes saved in this demo.');
  await page.evaluate(() => (window as Window & { releaseOldDigest?: () => void }).releaseOldDigest?.());
  await expect.poll(() => page.evaluate(() => (window as Window & { oldDigestFinished?: boolean }).oldDigestFinished)).toBe(true);
  expect((await savedDocuments(page)).original).toContain('Newer fast draft');
  expect((await savedDocuments(page)).originalValidator).toBe('"v2"');
  await expect(page.getByRole('textbox')).toHaveText('Newer fast draft');
  expect(errors).toEqual([]);
});

test('does not report an oversized unsaved draft as saved when an older request finishes', async ({ page }) => {
  const errors = await openRecovery(page);
  await page.getByLabel('Next save in this demo').selectOption('deferred');
  await replaceDraft(page, 'Earlier accepted draft');
  await expect(page.getByRole('status')).toHaveText('Saving changes…');
  await replaceDraft(page, 'x'.repeat(65_537));
  const failedPreparation = 'Changes could not be prepared. Your draft is still here; shorten it and try again.';
  await expect(page.getByRole('status')).toHaveText(failedPreparation);
  await page.getByRole('button', { name: 'Finish pending save' }).click();
  await expect.poll(async () => (await savedDocuments(page)).original).toContain('Earlier accepted draft');
  await expect(page.getByRole('status')).toHaveText(failedPreparation);
  await expect(page.getByRole('textbox')).toHaveText('x'.repeat(65_537));
  await replaceDraft(page, 'Shortened recoverable draft');
  await expect(page.getByRole('status')).toHaveText('All changes saved in this demo.');
  expect((await savedDocuments(page)).original).toContain('Shortened recoverable draft');
  expect(errors).toEqual([]);
});

test('opens the stored rich document before enabling edits without rewriting it', async ({ page }) => {
  const errors = await openRecovery(page, '&savedDraft=1', 'Saved headingPreviously saved draft');
  await expect(page.getByRole('textbox').getByRole('heading', { name: 'Saved heading', level: 2 })).toBeVisible();
  await expect(page.getByRole('textbox').locator('strong')).toHaveText('Previously saved draft');
  await expect(page.getByRole('status')).toHaveText('All changes saved in this demo.');
  expect((await savedDocuments(page)).originalValidator).toBe('"v1"');
  expect((await savedDocuments(page)).original).toContain('\n');
  expect(errors).toEqual([]);
});

test('keeps an unreadable stored draft untouched and does not enable replacement editing', async ({ page }) => {
  const errors = await openRecovery(page, '&savedDraft=invalid', '');
  await expect(page.getByRole('status')).toHaveText('The saved draft could not be opened. Nothing was changed.');
  await expect(page.getByRole('textbox')).toHaveAttribute('contenteditable', 'false');
  await expect(page.getByLabel('Next save in this demo')).toBeDisabled();
  expect((await savedDocuments(page)).original).toBe('Invalid stored draft');
  expect((await savedDocuments(page)).originalValidator).toBe('"v1"');
  expect(errors).toEqual([]);
});

test('uses the saved version only after confirmation and resumes saving against its current version', async ({ page }) => {
  const errors = await openRecovery(page);
  await page.getByLabel('Next save in this demo').selectOption('conflict');
  await replaceDraft(page, 'My unsaved draft');
  await expect(page.getByRole('status')).toContainText('Another version was saved');
  const savedBefore = await savedDocuments(page);
  const restoreButton = page.getByRole('button', { name: 'Use saved version', exact: true });
  await expect(restoreButton).toBeEnabled();
  page.once('dialog', async (dialog) => {
    expect(dialog.type()).toBe('confirm');
    expect(dialog.message()).toContain('replace your unsaved changes');
    await dialog.dismiss();
  });
  await restoreButton.click();
  await expect(page.getByRole('textbox')).toHaveText('My unsaved draft');
  expect(await savedDocuments(page)).toEqual(savedBefore);
  page.once('dialog', (dialog) => dialog.accept());
  await restoreButton.focus();
  await page.keyboard.press('Enter');
  await expect(page.getByRole('status')).toHaveText('Saved version opened. You can continue editing.');
  await expect(page.getByRole('textbox')).toHaveText('Draft saved elsewhere.');
  await expect(page.getByRole('textbox')).toBeFocused();
  expect(await savedDocuments(page)).toEqual(savedBefore);
  await replaceDraft(page, 'Edit after restoring saved version');
  await expect(page.getByRole('status')).toHaveText('All changes saved in this demo.');
  expect((await savedDocuments(page)).original).toContain('Edit after restoring saved version');
  expect((await savedDocuments(page)).originalValidator).toBe('"v3"');
  expect(errors).toEqual([]);
});

test('restores rich saved content without rewriting storage and remains usable at 320px with forced colors', async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 780 });
  await page.emulateMedia({ forcedColors: 'active' });
  const errors = await openRecovery(page, '&savedDraft=1', 'Saved headingPreviously saved draft');
  const savedBefore = await savedDocuments(page);
  await page.getByLabel('Next save in this demo').selectOption('failure');
  await replaceDraft(page, 'Unsaved replacement');
  const restoreButton = page.getByRole('button', { name: 'Use saved version', exact: true });
  await expect(restoreButton).toBeEnabled();
  await restoreButton.focus();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await page.screenshot({ path: test.info().outputPath('restore-320-forced-colors.png'), fullPage: true });
  // A reentrant click must not open a second confirmation before React renders.
  await page.evaluate(() => {
    const observed = window as typeof window & { restoreConfirmationCount: number };
    observed.restoreConfirmationCount = 0;
    window.confirm = () => {
      observed.restoreConfirmationCount += 1;
      if (observed.restoreConfirmationCount === 1) {
        Array.from(document.querySelectorAll('button')).find((button) => button.textContent === 'Use saved version')?.click();
      }
      return true;
    };
  });
  await page.keyboard.press('Enter');
  expect(await page.evaluate(() => (window as typeof window & { restoreConfirmationCount: number }).restoreConfirmationCount)).toBe(1);
  await expect(page.getByRole('status')).toHaveText('Saved version opened. You can continue editing.');
  await expect(page.getByRole('textbox').getByRole('heading', { name: 'Saved heading', level: 2 })).toBeVisible();
  await expect(page.getByRole('textbox').locator('strong')).toHaveText('Previously saved draft');
  expect(await savedDocuments(page)).toEqual(savedBefore);
  expect(errors).toEqual([]);
});

test('refuses a saved version that changes during confirmation and rereads on the next attempt', async ({ page }) => {
  const errors = await openRecovery(page);
  await page.getByLabel('Next save in this demo').selectOption('failure');
  await replaceDraft(page, 'Keep this local draft');
  const restoreButton = page.getByRole('button', { name: 'Use saved version', exact: true });
  await expect(restoreButton).toBeEnabled();
  await page.evaluate(() => {
    const originalConfirm = window.confirm;
    window.confirm = () => {
      window.confirm = originalConfirm;
      window.referenceHostSaveElsewhere(window.referenceHostSavedDocuments().original.replace('Draft', 'New saved content'));
      return true;
    };
  });
  await restoreButton.click();
  await expect(page.getByRole('status')).toHaveText('The draft or saved version changed. Nothing was replaced; try again.');
  await expect(page.getByRole('textbox')).toHaveText('Keep this local draft');
  const savedAfter = await savedDocuments(page);
  expect(savedAfter.original).toContain('New saved content');
  page.once('dialog', (dialog) => dialog.accept());
  await restoreButton.click();
  await expect(page.getByRole('textbox')).toHaveText('New saved content');
  expect(await savedDocuments(page)).toEqual(savedAfter);
  expect(errors).toEqual([]);
});

test('preserves a local edit made during confirmation', async ({ page }) => {
  const errors = await openRecovery(page);
  await page.getByLabel('Next save in this demo').selectOption('failure');
  await replaceDraft(page, 'Keep this local draft');
  const restoreButton = page.getByRole('button', { name: 'Use saved version', exact: true });
  await expect(restoreButton).toBeEnabled();
  const savedBefore = await savedDocuments(page);
  await page.evaluate(() => {
    const originalConfirm = window.confirm;
    window.confirm = () => {
      window.confirm = originalConfirm;
      const textbox = document.querySelector<HTMLElement>('[contenteditable="true"]');
      if (!textbox) throw new Error('Editable draft is unavailable');
      textbox.focus();
      const selection = window.getSelection();
      const range = document.createRange();
      range.selectNodeContents(textbox);
      selection?.removeAllRanges();
      selection?.addRange(range);
      document.execCommand('insertText', false, 'New local edit during confirmation');
      return true;
    };
  });
  await restoreButton.click();
  await expect(page.getByRole('status')).toHaveText('The draft or saved version changed. Nothing was replaced; try again.');
  await expect(page.getByRole('textbox')).toHaveText('New local edit during confirmation');
  expect(await savedDocuments(page)).toEqual(savedBefore);
  expect(errors).toEqual([]);
});

for (const invalidKind of ['json', 'schema']) {
  test(`preserves the draft when the saved version is rejected: ${invalidKind}`, async ({ page }) => {
    const errors = await openRecovery(page);
    await page.getByLabel('Next save in this demo').selectOption('failure');
    await replaceDraft(page, 'Keep my recoverable draft');
    const restoreButton = page.getByRole('button', { name: 'Use saved version', exact: true });
    await expect(restoreButton).toBeEnabled();
    const originalSaved = (await savedDocuments(page)).original;
    const invalidSaved = invalidKind === 'json' ? 'Invalid saved content' : JSON.stringify({
      ...JSON.parse(originalSaved), documentJson: { type: 'doc', content: [{ type: 'unknown-node' }] },
    });
    await page.evaluate((value) => window.referenceHostSaveElsewhere(value), invalidSaved);
    page.once('dialog', (dialog) => dialog.accept());
    await restoreButton.click();
    await expect(page.getByRole('status')).toHaveText('The saved version could not be opened. Your draft is still here.');
    await expect(page.getByRole('textbox')).toHaveText('Keep my recoverable draft');
    expect((await savedDocuments(page)).original).toBe(invalidSaved);
    await page.evaluate((value) => window.referenceHostSaveElsewhere(value), originalSaved);
    page.once('dialog', (dialog) => dialog.accept());
    await restoreButton.click();
    await expect(page.getByRole('textbox')).toHaveText('Draft');
    expect((await savedDocuments(page)).originalValidator).toBe('"v3"');
    expect(errors).toEqual([]);
  });
}

test('restores the active separate copy without reading or overwriting the original', async ({ page }) => {
  const errors = await openRecovery(page);
  await page.getByLabel('Next save in this demo').selectOption('conflict');
  await replaceDraft(page, 'Saved in my copy');
  await page.getByRole('button', { name: 'Save my draft as a separate copy' }).click();
  await expect(page.getByRole('status')).toContainText('Separate copy saved');
  const savedBefore = await savedDocuments(page);
  await page.getByLabel('Next save in this demo').selectOption('failure');
  await replaceDraft(page, 'Unsaved edit to my copy');
  page.once('dialog', (dialog) => dialog.accept());
  await page.getByRole('button', { name: 'Use saved version', exact: true }).click();
  await expect(page.getByRole('textbox')).toHaveText('Saved in my copy');
  expect(await savedDocuments(page)).toEqual(savedBefore);
  await replaceDraft(page, 'Continue editing my restored copy');
  await expect(page.getByRole('status')).toHaveText('All changes saved in this demo.');
  expect((await savedDocuments(page)).copies).toHaveLength(1);
  expect((await savedDocuments(page)).copies[0]).toContain('Continue editing my restored copy');
  expect((await savedDocuments(page)).original).toBe(savedBefore.original);
  expect(errors).toEqual([]);
});
