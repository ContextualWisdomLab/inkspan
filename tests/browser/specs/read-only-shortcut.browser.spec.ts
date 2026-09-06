import { expect, test } from '@playwright/test';

for (const modifier of ['Control', 'Meta'] as const) {
  test(`keeps ${modifier}+K aligned with live read-only state`, async ({ page }, testInfo) => {
    const rejectedOrigins: string[] = [];
    await page.route('**/*', async (route) => {
      const url = new URL(route.request().url());
      if (url.hostname === '127.0.0.1' && url.port === '4173') {
        await route.continue();
      } else {
        rejectedOrigins.push(url.origin);
        await route.abort('blockedbyclient');
      }
    });
    const prompts: string[] = [];
    page.on('dialog', async (dialog) => {
      prompts.push(dialog.message());
      await dialog.dismiss();
    });
    await page.goto('/tests/browser/input-harness.html?toolbar=1');
    const editor = page.getByRole('textbox', { name: 'Rich text editor' });
    await expect(editor).toHaveAttribute('contenteditable', 'true');
    await editor.click();
    await page.keyboard.insertText('Retained decision — 한글 日本語 Tiếng Việt');
    const originalEditor = await editor.elementHandle();
    expect(originalEditor).not.toBeNull();
    await page.keyboard.press(`${modifier}+k`);
    await expect.poll(() => prompts.length).toBe(1);
    await page.screenshot({ path: testInfo.outputPath(`${modifier}-editable.png`), fullPage: true });

    await page.evaluate(() => window.inkspanInputHarness.setEditable(false));
    await expect(editor).toHaveAttribute('contenteditable', 'false');
    await expect(editor).toHaveAttribute('aria-readonly', 'true');
    await editor.focus();
    await page.keyboard.press(`${modifier}+k`);
    expect(prompts).toEqual(['Link URL']);
    await expect(editor).toHaveText('Retained decision — 한글 日本語 Tiếng Việt');
    await expect(page.getByRole('button', { name: 'Bold (Ctrl/Cmd+B)', exact: true })).toHaveCount(0);
    await expect(editor).toBeFocused();
    await page.screenshot({ path: testInfo.outputPath(`${modifier}-readonly.png`), fullPage: true });

    await page.evaluate(() => window.inkspanInputHarness.setEditable(true));
    await expect(editor).toHaveAttribute('contenteditable', 'true');
    await editor.focus();
    await page.keyboard.press(`${modifier}+k`);
    await expect.poll(() => prompts.length).toBe(2);
    expect(prompts).toEqual(['Link URL', 'Link URL']);
    await expect(editor).toHaveText('Retained decision — 한글 日本語 Tiếng Việt');
    expect(await originalEditor!.evaluate((element) => element.isConnected)).toBe(true);
    await expect(page.getByRole('button', { name: 'Bold (Ctrl/Cmd+B)', exact: true })).toBeVisible();
    await page.screenshot({ path: testInfo.outputPath(`${modifier}-reenabled.png`), fullPage: true });
    await page.waitForLoadState('networkidle');
    expect(rejectedOrigins).toEqual([]);
  });
}
