import { expect, test, type Page } from '@playwright/test';

interface DiagnosticsProbeOptions {
  readonly sourceHtml: string;
  readonly withDiagnostics?: boolean;
  readonly diagnosticCount?: number;
}

async function mountProbe(
  page: Page,
  options: DiagnosticsProbeOptions,
): Promise<void> {
  await page.goto('/tests/browser/harness.html');
  await page.evaluate(async (input: DiagnosticsProbeOptions) => {
    await (window as any).mountInkspanWritingDiagnosticsProbe(input);
  }, options);
}

test.describe('writing diagnostics browser assurance', () => {
  test('renders, navigates, focuses, applies, invalidates, and undoes exact revision guidance', async ({
    page,
  }, testInfo) => {
    await mountProbe(page, {
      sourceHtml: '<p>Alpha beta gamma</p>',
      withDiagnostics: true,
      diagnosticCount: 2,
    });

    const region = page.getByRole('region', { name: 'Writing guidance' });
    await expect(region).toContainText('2 writing diagnostics');
    await expect(page.locator('.cwl-writing-diagnostic')).toHaveCount(2);

    const cards = region.getByRole('listitem');
    await expect(cards).toHaveCount(2);
    await region.getByRole('button', { name: 'Next writing diagnostic' }).click();
    await expect(cards.nth(1)).toBeFocused();

    await region
      .getByRole('button', { name: /Focus affected text for Clarify Alpha/u })
      .click();
    await expect(page.locator('.ProseMirror')).toBeFocused();
    expect(
      await page.evaluate(() => globalThis.getSelection()?.toString() ?? ''),
    ).toContain('Alpha');

    const apply = region.getByRole('button', {
      name: /Apply suggestion for Clarify Alpha/u,
    });
    await expect(apply).toBeEnabled();
    const actionBox = await apply.boundingBox();
    expect(actionBox).not.toBeNull();
    if (testInfo.project.use.hasTouch === true) {
      expect(actionBox!.width).toBeGreaterThanOrEqual(44);
      expect(actionBox!.height).toBeGreaterThanOrEqual(44);
    }
    await apply.click();

    await expect(page.locator('.ProseMirror')).toContainText('Omega beta gamma');
    await expect(region).toContainText('0 writing diagnostics');
    await expect(page.locator('.cwl-writing-diagnostic')).toHaveCount(0);

    await page.evaluate(() => (window as any).undoInkspanWritingDiagnosticsProbe());
    await expect(page.locator('.ProseMirror')).toContainText('Alpha beta gamma');

    const actions = await page.evaluate(
      () => (window as any).getInkspanWritingDiagnosticsProbeState().actions,
    );
    expect(actions).toHaveLength(1);
    expect(actions[0]).toMatchObject({
      action: 'applied',
      reasonCode: 'explicit',
      diagnosticId: 'browser-diagnostic-alpha',
    });
  });

  test('invalidates current guidance after an unrelated document change', async ({
    page,
  }) => {
    await mountProbe(page, {
      sourceHtml: '<p>Alpha beta gamma</p>',
      withDiagnostics: true,
    });
    const region = page.getByRole('region', { name: 'Writing guidance' });
    await expect(region).toContainText('1 writing diagnostics');

    await page.evaluate(() =>
      (window as any).mutateInkspanWritingDiagnosticsProbe(
        '<p>Alpha beta gamma remote-like edit</p>',
      ),
    );
    await expect(region).toContainText('0 writing diagnostics');
    await expect(page.locator('.cwl-writing-diagnostic')).toHaveCount(0);
    const result = await page.evaluate(() =>
      (window as any).applyInkspanWritingDiagnosticProbe(
        'browser-diagnostic-alpha',
      ),
    );
    expect(result).toBeNull();
  });

  test('remains usable under forced colors and 200 percent visual scale', async ({
    page,
  }) => {
    await mountProbe(page, {
      sourceHtml: '<p>Alpha beta gamma</p>',
      withDiagnostics: true,
    });
    await page.emulateMedia({ forcedColors: 'active', reducedMotion: 'reduce' });
    await page.evaluate(() => {
      document.documentElement.style.fontSize = '200%';
    });

    const region = page.getByRole('region', { name: 'Writing guidance' });
    await expect(region).toBeVisible();
    const apply = region.getByRole('button', { name: /Apply suggestion/u });
    await expect(apply).toBeVisible();
    const decoration = page.locator('.cwl-writing-diagnostic').first();
    await expect(decoration).toBeVisible();
    const decorationStyle = await decoration.evaluate((element) => {
      const style = getComputedStyle(element);
      return {
        textDecorationLine: style.textDecorationLine,
        outlineStyle: style.outlineStyle,
      };
    });
    expect(
      decorationStyle.textDecorationLine === 'underline' ||
        decorationStyle.outlineStyle !== 'none',
    ).toBe(true);
  });

  test('has no semantic fallback surface for lexical contrast documents', async ({
    page,
  }) => {
    const sources = [
      '<p>The quotation says “rude urgent incorrect” but makes no direct accusation.</p>',
      '<p>A semantically similar concern expressed with completely unrelated wording.</p>',
      '<p>Product incorrect at https://example.test/urgent/path and code rude_token.</p>',
      '<p>이 문장은 무례함과 긴급이라는 단어를 인용합니다.</p>',
      '<p>English 한국어 中文 mixed-language prose.</p>',
    ];

    for (const sourceHtml of sources) {
      await mountProbe(page, { sourceHtml, withDiagnostics: false });
      await expect(
        page.getByRole('region', { name: 'Writing guidance' }),
      ).toHaveCount(0);
      await expect(page.locator('.cwl-writing-diagnostic')).toHaveCount(0);
    }
  });
});
