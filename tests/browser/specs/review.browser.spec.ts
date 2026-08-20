import { expect, test } from '@playwright/test';

const HARNESS_URL = 'http://127.0.0.1:4173/tests/browser/harness.html';
const STYLES_URL = 'http://127.0.0.1:4173/dist/cwl-editor.css';

const allowHarnessRequest = (requestUrl: string): boolean => {
  const url = new URL(requestUrl);
  return url.hostname === '127.0.0.1' && url.port === '4173';
};

test.beforeEach(async ({ page }) => {
  const rejectedExternalRequests: string[] = [];
  await page.route('**/*', async (route) => {
    if (allowHarnessRequest(route.request().url())) {
      await route.continue();
      return;
    }
    rejectedExternalRequests.push(new URL(route.request().url()).origin);
    await route.abort('blockedbyclient');
  });
  await page.goto(HARNESS_URL);
  await page.addStyleTag({ url: STYLES_URL });
  await page.evaluate(() => window.mountInkspanReviewProbe());
  expect(rejectedExternalRequests).toEqual([]);
});

test('runs exact-revision review, keyboard history, stale protection, and print states', async ({ page }) => {
  const region = page.getByRole('region', { name: 'Document review' });
  await expect(region).toBeVisible();
  const editor = page.getByRole('textbox', { name: 'Rich text editor' });
  await expect(editor).toContainText('Hi');

  const acceptedRow = region.locator('li').filter({ hasText: 'review-accepted' });
  await acceptedRow.getByRole('button', { name: 'Accept', exact: true }).press('Enter');
  await expect(page.locator('#review-probe')).toHaveAttribute('data-review-status', 'accepted');
  await expect(editor).toContainText('XHi');

  await page.getByRole('button', { name: /Undo/ }).click();
  await expect(editor).toContainText('Hi');
  await page.getByRole('button', { name: /Redo/ }).click();
  await expect(editor).toContainText('XHi');

  await page.getByRole('button', { name: 'Make review stale' }).click();
  const staleRow = region.locator('li').filter({ hasText: 'review-stale' });
  await staleRow.getByRole('button', { name: 'Accept', exact: true }).click();
  await expect(page.locator('#review-probe')).toHaveAttribute('data-review-status', 'stale');
  await expect(editor).toContainText('Changed');

  await page.emulateMedia({ media: 'print' });
  await expect(region).toBeHidden();
  await expect(editor).toBeVisible();
  expect(await page.locator('[data-review-id="review-stale"]').count()).toBeGreaterThan(0);
  expect(
    await page.locator('[data-review-id="review-stale"]').evaluate((element) =>
      getComputedStyle(element).display,
    ),
  ).toBe('none');
});
