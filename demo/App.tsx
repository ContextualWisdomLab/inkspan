import { useMemo, useState } from 'react';
import { CwlEditor, type EditorMode } from '../src/index.js';

const SAMPLE_MD = `# Inkspan

A **commercial-grade** Markdown + HTML editor built on TipTap v2, with
bundled offline fonts for five scripts.

## Multilingual (bundled Noto Sans, no network)

- **Korean** — 한국어: 폐쇄망에서도 완벽하게 렌더링됩니다.
- **English** — The quick brown fox jumps over the lazy dog.
- **Japanese** — 日本語：オフラインでも綺麗に表示されます。
- **Chinese (Simplified)** — 简体中文：完全离线渲染。
- **Chinese (Traditional)** — 繁體中文：完全離線渲染。
- **Vietnamese** — Tiếng Việt: hiển thị đầy đủ dấu, không cần mạng.

## Features

- Markdown *and* HTML modes
- Headings, lists, tables, code blocks, links, marks
- Inline **base64 images** — paste or drop an image and it embeds as a data URI

| Feature | Status |
| ------- | ------ |
| Tables  | ✅     |
| Images  | ✅     |

\`\`\`ts
const answer = 42;
\`\`\`

> Paste an image anywhere — it becomes an inline data URI an LLM can read.
`;

export function App() {
  const [mode, setMode] = useState<EditorMode>('markdown');
  const [value, setValue] = useState(SAMPLE_MD);

  // Reset content to a sensible sample when switching modes for the demo.
  const onModeChange = (next: EditorMode) => {
    setMode(next);
    setValue(next === 'markdown' ? SAMPLE_MD : '<h1>Inkspan</h1><p>HTML mode. Try <strong>bold</strong>, 한국어, 日本語, 中文, Tiếng Việt, and drop an image.</p>');
  };

  const byteInfo = useMemo(() => {
    const imgs = (value.match(/data:image\//g) ?? []).length;
    return `${value.length.toLocaleString()} chars · ${imgs} inline image(s)`;
  }, [value]);

  return (
    <div className="demo">
      <header className="demo__header">
        <h1>Inkspan</h1>
        <p>
          Markdown + HTML WYSIWYG with inline base64 images and bundled offline
          fonts (한국어 · English · 日本語 · 中文 · Tiếng Việt).
        </p>
        <div className="demo__modes">
          <button
            className={mode === 'markdown' ? 'active' : ''}
            onClick={() => onModeChange('markdown')}
          >
            Markdown mode
          </button>
          <button
            className={mode === 'html' ? 'active' : ''}
            onClick={() => onModeChange('html')}
          >
            HTML mode
          </button>
        </div>
      </header>

      <main className="demo__grid">
        <section>
          <h2>Editor</h2>
          <CwlEditor
            mode={mode}
            value={value}
            onChange={setValue}
            image={{ maxSizeBytes: 8 * 1024 * 1024, maxDimension: 1400 }}
          />
        </section>
        <section>
          <h2>
            Serialized {mode} <small>({byteInfo})</small>
          </h2>
          <textarea readOnly value={value} className="demo__source" />
        </section>
      </main>

      <footer className="demo__footer">
        Inkspan · MIT · TipTap/ProseMirror · base64-inline images · Noto Sans
        (OFL-1.1) ·{' '}
        <a href="https://github.com/ContextualWisdomLab/cwl-editor">source</a>
      </footer>
    </div>
  );
}

export default App;
