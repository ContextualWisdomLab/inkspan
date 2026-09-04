import { expect, test } from '@playwright/test';

test.beforeEach(async ({ page }) => {
  await page.goto('/tests/browser/harness.html');
  await page.addStyleTag({ url: '/dist/cwl-editor.css' });
  await page.evaluate(() => window.mountInkspanReviewProbe());
});

test('keeps review focus and host intent deterministic across real engines', async ({
  page,
}) => {
  const region = page.getByRole('region', { name: 'Document review' });
  const alpha = region.getByRole('button', {
    name: 'Thread alpha',
    exact: true,
  });
  const beta = region.getByRole('button', {
    name: 'Thread beta',
    exact: true,
  });
  const gamma = region.getByRole('button', {
    name: 'Thread gamma',
    exact: true,
  });

  await beta.focus();
  await expect(beta).toBeFocused();
  await expect(beta).toHaveAttribute('aria-pressed', 'true');
  await expect(beta).toHaveAccessibleDescription('Unresolved 1 comments');

  await page.keyboard.press('End');
  await expect(gamma).toBeFocused();
  await expect(gamma).toHaveAttribute('aria-pressed', 'false');
  await expect(gamma).toHaveAccessibleDescription('Resolved 3 comments');
  expect(await page.evaluate(() => window.readInkspanReviewIntents())).toEqual([]);

  await page.keyboard.press('Enter');
  expect(await page.evaluate(() => window.readInkspanReviewIntents())).toEqual([
    { action: 'select', threadKey: 'gamma' },
  ]);

  await page.keyboard.press('Home');
  await expect(alpha).toBeFocused();
  await page.keyboard.press('ArrowDown');
  await expect(beta).toBeFocused();
  await expect(
    region.getByRole('button', { name: 'Reply — Thread beta' }),
  ).toBeDisabled();
  await expect(
    region.getByRole('button', { name: 'Resolve — Thread beta' }),
  ).toBeEnabled();
  await expect(
    region.getByRole('button', { name: 'Resolve — Thread gamma' }),
  ).toBeDisabled();
});

test('prints review summaries only after explicit opt-in', async ({ page }) => {
  const region = page.getByRole('region', { name: 'Document review' });
  await page.emulateMedia({ media: 'print' });
  await expect(region).toBeHidden();

  await page.evaluate(() => window.mountInkspanReviewProbe('include'));
  await expect(region).toBeVisible();
  await expect(
    region.getByRole('button', { name: 'Thread beta', exact: true }),
  ).toBeVisible();
  await expect(
    region.getByRole('button', { name: 'Resolve — Thread beta' }),
  ).toBeHidden();
});
