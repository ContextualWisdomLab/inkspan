// Copy the opt-in stylesheet into dist so consumers can
// `import '@contextualwisdomlab/cwl-editor/styles.css'`.
import { copyFileSync, mkdirSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const src = resolve(root, 'src/styles.css');
const dest = resolve(root, 'dist/cwl-editor.css');

mkdirSync(dirname(dest), { recursive: true });
copyFileSync(src, dest);
console.log(`copied styles.css -> ${dest}`);
