import { expect, test, type Page } from '@playwright/test';

type InputHarness = {
  getHtml: () => string;
  getText: () => string;
  isComposing: () => boolean;
  remount: () => boolean;
  setEditable: (editable: boolean) => boolean;
};

const HARNESS_URL = '/tests/browser/input-harness.html';
const FORM_FIELD = '[data-inkspan-form-field][name="message_body"]';

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
});

test.afterEach(async ({ page }) => {
  await page.waitForLoadState('networkidle');
  expect(rejectedRequestsByPage.get(page) ?? []).toEqual([]);
});

test('keeps native-form serialization atomic when editability is revoked during composition', async ({
  page,
}) => {
  await page.goto(HARNESS_URL);

  const editable = page.locator('.ProseMirror');
  await expect(editable).toHaveAttribute('contenteditable', 'true');
  await editable.click();
  await page.keyboard.insertText('기준');

  const baselineHtml = await page.evaluate(() =>
    (window.inkspanInputHarness as InputHarness).getHtml(),
  );
  await expect(page.locator(FORM_FIELD)).toHaveValue(baselineHtml);

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

  expect(
    await page.evaluate(() =>
      (window.inkspanInputHarness as InputHarness).setEditable(false),
    ),
  ).toBe(false);
  await expect(editable).toHaveAttribute('contenteditable', 'false');

  await editable.evaluate((element) => {
    element.dispatchEvent(
      new CompositionEvent('compositionend', { bubbles: true, data: '차단' }),
    );
  });
  await expect
    .poll(() =>
      page.evaluate(() =>
        (window.inkspanInputHarness as InputHarness).isComposing(),
      ),
    )
    .toBe(false);

  await editable.focus();
  await page.keyboard.insertText(' 차단');
  await expect
    .poll(() =>
      page.evaluate(() =>
        (window.inkspanInputHarness as InputHarness).getText(),
      ),
    )
    .toBe('기준');
  await expect(page.locator(FORM_FIELD)).toHaveValue(baselineHtml);

  expect(
    await page.evaluate(() =>
      (window.inkspanInputHarness as InputHarness).setEditable(true),
    ),
  ).toBe(true);
  await editable.click();
  await page.keyboard.press('End');
  await page.keyboard.insertText(' 재개');

  await expect
    .poll(() =>
      page.evaluate(() =>
        (window.inkspanInputHarness as InputHarness).getText(),
      ),
    )
    .toBe('기준 재개');
  const resumedHtml = await page.evaluate(() =>
    (window.inkspanInputHarness as InputHarness).getHtml(),
  );
  await expect(page.locator(FORM_FIELD)).toHaveValue(resumedHtml);
});

test('destroys an active composition and remounts a clean native-form editor', async ({
  page,
}) => {
  await page.goto(HARNESS_URL);

  const editable = page.locator('.ProseMirror');
  await editable.click();
  await page.keyboard.insertText('작성 중');
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

  expect(
    await page.evaluate(() =>
      (window.inkspanInputHarness as InputHarness).remount(),
    ),
  ).toBe(true);

  const remountedEditable = page.locator('.ProseMirror');
  await expect(remountedEditable).toHaveAttribute('contenteditable', 'true');
  await expect
    .poll(() =>
      page.evaluate(() =>
        (window.inkspanInputHarness as InputHarness).isComposing(),
      ),
    )
    .toBe(false);
  await expect
    .poll(() =>
      page.evaluate(() =>
        (window.inkspanInputHarness as InputHarness).getText(),
      ),
    )
    .toBe('');
  await expect(page.locator(FORM_FIELD)).toHaveValue('');

  await remountedEditable.click();
  await page.keyboard.insertText('새 세션');
  await expect
    .poll(() =>
      page.evaluate(() =>
        (window.inkspanInputHarness as InputHarness).getText(),
      ),
    )
    .toBe('새 세션');
  await expect(page.locator(FORM_FIELD)).not.toHaveValue('');
});
