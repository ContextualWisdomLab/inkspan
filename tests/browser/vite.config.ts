import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
import { defineConfig } from 'vite';

const browserDirectory = dirname(fileURLToPath(import.meta.url));
const repositoryRoot = resolve(browserDirectory, '../..');
const configuredPackageEntry = process.env.INKSPAN_BROWSER_PACKAGE_ENTRY?.trim();
const packageEntry = configuredPackageEntry
  ? resolve(configuredPackageEntry)
  : resolve(repositoryRoot, 'src/index.ts');
const packedPackageRoot = configuredPackageEntry
  ? resolve(dirname(packageEntry), '..')
  : null;
const alias = [
  ...(packedPackageRoot
    ? [
        {
          find: '@contextualwisdomlab/cwl-editor/styles.css',
          replacement: resolve(packedPackageRoot, 'dist/cwl-editor.css'),
        },
        {
          find: '@contextualwisdomlab/cwl-editor/fonts.css',
          replacement: resolve(packedPackageRoot, 'src/fonts/fonts.css'),
        },
        {
          find: '@contextualwisdomlab/cwl-editor/fonts-latin.css',
          replacement: resolve(packedPackageRoot, 'src/fonts/fonts-latin.css'),
        },
        {
          find: '@contextualwisdomlab/cwl-editor',
          replacement: packageEntry,
        },
      ]
    : []),
  {
    find: 'inkspan-browser-under-test',
    replacement: packageEntry,
  },
];

export default defineConfig({
  resolve: {
    alias,
  },
});