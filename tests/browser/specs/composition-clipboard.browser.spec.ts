import { expect, test, type Page } from '@playwright/test';

type InputHarness = {
  getText: () => string;
  isComposing: () => boolean;
};

const allowHarnessRequest = (requestUrl: string): boolean => {
  const url = new URL(requestUrl);
  return url.hostname === '127.0.0.1' && url.port === '4173';
};

const committedInputSamples = [
  ['Korean', '한글 입력 테스트 123'],
  ['Japanese', 'ひらがな カタカナ 漢字、。'],
  ['Simplified Chinese', '简体中文输入测试，标点。'],
  ['Traditional Chinese', '繁體中文輸入測試，標點。'],
  ['Vietnamese', 'Tiếng Việt đa dạng'],
  ['grapheme clusters', 'A👩🏽‍💻e\u0301❤️‍🔥B'],
] as const;

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

for (const [label, text] of committedInputSamples) {
  test(`preserves ${label} committed input exactly`, async ({ page }) => {
    const editable = page.locator('.ProseMirror');
    await editable.click();
    await page.keyboard.insertText(text);

    await expect
      .poll(() =>
        page.evaluate(() =>
          (window.inkspanInputHarness as InputHarness).getText(),
        ),
      )
      .toBe(text);
  });
}

test('tracks a synthetic composition lifecycle without inventing OS IME evidence', async ({
  page,
}) => {
  const editable = page.locator('.ProseMirror');
  await editable.click();

  await editable.evaluate((element) => {
    element.dispatchEvent(
      new CompositionEvent('compositionstart', { bubbles: true, data: '' }),
    );
  });
  await expect
    .poll(() =>
      page.evaluate(() =>
        (window.inkspanInputHarness as InputHarness).isComposing(),
      ),
    )
    .toBe(true);

  await editable.evaluate((element) => {
    element.dispatchEvent(
      new CompositionEvent('compositionend', { bubbles: true, data: '' }),
    );
  });
  await expect
    .poll(() =>
      page.evaluate(() =>
        (window.inkspanInputHarness as InputHarness).isComposing(),
      ),
    )
    .toBe(false);

  await page.keyboard.insertText('한글');
  await expect
    .poll(() =>
      page.evaluate(() =>
        (window.inkspanInputHarness as InputHarness).getText(),
      ),
    )
    .toBe('한글');
});
