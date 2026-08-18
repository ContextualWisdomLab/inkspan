# Editor chrome design tokens

Status: Active PR / Proposed

Use this catalog when you need to re-theme Inkspan's repeating toolbar and editor chrome. Protected-main CSS defaults remain the shipped presentation baseline; the Active-PR repaired dark active-toolbar pair uses `--cwl-accent: #58a6ff` on `--cwl-accent-soft: #163356` and measures about 5.06:1. When a host overrides any color token, re-check WCAG 2.2 contrast for both body text (`--cwl-fg` on `--cwl-bg`) and active toolbar text (`--cwl-accent` on `--cwl-accent-soft`). Do not edit Inkspan internals.

```css
.cwl-editor {
  --cwl-accent: #0b6e4f;
  --cwl-accent-soft: #d8f3e8;
}
```

```ts
import {
  contrastRatioFromHex,
  getEditorThemeTokenContrast,
  listEditorThemeTokens,
  toDesignTokenFormatGroup,
} from '@contextualwisdomlab/cwl-editor';

const tokens = listEditorThemeTokens();
const dtcgGroup = toDesignTokenFormatGroup();
const body = getEditorThemeTokenContrast('cwl-fg', 'cwl-bg', 'light');
const activeDark = getEditorThemeTokenContrast('cwl-accent', 'cwl-accent-soft', 'dark');
const overrideRatio = contrastRatioFromHex('#0b6e4f', '#d8f3e8');
if (!body.meetsTextContrast || !activeDark.meetsTextContrast || overrideRatio < 4.5) {
  throw new Error(activeDark.hostAction);
}
void tokens;
void dtcgGroup;
```

The default-theme checks above are active-PR product evidence, not protected-main shipped evidence or a host WCAG certification. The stylesheet remains runtime presentation authority. `toDesignTokenFormatGroup()` is an interchange snapshot aligned to Design Tokens Format Module 2025.10; it is not complete DTCG conformance or Figma Variables sync.

Preview the repeating objects in Storybook (`pnpm storybook`) using the inventory in [`storybook-inventory.md`](storybook-inventory.md).

```mermaid
flowchart LR
  Host[Host brand CSS] --> Editor[".cwl-editor custom properties"]
  Catalog[listEditorThemeTokens] --> Host
  Editor --> Toolbar[".cwl-toolbar / .cwl-tb-btn"]
  Editor --> Surface[".cwl-editor document surface"]
  Storybook[Storybook inventory] --> Toolbar
  Storybook --> Surface
```
