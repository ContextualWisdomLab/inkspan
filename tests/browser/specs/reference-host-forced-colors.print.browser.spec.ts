import { expect, test } from '@playwright/test';

const REFERENCE_HOST_URL =
  'http://127.0.0.1:4173/examples/reference-host/browser-host.html';

function isReferenceHostRequest(requestUrl: string): boolean {
  const url = new URL(requestUrl);
  return (
    url.protocol === 'http:' &&
    url.hostname === '127.0.0.1' &&
    url.port === '4173'
  );
}

test.describe.configure({ mode: 'serial' });

test('keeps the real buyer host operable in forced-colors mode without runtime network', async ({
  page,
}) => {
  const rejectedRequests: string[] = [];
  const pageErrors: string[] = [];

  page.on('pageerror', (error) => {
    pageErrors.push(error.message);
  });
  await page.route('**/*', async (route) => {
    const requestUrl = route.request().url();
    if (isReferenceHostRequest(requestUrl)) {
      await route.continue();
      return;
    }
    rejectedRequests.push(requestUrl);
    await route.abort('blockedbyclient');
  });

  await page.emulateMedia({ forcedColors: 'active' });
  const response = await page.goto(REFERENCE_HOST_URL);
  expect(response?.ok()).toBe(true);

  await expect(
    page.getByRole('heading', { name: 'Inkspan reference host' }),
  ).toBeVisible();
  await expect(page.getByRole('textbox')).toBeVisible();
  await expect(page.getByRole('button', { name: 'Save document' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Reset draft' })).toBeVisible();
  await expect(
    page.locator('[data-inkspan-form-field][name="message_body"]'),
  ).toHaveValue('# Draft');
  await expect(page.getByText('Loading buyer editor')).toHaveCount(0);

  const toolbarButton = page.locator('.cwl-tb-btn').first();
  await expect(toolbarButton).toBeVisible();
  await toolbarButton.focus();

  const forcedColorsEvidence = await page.evaluate(() => {
    const editor = document.querySelector<HTMLElement>('.cwl-editor');
    const toolbarControl = document.querySelector<HTMLElement>('.cwl-tb-btn');
    if (!editor || !toolbarControl) {
      throw new Error('reference host forced-colors surface is incomplete');
    }
    const editorStyle = getComputedStyle(editor);
    const toolbarStyle = getComputedStyle(toolbarControl);
    return {
      forcedColorsMatches: matchMedia('(forced-colors: active)').matches,
      editorColor: editorStyle.color,
      editorBackgroundColor: editorStyle.backgroundColor,
      outlineStyle: toolbarStyle.outlineStyle,
      outlineWidth: toolbarStyle.outlineWidth,
      outlineColor: toolbarStyle.outlineColor,
    };
  });

  expect(forcedColorsEvidence.forcedColorsMatches).toBe(true);
  expect(forcedColorsEvidence.editorColor).not.toBe('rgba(0, 0, 0, 0)');
  expect(forcedColorsEvidence.editorBackgroundColor).not.toBe('rgba(0, 0, 0, 0)');
  expect(forcedColorsEvidence.outlineStyle).not.toBe('none');
  expect(forcedColorsEvidence.outlineWidth).not.toBe('0px');
  expect(forcedColorsEvidence.outlineColor).not.toBe('rgba(0, 0, 0, 0)');
  expect(rejectedRequests).toEqual([]);
  expect(pageErrors).toEqual([]);
});
