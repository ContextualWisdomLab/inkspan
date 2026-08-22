import { expect, test, type Page } from '@playwright/test';

type InputHarness = {
  getText: () => string;
};

const allowHarnessRequest = (requestUrl: string): boolean => {
  const url = new URL(requestUrl);
  return url.hostname === '127.0.0.1' && url.port === '4173';
};

const rejectedRequestsByPage = new WeakMap<Page, string[]>();

const expectNoHorizontalDocumentOverflow = async (page: Page): Promise<void> => {
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= document.documentElement.clientWidth,
    ),
  ).toBe(true);
};

test.use({
  hasTouch: true,
  viewport: { width: 390, height: 844 },
});

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

test('delivers emulated touchscreen input through the Pointer Events touch path', async ({
  page,
}) => {
  const editable = page.locator('.ProseMirror');
  const box = await editable.boundingBox();
  expect(box).not.toBeNull();
  if (box === null) {
    throw new Error('Editable surface has no touch target bounds.');
  }

  await editable.evaluate((element) => {
    element.addEventListener(
      'pointerdown',
      (event) => {
        if (!(event instanceof PointerEvent)) {
          throw new Error('Pointer event is unavailable.');
        }
        element.setAttribute('data-last-pointer-type', event.pointerType);
        element.setAttribute('data-last-pointer-primary', String(event.isPrimary));
      },
      { once: true },
    );
  });

  await page.touchscreen.tap(box.x + box.width / 2, box.y + box.height / 2);

  await expect(editable).toHaveAttribute('data-last-pointer-type', 'touch');
  await expect(editable).toHaveAttribute('data-last-pointer-primary', 'true');
  await expect(editable).toBeFocused();
  await expectNoHorizontalDocumentOverflow(page);
});

test('preserves multilingual committed input after emulated touch focus', async ({
  page,
}) => {
  const editable = page.locator('.ProseMirror');
  const box = await editable.boundingBox();
  expect(box).not.toBeNull();
  if (box === null) {
    throw new Error('Editable surface has no touch target bounds.');
  }

  await page.touchscreen.tap(box.x + box.width / 2, box.y + box.height / 2);
  await expect(editable).toBeFocused();

  const text = '한글 日本語 简体中文 繁體中文 Tiếng Việt 👩🏽‍💻';
  await page.keyboard.insertText(text);

  await expect
    .poll(() =>
      page.evaluate(() =>
        (window.inkspanInputHarness as InputHarness).getText(),
      ),
    )
    .toBe(text);

  await expectNoHorizontalDocumentOverflow(page);

  await page.setViewportSize({ width: 844, height: 390 });
  await expect(editable).toBeFocused();
  expect(
    await page.evaluate(() =>
      (window.inkspanInputHarness as InputHarness).getText(),
    ),
  ).toBe(text);
  await expectNoHorizontalDocumentOverflow(page);

  await page.setViewportSize({ width: 390, height: 844 });
  await expect(editable).toBeFocused();
  expect(
    await page.evaluate(() =>
      (window.inkspanInputHarness as InputHarness).getText(),
    ),
  ).toBe(text);
  await expectNoHorizontalDocumentOverflow(page);
});
