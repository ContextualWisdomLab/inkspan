# cwl-editor

**Commercial-grade Markdown + HTML WYSIWYG editor** built on
[TipTap v2](https://tiptap.dev/) / [ProseMirror](https://prosemirror.net/)
(both MIT), with **inline base64 images** and a **standalone base64 converter**.

- 📝 **Two modes** — a Markdown editor and an HTML WYSIWYG editor sharing one
  toolbar, keyboard shortcuts, and paste handling.
- 🖼 **Images are inline base64 data URIs** — paste, drop, or upload an image and
  it is embedded directly in the document (`![alt](data:image/png;base64,…)` /
  `<img src="data:…">`). Nothing is uploaded to a server, so the content is fully
  self-contained and a downstream **LLM can read the image bytes straight from
  the text**. Configurable size guard + downscaling.
- 🔁 **Round-trip safe** — the embedded data URI survives Markdown ⇄ HTML
  conversion in both directions.
- 🧩 **Standalone base64 converter** — `File`/`Blob`/`ArrayBuffer` → data URI and
  back, with MIME sniffing and a size guard. **Zero dependencies, no React** —
  reusable on its own (e.g. by the *naruon* / DOM-understanding pipeline).
- 📦 **Standalone _and_ embeddable** — own Vite build + demo, publishable as an
  npm package, or vendorable as a git submodule.
- ⚖️ **MIT** — permissive licenses only (TipTap MIT, ProseMirror MIT). No
  GPL/AGPL.

All configuration comes from **props / KV**, never from `process.env` or OS
environment lookups at runtime.

---

## Install

```bash
pnpm add @contextualwisdomlab/cwl-editor
# peer deps (only needed for the React editor, not the converter)
pnpm add react react-dom
```

## Quick start (React)

```tsx
import { useState } from 'react';
import { CwlEditor } from '@contextualwisdomlab/cwl-editor';
import '@contextualwisdomlab/cwl-editor/styles.css';

export function Example() {
  const [md, setMd] = useState('# Hello\n\nDrop an image below 👇');
  return (
    <CwlEditor
      mode="markdown"            // or "html"
      value={md}
      onChange={setMd}
      image={{ maxSizeBytes: 8 * 1024 * 1024, maxDimension: 1400, quality: 0.85 }}
    />
  );
}
```

Switch `mode` to `"html"` and `value`/`onChange` speak HTML instead of Markdown.
Both modes embed images as inline base64.

### Props

| Prop           | Type                        | Default             | Notes |
| -------------- | --------------------------- | ------------------- | ----- |
| `mode`         | `'markdown' \| 'html'`      | `'markdown'`        | Format of `value`/`onChange`. |
| `value`        | `string`                    | —                   | Controlled document. |
| `defaultValue` | `string`                    | `''`                | Uncontrolled initial document. |
| `onChange`     | `(value: string) => void`   | —                   | Serialized document in `mode`'s format. |
| `placeholder`  | `string`                    | `'Start writing…'`  | |
| `editable`     | `boolean`                   | `true`              | Read-only when false. |
| `hideToolbar`  | `boolean`                   | `false`             | |
| `image`        | `ImageConfig`               | see below           | Inline base64 behaviour. |
| `onReady`      | `(editor: Editor) => void`  | —                   | Escape hatch to the TipTap instance. |

`ImageConfig`: `{ maxSizeBytes?: number; maxDimension?: number; quality?: number }`
— defaults `10 MB`, `1600 px`, `0.85`. Set `maxDimension: 0` to disable downscaling.

## Standalone base64 converter (no React)

```ts
import {
  fileToDataUri,
  dataUriToBytes,
  bytesToDataUri,
  sniffMimeType,
  Base64SizeError,
} from '@contextualwisdomlab/cwl-editor/converter';

// Encode a figure for LLM consumption:
const dataUri = await fileToDataUri(file, { maxBytes: 5_000_000 });
// -> "data:image/png;base64,iVBORw0KGgo…"

// Decode back to bytes (with MIME + size guard):
const { mimeType, bytes } = dataUriToBytes(dataUri, { maxBytes: 5_000_000 });
```

The converter is framework-agnostic and works in both Node.js and the browser.
Full surface: `bytesToBase64` / `base64ToBytes`, `bytesToDataUri` /
`arrayBufferToDataUri`, `blobToDataUri` / `fileToDataUri`, `parseDataUri` /
`isDataUri`, `dataUriToBytes` / `dataUriToBlob` / `dataUriByteLength`,
`sniffMimeType`, `toUint8Array`.

## Markdown ⇄ HTML utilities

```ts
import { markdownToHtml, htmlToMarkdown } from '@contextualwisdomlab/cwl-editor';

const html = markdownToHtml('# Title\n\n![fig](data:image/png;base64,…)');
const md = htmlToMarkdown(html); // data URI preserved verbatim
```

---

## Use as a git submodule

```bash
git submodule add https://github.com/ContextualWisdomLab/cwl-editor.git vendor/cwl-editor
cd vendor/cwl-editor && pnpm install && pnpm build
```

Then import from the built `dist/`, or point your bundler at `src/index.ts` for a
source build. The converter (`src/converter/index.ts`) has no React/TipTap deps
and can be imported entirely on its own.

## Standalone demo

```bash
pnpm install
pnpm dev            # live demo at http://localhost:5173
pnpm build:demo     # static site -> dist-demo/
```

### Docker (static demo)

```bash
docker build -t cwl-editor-demo .
docker run --rm -p 8080:80 cwl-editor-demo   # http://localhost:8080
```

## Scripts

| Command             | Description |
| ------------------- | ----------- |
| `pnpm dev`          | Vite dev server for the demo. |
| `pnpm build`        | Build the library (ESM + CJS + types) and the standalone converter bundle. |
| `pnpm build:demo`   | Build the static demo to `dist-demo/`. |
| `pnpm test`         | Run the vitest suite. |
| `pnpm coverage`     | Tests with coverage. |
| `pnpm typecheck`    | `tsc --noEmit`. |

## Testing

- **Converter** — encode / decode / round-trip / size-guard / MIME sniffing.
- **Markdown ⇄ HTML** — round-trip with an embedded base64 image, verifying the
  original image bytes are recoverable after `md → html → md`.
- **Editor component** — smoke tests (render, markdown/HTML hydration, toolbar,
  read-only, `onReady`) via vitest + @testing-library/react.

## Architecture

```
src/
  converter/      Framework-agnostic base64 / data-URI utils (standalone export)
  markdown/       marked + turndown serializers (base64-image round-trip safe)
  extensions/     Base64Image TipTap extension + shared extension kit
  components/      CwlEditor React component + Toolbar
  styles.css      Self-contained, theme-aware styling
demo/             Standalone Vite demo app
docs/papers/      CommonMark spec + citations (see docs/papers/README.md)
```

## Licenses

MIT. Dependency licenses are all permissive: TipTap (MIT), ProseMirror (MIT),
`marked` (MIT), `turndown` (MIT), `turndown-plugin-gfm` (MIT). No GPL/AGPL.

See [`docs/papers/README.md`](docs/papers/README.md) for the CommonMark
specification and citations.

---

🤖 Generated with [Claude Code](https://claude.com/claude-code)
