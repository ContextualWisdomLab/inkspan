import { expect, test } from '@playwright/test';
import { readFileSync, realpathSync } from 'node:fs';
import { dirname, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

const repositoryRoot = resolve(dirname(fileURLToPath(import.meta.url)), '../../..');
const packageEntry = process.env.INKSPAN_BROWSER_PACKAGE_ENTRY?.trim();
const stylesheetPath = realpathSync(packageEntry
  ? resolve(dirname(resolve(packageEntry)), 'cwl-editor.css')
  : resolve(repositoryRoot, 'dist/cwl-editor.css')).split(sep).join('/');

test('loads the selected stylesheet in the actual input editor', async ({ page }) => {
  await page.goto('/tests/browser/input-harness.html?toolbar=1');
  await expect(page.getByRole('textbox', { name: 'Editor' })).toBeVisible();
  await expect.poll(() => page.locator('style[data-vite-dev-id]').evaluateAll(
    (elements) => elements.map((element) => element.getAttribute('data-vite-dev-id')),
  )).toContain(stylesheetPath);
});

test('serves the selected stylesheet at the shared focus and print URL', async ({ request }) => {
  const moduleResponse = await request.get('/dist/cwl-editor.css?import');
  expect(moduleResponse.ok()).toBe(true);
  expect(await moduleResponse.text()).toContain(JSON.stringify(stylesheetPath));

  const stylesheetResponse = await request.get('/dist/cwl-editor.css?direct');
  expect(stylesheetResponse.ok()).toBe(true);
  expect((await stylesheetResponse.text()).trim()).toBe(readFileSync(stylesheetPath, 'utf8').trim());
});
