import { expect, test } from '@playwright/test';

const HARNESS_URL = 'http://127.0.0.1:4173/tests/browser/harness.html';
const STYLES_URL = 'http://127.0.0.1:4173/dist/cwl-editor.css';

const allowHarnessRequest = (requestUrl: string): boolean => {
  const url = new URL(requestUrl);
  return url.hostname === '127.0.0.1' && url.port === '4173';
};

test.describe.configure({ mode: 'serial' });

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
  await page.locator('#harness').evaluate((element) => {
    element.innerHTML = `
      <button data-focus-start>Start keyboard journey</button>
      <section class="cwl-editor">
        <nav class="cwl-toolbar">
          <span class="cwl-tb-group">
            <button class="cwl-tb-btn">Plain</button>
            <button class="cwl-tb-btn is-active">Active</button>
            <button class="cwl-tb-btn" disabled>Disabled</button>
          </span>
          <span class="cwl-tb-group" aria-hidden="true"></span>
        </nav>
        <div class="cwl-collaboration-status">Connected</div>
        <div class="cwl-editor__surface">
          <article class="cwl-editor__content" contenteditable="true">
            <p class="is-editor-empty" data-placeholder="Placeholder"></p>
            <p><a href="https://example.invalid/">Link</a> <code>code</code></p>
            <pre>pre</pre>
            <blockquote>quote</blockquote>
            <table><tbody><tr><th>Head</th><td>Cell</td></tr></tbody></table>
            <span class="collaboration-cursor__caret">
              <span class="collaboration-cursor__label">Remote</span>
            </span>
          </article>
        </div>
      </section>
    `;
  });
  expect(rejectedExternalRequests).toEqual([]);
});

test('preserves state and structural cues in forced colors', async ({
  browserName,
  page,
}, testInfo) => {
  const tabKey =
    browserName === 'webkit' && process.platform === 'darwin'
      ? 'Alt+Tab'
      : 'Tab';
  await page.emulateMedia({ forcedColors: 'active' });
  expect(
    await page.evaluate(() => matchMedia('(forced-colors: active)').matches),
  ).toBe(true);

  const focusStart = page.getByRole('button', {
    name: 'Start keyboard journey',
  });
  const plainButton = page.getByRole('button', { name: 'Plain' });
  await focusStart.focus();
  await page.keyboard.press(tabKey);
  await expect(plainButton).toBeFocused();

  const evidence = await page.evaluate(() => {
    const get = <T extends Element>(selector: string): T => {
      const element = document.querySelector<T>(selector);
      if (!element) {
        throw new Error(`Missing forced-colors fixture: ${selector}`);
      }
      return element;
    };

    const editor = get<HTMLElement>('.cwl-editor');
    const toolbar = get<HTMLElement>('.cwl-toolbar');
    const group = get<HTMLElement>('.cwl-tb-group');
    const plainButton = get<HTMLButtonElement>(
      '.cwl-tb-btn:not(.is-active):not(:disabled)',
    );
    const activeButton = get<HTMLButtonElement>('.cwl-tb-btn.is-active');
    const disabledButton = get<HTMLButtonElement>('.cwl-tb-btn:disabled');
    const collaboration = get<HTMLElement>('.cwl-collaboration-status');
    const link = get<HTMLAnchorElement>('.cwl-editor__content a');
    const code = get<HTMLElement>('.cwl-editor__content code');
    const cell = get<HTMLTableCellElement>('.cwl-editor__content td');
    const caret = get<HTMLElement>('.collaboration-cursor__caret');
    const label = get<HTMLElement>('.collaboration-cursor__label');
    const quote = get<HTMLElement>('.cwl-editor__content blockquote');
    const placeholder = get<HTMLElement>('.cwl-editor__content .is-editor-empty:first-child');

    const editorStyle = getComputedStyle(editor);
    const toolbarStyle = getComputedStyle(toolbar);
    const groupStyle = getComputedStyle(group);
    const plainStyle = getComputedStyle(plainButton);
    const activeStyle = getComputedStyle(activeButton);
    const disabledStyle = getComputedStyle(disabledButton);
    const collaborationStyle = getComputedStyle(collaboration);
    const linkStyle = getComputedStyle(link);
    const codeStyle = getComputedStyle(code);
    const cellStyle = getComputedStyle(cell);
    const caretStyle = getComputedStyle(caret);
    const labelStyle = getComputedStyle(label);

    return {
      editorBorderStyle: editorStyle.borderTopStyle,
      editorBorderWidth: editorStyle.borderTopWidth,
      toolbarBorderWidth: toolbarStyle.borderBottomWidth,
      groupBorderWidth: groupStyle.borderRightWidth,
      focusOutlineStyle: plainStyle.outlineStyle,
      focusOutlineWidth: plainStyle.outlineWidth,
      activeBorderWidth: activeStyle.borderTopWidth,
      disabledOpacity: disabledStyle.opacity,
      disabledBorderWidth: disabledStyle.borderTopWidth,
      collaborationBorderWidth: collaborationStyle.borderBottomWidth,
      linkDecoration: linkStyle.textDecorationLine,
      codeBorderWidth: codeStyle.borderTopWidth,
      cellBorderWidth: cellStyle.borderTopWidth,
      caretBorderWidth: caretStyle.borderLeftWidth,
      labelVisible: labelStyle.display !== 'none' && labelStyle.visibility !== 'hidden',
      quoteColor: getComputedStyle(quote).color,
      placeholderColor: getComputedStyle(placeholder, '::before').color,
      canvasTextColor: editorStyle.color,
    };
  });

  await testInfo.attach('forced-colors-content', {
    body: JSON.stringify(evidence, null, 2),
    contentType: 'application/json',
  });
  await page.screenshot({
    path: testInfo.outputPath('forced-colors-content.png'),
    fullPage: true,
  });
  expect(evidence.quoteColor).toBe(evidence.canvasTextColor);
  expect(evidence.placeholderColor).toBe(evidence.canvasTextColor);

  expect(evidence).toMatchObject({
    editorBorderStyle: 'solid',
    editorBorderWidth: '1px',
    toolbarBorderWidth: '1px',
    groupBorderWidth: '1px',
    focusOutlineStyle: 'solid',
    focusOutlineWidth: '2px',
    activeBorderWidth: '1px',
    disabledOpacity: '1',
    disabledBorderWidth: '1px',
    collaborationBorderWidth: '1px',
    linkDecoration: 'underline',
    codeBorderWidth: '1px',
    cellBorderWidth: '1px',
    caretBorderWidth: '2px',
    labelVisible: true,
  });

  const activeButton = page.getByRole('button', { name: 'Active' });
  await page.keyboard.press(tabKey);
  await expect(activeButton).toBeFocused();

  const editable = page.locator('.cwl-editor__content');
  await page.keyboard.press(tabKey);
  await expect(editable).toBeFocused();
  const editableFocusEvidence = await editable.evaluate((element) => {
    const style = getComputedStyle(element);
    return {
      outlineStyle: style.outlineStyle,
      outlineWidth: style.outlineWidth,
    };
  });
  expect(editableFocusEvidence).toEqual({
    outlineStyle: 'solid',
    outlineWidth: '2px',
  });
  await page.screenshot({
    path: testInfo.outputPath('forced-colors-editor-focus.png'),
    fullPage: true,
  });
});

for (const forcedColors of ['none', 'active'] as const) {
  test(`keeps every real toolbar control visible at 320px with forced colors ${forcedColors}`, async ({
    browserName,
    page,
  }, testInfo) => {
    await page.setViewportSize({ width: 320, height: 900 });
    await page.emulateMedia({ forcedColors });
    await page.goto('/tests/browser/input-harness.html?toolbar=1');
    await expect(page.locator('.ProseMirror')).toHaveAttribute('contenteditable', 'true');
    const toolbar = page.getByRole('toolbar', { name: 'Formatting' });
    await expect(toolbar.getByRole('button', { name: 'Insert inline (base64) image' })).toBeVisible();
    const clippedControls = await toolbar.evaluate((element) => {
      const toolbarBounds = element.getBoundingClientRect();
      return Array.from(element.querySelectorAll('button')).flatMap((button) => {
        const bounds = button.getBoundingClientRect();
        const visible = bounds.width > 0 && bounds.height > 0
          && bounds.left >= toolbarBounds.left && bounds.right <= toolbarBounds.right
          && bounds.top >= toolbarBounds.top && bounds.bottom <= toolbarBounds.bottom;
        return visible ? [] : [button.getAttribute('aria-label')];
      });
    });
    await page.screenshot({
      path: testInfo.outputPath(`real-toolbar-320-${forcedColors}.png`),
      fullPage: true,
    });
    expect(clippedControls).toEqual([]);
    if (forcedColors === 'active') {
      const colors = await page.locator('.cwl-editor').evaluate((element) => ({
        canvasText: getComputedStyle(element).color,
        placeholder: getComputedStyle(
          element.querySelector('.is-editor-empty:first-child')!, '::before',
        ).color,
      }));
      expect(colors.placeholder).toBe(colors.canvasText);
    }
    await page.keyboard.press(
      browserName === 'webkit' && process.platform === 'darwin' ? 'Alt+Tab' : 'Tab',
    );
    await expect(toolbar.getByRole('button', { name: 'Bold (Ctrl/Cmd+B)', exact: true })).toBeFocused();
    await page.screenshot({
      path: testInfo.outputPath(`real-toolbar-320-${forcedColors}-focus.png`),
      fullPage: true,
    });
  });
}
