# Inkspan

> **Inkspan** ([inkspan.io](https://inkspan.io)) — the product. Repository slug:
> `cwl-editor`. npm package: `@contextualwisdomlab/cwl-editor`.

**Commercial-grade Markdown + HTML WYSIWYG editor** built on
[TipTap v2](https://tiptap.dev/) / [ProseMirror](https://prosemirror.net/)
(both MIT), with **inline base64 images**, a **standalone base64 converter**, and
**bundled offline multilingual fonts**.

- 📝 **Two modes** — a Markdown editor and an HTML WYSIWYG editor sharing one
  toolbar, keyboard shortcuts, and paste handling.
- 🖼 **Images are inline base64 data URIs** — paste, drop, or upload an image and
  it is embedded directly in the document (`![alt](data:image/png;base64,…)` /
  `<img src="data:…">`). Nothing is uploaded to a server, so the content is fully
  self-contained and a downstream **LLM can read the image bytes straight from
  the text**. Configurable size guard + downscaling.
- 🌏 **Bundled offline fonts** — self-contained [Noto Sans](https://fonts.google.com/noto)
  web fonts covering **Korean, English, Japanese, Chinese (Simplified +
  Traditional) and Vietnamese**. No CDN, no Google Fonts URL — every glyph
  renders with **zero network fetch**, so it works in **air-gapped / 폐쇄망**
  environments. All fonts are **SIL OFL 1.1** (no copyright/licensing issues).
- 🔁 **Round-trip safe** — the embedded data URI survives Markdown ⇄ HTML
  conversion in both directions.
- 🧩 **Standalone base64 converter** — `File`/`Blob`/`ArrayBuffer` → data URI and
  back, with MIME sniffing and a size guard. **Zero dependencies, no React** —
  reusable on its own (e.g. by the *naruon* / DOM-understanding pipeline).
- 📦 **Standalone _and_ embeddable** — own Vite build + demo, publishable as an
  npm package, or vendorable as a git submodule.
- ⚖️ **MIT** code + **OFL-1.1** fonts — permissive licenses only (TipTap MIT,
  ProseMirror MIT, Noto Sans OFL-1.1). No GPL/AGPL.

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
import '@contextualwisdomlab/cwl-editor/fonts.css'; // bundled offline fonts (see below)

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

## Bundled offline fonts (Korean / English / Japanese / Chinese / Vietnamese)

Inkspan ships **self-contained web fonts** so the editor renders all five
scripts **without any network fetch** — ideal for **air-gapped / 폐쇄망**
deployments. The fonts are the [Noto Sans](https://fonts.google.com/noto)
family under the **SIL Open Font License 1.1** (no copyright/licensing issues,
compatible with the MIT code):

| Family         | Scripts                                   | Weights  |
| -------------- | ----------------------------------------- | -------- |
| Noto Sans      | Latin, Latin-ext, **Vietnamese**, Cyrillic | 400, 700 |
| Noto Sans KR   | **Korean** (Hangul)                       | 400      |
| Noto Sans JP   | **Japanese** (Kana + Kanji)               | 400      |
| Noto Sans SC   | **Chinese, Simplified**                   | 400      |
| Noto Sans TC   | **Chinese, Traditional**                  | 400      |

The `@font-face` rules point at **woff2 files bundled inside the package**
(`src/fonts/files/`), split by `unicode-range` — never a CDN or Google Fonts
URL. Because they are `unicode-range`-subset, a browser only downloads the
subset files whose glyphs actually appear, and everything resolves from local
bundled bytes.

```tsx
// Full multilingual stack (all five scripts):
import '@contextualwisdomlab/cwl-editor/fonts.css';

// …or Latin/Vietnamese only — opt out of the ~9 MB of CJK to keep it tiny:
import '@contextualwisdomlab/cwl-editor/fonts-latin.css';
```

The default editor font stack
(`--cwl-font: 'Noto Sans', 'Noto Sans KR', 'Noto Sans JP', 'Noto Sans SC',
'Noto Sans TC', …`) is set in `styles.css`, so once you import a fonts CSS the
scripts render automatically. Override `--cwl-font` to re-theme.

**Size tradeoff.** Full CJK coverage is inherently large: the complete bundle is
**≈ 9.7 MB across ~470 woff2 subset files** (Latin 400+700 ≈ 0.8 MB; each CJK
family at weight 400 ≈ 1.8–2.7 MB). To control this:

- **Tree-shake CJK** — import `fonts-latin.css` instead of `fonts.css` if you
  only need Latin/Vietnamese (a few hundred KB).
- **Runtime cost is small** — `unicode-range` subsetting means only the subset
  files for glyphs on the page are ever fetched from the bundle.
- **CJK bold is synthesized** — CJK families ship weight 400 only; browsers
  render bold headings with faux-bold. Regenerate with 700 via
  `scripts/fetch-fonts.mjs` if you need true CJK bold (roughly doubles CJK size).
- **Regenerate** the bundle any time with `node scripts/fetch-fonts.mjs` (the
  only step that touches the network; rendering never does).

License: [`src/fonts/OFL.txt`](src/fonts/OFL.txt) +
[`src/fonts/NOTICE`](src/fonts/NOTICE).

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
  fonts/          Bundled Noto Sans woff2 (offline) + fonts.css / fonts-latin.css
                  + OFL.txt + NOTICE
  styles.css      Self-contained, theme-aware styling
demo/             Standalone Vite demo app (renders all five scripts offline)
scripts/          copy-styles + fetch-fonts (font bundle generator)
docs/papers/      CommonMark spec + citations (see docs/papers/README.md)
```

## Licenses

**Code: MIT.** Dependency licenses are all permissive: TipTap (MIT), ProseMirror
(MIT), `marked` (MIT), `turndown` (MIT), `turndown-plugin-gfm` (MIT). No
GPL/AGPL.

**Fonts: SIL OFL 1.1.** The bundled Noto Sans families are under the SIL Open
Font License 1.1 — permissive and compatible with MIT (fonts are content, not
linked code). Full text: [`src/fonts/OFL.txt`](src/fonts/OFL.txt); attribution:
[`src/fonts/NOTICE`](src/fonts/NOTICE).

See [`docs/papers/README.md`](docs/papers/README.md) for the CommonMark
specification and citations.

---

🤖 Generated with [Claude Code](https://claude.com/claude-code)
