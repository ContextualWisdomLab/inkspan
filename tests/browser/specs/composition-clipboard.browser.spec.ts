import { expect, test, type Page } from '@playwright/test';

type InputHarness = {
  getHtml: () => string;
  getText: () => string;
  isComposing: () => boolean;
  redo: () => boolean;
  setEditable: (editable: boolean) => boolean;
  setHtml: (html: string) => boolean;
  undo: () => boolean;
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

const structuredCommittedInputCases = [
  {
    label: 'heading',
    sourceHtml: '<h2>시작</h2>',
    selector: 'h2',
    insertedText: ' 한글',
    expectedText: '시작 한글',
  },
  {
    label: 'bullet-list item',
    sourceHtml: '<ul><li><p>項目</p></li></ul>',
    selector: 'li',
    insertedText: ' 日本語',
    expectedText: '項目 日本語',
  },
  {
    label: 'table cell',
    sourceHtml: '<table><tbody><tr><td><p>内容</p></td></tr></tbody></table>',
    selector: 'td',
    insertedText: ' 中文',
    expectedText: '内容 中文',
  },
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
  await expect(page.locator('.ProseMirror')).toHaveAttribute(
    'contenteditable',
    'true',
  );
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

for (const inputCase of structuredCommittedInputCases) {
  test(`preserves committed multilingual input in a ${inputCase.label}`, async ({
    page,
  }) => {
    await page.evaluate((sourceHtml) => {
      (window.inkspanInputHarness as InputHarness).setHtml(sourceHtml);
    }, inputCase.sourceHtml);

    const editable = page.locator('.ProseMirror');
    const target = page.locator(`.ProseMirror ${inputCase.selector}`).first();
    await editable.focus();
    await target.evaluate((element) => {
      const walker = document.createTreeWalker(element, NodeFilter.SHOW_TEXT);
      let textNode: Node | null = null;
      for (let candidate = walker.nextNode(); candidate; candidate = walker.nextNode()) {
        textNode = candidate;
      }
      if (!textNode) {
        throw new Error('Structured input target has no text node.');
      }
      const selection = window.getSelection();
      if (!selection) {
        throw new Error('Selection API is unavailable.');
      }
      const range = document.createRange();
      range.setStart(textNode, textNode.textContent?.length ?? 0);
      range.collapse(true);
      selection.removeAllRanges();
      selection.addRange(range);
    });
    await page.keyboard.insertText(inputCase.insertedText);

    await expect(target).toHaveText(inputCase.expectedText);
  });
}

test('keeps committed Korean input atomic across undo and redo', async ({
  page,
}) => {
  const editable = page.locator('.ProseMirror');
  await editable.click();
  await page.keyboard.insertText('한글 입력');

  await expect
    .poll(() =>
      page.evaluate(() =>
        (window.inkspanInputHarness as InputHarness).getText(),
      ),
    )
    .toBe('한글 입력');

  expect(
    await page.evaluate(() =>
      (window.inkspanInputHarness as InputHarness).undo(),
    ),
  ).toBe(true);
  await expect
    .poll(() =>
      page.evaluate(() =>
        (window.inkspanInputHarness as InputHarness).getText(),
      ),
    )
    .toBe('');

  expect(
    await page.evaluate(() =>
      (window.inkspanInputHarness as InputHarness).redo(),
    ),
  ).toBe(true);
  await expect
    .poll(() =>
      page.evaluate(() =>
        (window.inkspanInputHarness as InputHarness).getText(),
      ),
    )
    .toBe('한글 입력');
});

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

  expect(
    await page.evaluate(() =>
      (window.inkspanInputHarness as InputHarness).getHtml(),
    ),
  ).toContain('한글');
});

test('does not admit committed input when read-only begins during composition', async ({
  page,
}) => {
  const editable = page.locator('.ProseMirror');
  await editable.click();
  await page.keyboard.insertText('기준');

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
});

test('preserves multilingual committed input in a narrow emulated viewport', async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 });
  const editable = page.locator('.ProseMirror');
  await editable.click();

  const text = '한글 日本語 简体中文 繁體中文 Tiếng Việt 👩🏽‍💻';
  await page.keyboard.insertText(text);

  await expect
    .poll(() =>
      page.evaluate(() =>
        (window.inkspanInputHarness as InputHarness).getText(),
      ),
    )
    .toBe(text);
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= document.documentElement.clientWidth,
    ),
  ).toBe(true);
});

test('keeps the active insertion point across an emulated orientation resize', async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 });
  const editable = page.locator('.ProseMirror');
  await editable.click();
  await page.keyboard.insertText('한글');

  await page.setViewportSize({ width: 844, height: 390 });
  await page.keyboard.insertText(' 日本語');

  await expect
    .poll(() =>
      page.evaluate(() =>
        (window.inkspanInputHarness as InputHarness).getText(),
      ),
    )
    .toBe('한글 日本語');
});
