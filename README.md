# Inkspan

> **Inkspan** ([inkspan.io](https://inkspan.io)) is the product. Repository:
> `ContextualWisdomLab/inkspan`. npm package:
> `@contextualwisdomlab/cwl-editor`.

Inkspan is a modular, commercial-grade authoring surface for applications and
AI systems. It combines a React Markdown/HTML WYSIWYG editor, self-contained
base64 images, offline multilingual fonts, email-ready serialization, a
framework-independent data-URI converter, and a deterministic Office Open XML
renderer for DOCX, XLSX, and PPTX.

## Product capabilities

- **Markdown and HTML editing** — one TipTap/ProseMirror editor, toolbar,
  keyboard behavior, tables, links, code blocks, lists, and horizontal rules.
- **Self-contained images** — paste, drop, or upload images as inline base64
  data URIs. Configurable size limits and downscaling keep the document portable
  and directly readable by downstream LLMs.
- **Host-grade control** — controlled/uncontrolled modes, an imperative ref API,
  AI insertion at the current selection, read-only mode, image-error reporting,
  and access to the underlying TipTap instance.
- **Email output** — Markdown-to-email HTML conversion preserves inline base64
  figures and can emit either a fragment or a complete HTML document.
- **Offline multilingual typography** — bundled Noto Sans subsets cover Korean,
  English, Japanese, Simplified/Traditional Chinese, and Vietnamese with no CDN
  or runtime font request.
- **Standalone conversion utilities** — browser/Node data-URI and base64 helpers
  are available without React or TipTap.
- **AI-authored Office files** — a network-free Python package renders strict
  JSON to DOCX, XLSX, or PPTX with formula-injection protection, losslessness
  checks, atomic publication, and a bundled JSON Schema.
- **Permissive licensing** — application code and direct dependencies are MIT;
  bundled Noto fonts are SIL OFL 1.1. No GPL/AGPL dependency is introduced.

Runtime configuration is supplied through props or host-owned values. Inkspan
does not read `process.env` or operating-system environment variables at
runtime.

## Distribution surfaces

| Surface | Import or location | Purpose |
| --- | --- | --- |
| React editor | `@contextualwisdomlab/cwl-editor` | Markdown/HTML WYSIWYG component and serializers |
| Converter | `@contextualwisdomlab/cwl-editor/converter` | Framework-independent base64/data-URI utilities |
| Styles | `@contextualwisdomlab/cwl-editor/styles.css` | Editor layout and theming |
| Full fonts | `@contextualwisdomlab/cwl-editor/fonts.css` | KR/EN/JP/SC/TC/VI offline font bundle |
| Latin fonts | `@contextualwisdomlab/cwl-editor/fonts-latin.css` | Smaller Latin/Vietnamese-only bundle |
| Office renderer | [`office/`](office/) | Strict JSON → DOCX/XLSX/PPTX Python package and CLI |

---

## React editor

### Install

```bash
pnpm add @contextualwisdomlab/cwl-editor react react-dom
```

### Quick start

```tsx
import { useState } from 'react';
import { CwlEditor } from '@contextualwisdomlab/cwl-editor';
import '@contextualwisdomlab/cwl-editor/styles.css';
import '@contextualwisdomlab/cwl-editor/fonts.css';

export function Example() {
  const [markdown, setMarkdown] = useState(
    '# Hello\n\nDrop an image below 👇',
  );

  return (
    <CwlEditor
      mode="markdown"
      value={markdown}
      onChange={setMarkdown}
      onImageError={(error) => console.error('image rejected', error)}
      image={{
        maxSizeBytes: 8 * 1024 * 1024,
        maxDimension: 1400,
        quality: 0.85,
      }}
    />
  );
}
```

Set `mode="html"` when `value` and `onChange` should exchange HTML. Both modes
embed accepted images as inline data URIs.

### Imperative host API

Hosts that submit forms, insert AI output, or manage focus should use
`CwlEditorHandle` rather than scraping the DOM.

```tsx
import { useRef } from 'react';
import {
  CwlEditor,
  type CwlEditorHandle,
} from '@contextualwisdomlab/cwl-editor';

const editorRef = useRef<CwlEditorHandle>(null);

<CwlEditor
  ref={editorRef}
  mode="markdown"
  defaultValue="# Draft"
/>;

editorRef.current?.getValue();
editorRef.current?.getHTML();
editorRef.current?.getMarkdown();
editorRef.current?.insertValue('AI-authored text at the cursor');
editorRef.current?.setValue('# Replace the complete document');
editorRef.current?.focus();
```

`insertValue` is mode-aware, inserts at the current selection, and triggers the
normal `onChange` path without wiping the document.

### Main props

| Prop | Type | Default | Notes |
| --- | --- | --- | --- |
| `mode` | `'markdown' \| 'html'` | `'markdown'` | Serialization used by `value` and `onChange` |
| `value` | `string` | — | Controlled document value |
| `defaultValue` | `string` | `''` | Uncontrolled initial document |
| `onChange` | `(value: string) => void` | — | Emits the active mode's serialization |
| `onImageError` | `(error: unknown) => void` | — | Reports paste/drop/upload rejection and decode failures |
| `placeholder` | `string` | `'Start writing…'` | Empty-editor prompt |
| `editable` | `boolean` | `true` | Read-only when false |
| `hideToolbar` | `boolean` | `false` | Suppresses the built-in toolbar |
| `image` | `ImageConfig` | See below | Inline-image limits and downscaling |
| `onReady` | `(editor: Editor) => void` | — | Receives the TipTap editor instance |
| `ref` | `Ref<CwlEditorHandle>` | — | Imperative host surface |

`ImageConfig` is
`{ maxSizeBytes?: number; maxDimension?: number; quality?: number }`. Defaults
are 10 MB, 1600 px, and 0.85. Set `maxDimension: 0` to disable downscaling.

The table toolbar supports add/delete row, add/delete column, and delete table.
Toolbar active and disabled states follow editor transactions and selection
updates.

## Markdown, HTML, and email serialization

```ts
import {
  htmlToMarkdown,
  markdownToEmailHtml,
  markdownToHtml,
} from '@contextualwisdomlab/cwl-editor';

const html = markdownToHtml(
  '# Title\n\n![figure](data:image/png;base64,...)',
);
const markdown = htmlToMarkdown(html);
const emailFragment = markdownToEmailHtml(markdown);
const emailDocument = markdownToEmailHtml(markdown, {
  fullDocument: true,
  title: 'Weekly update',
});
```

The GFM/CommonMark pipeline preserves inline image data URIs through Markdown ⇄
HTML conversion. `markdownToEmailHtml` creates an email body, not a complete
MIME multipart message.

## Standalone base64 converter

```ts
import {
  Base64SizeError,
  bytesToDataUri,
  dataUriToBytes,
  fileToDataUri,
  sniffMimeType,
} from '@contextualwisdomlab/cwl-editor/converter';

const dataUri = await fileToDataUri(file, { maxBytes: 5_000_000 });
const { mimeType, bytes } = dataUriToBytes(dataUri, {
  maxBytes: 5_000_000,
});
```

The converter works in Node.js and browsers and does not import React or
TipTap. The public surface also includes byte/base64 conversion, Blob and
ArrayBuffer conversion, data-URI parsing and validation, MIME sniffing, byte
length calculation, and typed converter errors.

## Offline fonts

Import the full multilingual bundle:

```ts
import '@contextualwisdomlab/cwl-editor/fonts.css';
```

Or use the smaller Latin/Vietnamese subset:

```ts
import '@contextualwisdomlab/cwl-editor/fonts-latin.css';
```

The full package contains Noto Sans web-font subsets for Korean, English,
Japanese, Simplified Chinese, Traditional Chinese, and Vietnamese. All files
resolve locally from the package. Unicode-range subsetting lets browsers request
only the glyph subsets used on the page.

The complete CJK bundle is approximately 9.7 MB across many WOFF2 subsets.
Applications that do not require CJK should import `fonts-latin.css`. CJK
families currently ship weight 400; browsers synthesize bold unless the font
bundle is regenerated with weight 700.

Font license and attribution:
[`src/fonts/OFL.txt`](src/fonts/OFL.txt) and
[`src/fonts/NOTICE`](src/fonts/NOTICE).

---

## Inkspan Office

Inkspan Office is a separate Python distribution under [`office/`](office/).
It accepts an allowlisted JSON contract and generates Office Open XML without
calling an LLM, fetching remote content, executing macros, or driving desktop
Office software.

### Install and run

```bash
cd office
python -m pip install -e '.[test]'
inkspan-office --print-schema
inkspan-office request.json output.docx
```

### Python API

```python
from inkspan_office import render_office_document, write_office_document

request = {
    "format": "xlsx",
    "title": "Quarterly metrics",
    "sheets": [
        {
            "name": "Summary",
            "header_row": True,
            "freeze_panes": "A2",
            "auto_filter": True,
            "rows": [
                ["Metric", "Value"],
                ["Revenue", 120],
                ["Churn", 0.03],
            ],
        }
    ],
}

artifact = render_office_document(request)
assert artifact.extension == '.xlsx'
write_office_document(request, 'quarterly-metrics.xlsx')
```

Supported document shapes:

- DOCX — metadata, headings, paragraphs, ordered/unordered lists, tables, and
  page breaks.
- XLSX — multiple worksheets, scalar cells, header styling, freeze panes,
  filters, and bounded column sizing.
- PPTX — title/subtitle slides and title/bullet slides with nesting levels.

The renderer rejects unknown fields, XML-incompatible controls, cyclic Python
containers, non-finite numbers, formula-like strings as executable formulas,
invalid worksheet names and freeze panes, non-rectangular Word tables, and Excel
content that would be truncated or lose integer precision. Non-overwrite file
publication is atomic and race-safe. See [`office/README.md`](office/README.md)
for the complete contract and security limits.

---

## Git submodule integration

```bash
git submodule add \
  https://github.com/ContextualWisdomLab/inkspan.git \
  vendor/inkspan
cd vendor/inkspan
pnpm install
pnpm build
```

Consumers can import the built `dist/` artifacts or point a source build at
`src/index.ts`. The converter remains independently importable from
`src/converter/index.ts`.

## Demo and container

```bash
pnpm install
pnpm dev
pnpm build:demo
```

```bash
docker build -t inkspan-demo .
docker run --rm -p 8080:8080 inkspan-demo
```

The static demo is then available at `http://localhost:8080`.

## Verification

```bash
pnpm install --frozen-lockfile
pnpm typecheck
pnpm test
pnpm coverage
pnpm build
pnpm build:demo

cd office
python -m pip install -e '.[test]'
python scripts/check_docstrings.py
coverage run -m pytest
coverage report
python -m pip check
python -m pip wheel . --no-deps --wheel-dir dist
```

The repository CI pins GitHub Actions by full commit SHA. The Office matrix uses
hash-locked binary dependencies on Python 3.11 and 3.13. JavaScript and Python
shipped code are gated at 100% coverage; the Python package additionally enforces
100% shipped-symbol docstring coverage and verifies the contents of its built
wheel.

## Architecture

```text
src/
  components/      React editor and toolbar
  converter/       Framework-independent base64/data-URI utilities
  extensions/      TipTap extension kit and inline Base64Image extension
  fonts/           Offline Noto Sans subsets, CSS, license, and attribution
  markdown/        Markdown/HTML/email serializers
  styles.css       Self-contained theme-aware editor styling
demo/              Standalone Vite demo
office/            JSON Schema, Python renderer/CLI, tests, and package metadata
scripts/           Build helpers and offline-font generator
docs/              Design records, specifications, and citations
```

Inkspan is designed to run independently and as a module within CWL/naruon
hosts. The editor, converter, and Office renderer have separate dependency and
runtime boundaries so hosts can adopt only the capabilities they require.

## Licenses

- **Code:** MIT.
- **Editor dependencies:** TipTap, ProseMirror, marked, turndown, and
  turndown-plugin-gfm are permissively licensed.
- **Office dependencies:** python-docx, openpyxl, and python-pptx are MIT.
- **Fonts:** Noto Sans families are SIL Open Font License 1.1.

See [`LICENSE`](LICENSE), [`src/fonts/OFL.txt`](src/fonts/OFL.txt), and
[`src/fonts/NOTICE`](src/fonts/NOTICE).
