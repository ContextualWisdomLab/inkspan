import { expect, test } from '@playwright/test';

const HARNESS_URL = 'http://127.0.0.1:4173/tests/browser/harness.html';
const STYLES_URL = 'http://127.0.0.1:4173/dist/cwl-editor.css';

const allowHarnessRequest = (requestUrl: string): boolean => {
  const url = new URL(requestUrl);
  return url.hostname === '127.0.0.1' && url.port === '4173';
};

const mountEditableSurface = async (page: import('@playwright/test').Page) => {
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
  await page.locator('#harness').evaluate((element) => {
    element.innerHTML = `
      <section class="cwl-editor">
        <div class="cwl-editor__surface">
          <div
            class="cwl-editor__content"
            role="textbox"
            aria-label="Document"
            aria-multiline="true"
            contenteditable="true"
          >Keyboard focus target</div>
        </div>
      </section>
    `;
  });
  expect(rejectedExternalRequests).toEqual([]);

  await page.keyboard.press('Tab');
  const content = page.getByRole('textbox', { name: 'Document' });
  await expect(content).toBeFocused();
  return content;
};

test('shows a packed-stylesheet focus indicator on the editable textbox', async ({
  page,
}) => {
  const content = await mountEditableSurface(page);

  const focusStyle = await content.evaluate((element) => {
    const style = getComputedStyle(element);
    return {
      outlineStyle: style.outlineStyle,
      outlineWidth: style.outlineWidth,
      outlineOffset: style.outlineOffset,
    };
  });

  expect(focusStyle).toEqual({
    outlineStyle: 'solid',
    outlineWidth: '2px',
    outlineOffset: '-2px',
  });
});

test('does not print the interactive focus indicator', async ({ page }) => {
  const content = await mountEditableSurface(page);
  await page.emulateMedia({ media: 'print' });
  expect(await page.evaluate(() => matchMedia('print').matches)).toBe(true);

  const printFocusStyle = await content.evaluate((element) => {
    const style = getComputedStyle(element);
    return {
      outlineStyle: style.outlineStyle,
      outlineWidth: style.outlineWidth,
    };
  });

  expect(printFocusStyle).toEqual({
    outlineStyle: 'none',
    outlineWidth: '0px',
  });
});
