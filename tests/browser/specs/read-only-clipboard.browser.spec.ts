import { expect, test, type Page } from '@playwright/test';

type InputHarness = {
  getText: () => string;
  setEditable: (editable: boolean) => boolean;
};

const allowHarnessRequest = (requestUrl: string): boolean => {
  const url = new URL(requestUrl);
  return url.hostname === '127.0.0.1' && url.port === '4173';
};

const rejectedRequestsByPage = new WeakMap<Page, string[]>();

test.beforeEach(async ({ page }) => {
  const rejectedExternalRequests: string[] = [];
  rejectedRequestsByPage.set(page, rejectedExternalRequests);
  await page.route('**/*', async (route) => {
    if (allowHarnessRequest(route.request().url())) {
      await route.continue();
      return;
    }
    rejectedExternalRequests.push(new URL(route.request().url()).origin);
    await route.abort('blockedbyclient');
  });
  await page.goto('/tests/browser/input-harness.html');
});

test.afterEach(async ({ page }) => {
  await page.waitForLoadState('networkidle');
  expect(rejectedRequestsByPage.get(page) ?? []).toEqual([]);
});

test('keeps multilingual committed input inert while read-only and resumes after re-enable', async ({
  page,
}) => {
  const editable = page.locator('.ProseMirror');
  await editable.click();
  await page.keyboard.insertText('한글 日本語');

  await expect
    .poll(() =>
      page.evaluate(() => (window.inkspanInputHarness as InputHarness).getText()),
    )
    .toBe('한글 日本語');

  expect(
    await page.evaluate(() =>
      (window.inkspanInputHarness as InputHarness).setEditable(false),
    ),
  ).toBe(false);
  await expect(editable).toHaveAttribute('contenteditable', 'false');

  await editable.focus();
  await page.keyboard.insertText(' 不应写入');
  await expect
    .poll(() =>
      page.evaluate(() => (window.inkspanInputHarness as InputHarness).getText()),
    )
    .toBe('한글 日本語');

  expect(
    await page.evaluate(() =>
      (window.inkspanInputHarness as InputHarness).setEditable(true),
    ),
  ).toBe(true);
  await expect(editable).toHaveAttribute('contenteditable', 'true');
  await editable.click();
  await page.keyboard.insertText(' Tiếng Việt');

  await expect
    .poll(() =>
      page.evaluate(() => (window.inkspanInputHarness as InputHarness).getText()),
    )
    .toBe('한글 日本語 Tiếng Việt');
});
