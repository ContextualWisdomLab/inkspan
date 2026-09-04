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

test('reflows review actions without hiding content on narrow screens', async ({
  page,
}) => {
  await page.setViewportSize({ width: 360, height: 640 });

  const item = page.locator('.cwl-review__item').first();
  const thread = item.locator('.cwl-review__thread');
  const reply = item.getByRole('button', { name: 'Reply — Thread alpha' });

  await expect(item).toBeVisible();
  await expect(thread).toBeVisible();
  await expect(reply).toBeVisible();
  expect(await item.evaluate((element) => getComputedStyle(element).gridTemplateColumns)).not.toBe(
    'none',
  );
  await expect(thread).toHaveCSS('grid-column', '1 / -1');
});

test('preserves selected and keyboard focus cues in forced colors', async ({
  page,
}) => {
  await page.emulateMedia({ forcedColors: 'active' });

  const selected = page.getByRole('button', {
    name: 'Thread beta',
    exact: true,
  });
  await selected.focus();

  expect(await page.evaluate(() => matchMedia('(forced-colors: active)').matches)).toBe(
    true,
  );
  await expect(selected).toBeFocused();
  await expect(selected).toHaveCSS('outline-style', 'solid');
  await expect(selected).toHaveCSS('outline-width', '2px');
});
