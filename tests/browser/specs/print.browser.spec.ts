import { expect, test } from '@playwright/test';

const HARNESS_URL = 'http://127.0.0.1:4173/tests/browser/harness.html';
const STYLES_URL = 'http://127.0.0.1:4173/src/styles.css';

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
      <section class="cwl-editor">
        <nav class="cwl-toolbar"><button class="cwl-tb-btn">Bold</button></nav>
        <div class="cwl-collaboration-status">Connected</div>
        <div class="cwl-editor__surface">
          <article class="cwl-editor__content">
            <h1>Printable heading</h1>
            <p class="is-editor-empty" data-placeholder="Do not print me"></p>
            <p><a href="https://example.invalid/">Printable link</a></p>
            <pre>const printable = true;</pre>
            <blockquote>Keep this block together where supported.</blockquote>
            <table>
              <thead><tr><th>Header</th></tr></thead>
              <tbody><tr><td>Value</td></tr></tbody>
            </table>
            <span class="collaboration-cursor__caret">
              <span class="collaboration-cursor__label">Remote editor</span>
            </span>
          </article>
        </div>
      </section>
    `;
  });
  expect(rejectedExternalRequests).toEqual([]);
});

test('switches screen editor chrome to a complete paged-document presentation', async ({
  page,
}) => {
  const screen = await page.evaluate(() => {
    const toolbar = document.querySelector<HTMLElement>('.cwl-toolbar');
    const surface = document.querySelector<HTMLElement>('.cwl-editor__surface');
    if (!toolbar || !surface) throw new Error('Print harness is incomplete.');
    return {
      toolbarDisplay: getComputedStyle(toolbar).display,
      surfaceOverflowY: getComputedStyle(surface).overflowY,
      surfaceMaxHeight: getComputedStyle(surface).maxHeight,
    };
  });
  expect(screen.toolbarDisplay).not.toBe('none');
  expect(screen.surfaceOverflowY).toBe('auto');
  expect(screen.surfaceMaxHeight).not.toBe('none');

  await page.emulateMedia({ media: 'print', colorScheme: 'dark' });
  expect(await page.evaluate(() => matchMedia('print').matches)).toBe(true);

  const printed = await page.evaluate(() => {
    const editor = document.querySelector<HTMLElement>('.cwl-editor');
    const toolbar = document.querySelector<HTMLElement>('.cwl-toolbar');
    const collaboration = document.querySelector<HTMLElement>(
      '.cwl-collaboration-status',
    );
    const caret = document.querySelector<HTMLElement>(
      '.collaboration-cursor__caret',
    );
    const label = document.querySelector<HTMLElement>(
      '.collaboration-cursor__label',
    );
    const surface = document.querySelector<HTMLElement>('.cwl-editor__surface');
    const content = document.querySelector<HTMLElement>('.cwl-editor__content');
    const placeholder = document.querySelector<HTMLElement>('.is-editor-empty');
    const heading = document.querySelector<HTMLElement>('h1');
    const pre = document.querySelector<HTMLElement>('pre');
    const link = document.querySelector<HTMLElement>('a');
    if (
      !editor ||
      !toolbar ||
      !collaboration ||
      !caret ||
      !label ||
      !surface ||
      !content ||
      !placeholder ||
      !heading ||
      !pre ||
      !link
    ) {
      throw new Error('Print harness is incomplete.');
    }
    const editorStyle = getComputedStyle(editor);
    const surfaceStyle = getComputedStyle(surface);
    const contentStyle = getComputedStyle(content);
    return {
      editorOverflow: editorStyle.overflow,
      editorBorderTopWidth: editorStyle.borderTopWidth,
      editorBackground: editorStyle.backgroundColor,
      editorColor: editorStyle.color,
      toolbarDisplay: getComputedStyle(toolbar).display,
      collaborationDisplay: getComputedStyle(collaboration).display,
      caretDisplay: getComputedStyle(caret).display,
      labelDisplay: getComputedStyle(label).display,
      surfaceOverflowY: surfaceStyle.overflowY,
      surfaceMaxHeight: surfaceStyle.maxHeight,
      contentOrphans: contentStyle.orphans,
      contentWidows: contentStyle.widows,
      placeholderContent: getComputedStyle(placeholder, '::before').content,
      headingBreakAfter: getComputedStyle(heading).breakAfter,
      preBreakInside: getComputedStyle(pre).breakInside,
      preOverflowX: getComputedStyle(pre).overflowX,
      linkDecoration: getComputedStyle(link).textDecorationLine,
    };
  });

  expect(printed).toEqual({
    editorOverflow: 'visible',
    editorBorderTopWidth: '0px',
    editorBackground: 'rgb(255, 255, 255)',
    editorColor: 'rgb(0, 0, 0)',
    toolbarDisplay: 'none',
    collaborationDisplay: 'none',
    caretDisplay: 'none',
    labelDisplay: 'none',
    surfaceOverflowY: 'visible',
    surfaceMaxHeight: 'none',
    contentOrphans: '3',
    contentWidows: '3',
    placeholderContent: 'none',
    headingBreakAfter: 'avoid',
    preBreakInside: 'avoid',
    preOverflowX: 'visible',
    linkDecoration: 'underline',
  });
});
