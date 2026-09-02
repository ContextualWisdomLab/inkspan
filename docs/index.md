# Inkspan

[![Ask DeepWiki](https://deepwiki.com/badge.svg)](https://deepwiki.com/ContextualWisdomLab/inkspan)

Inkspan is a modular authoring surface for applications and AI systems, combining rich Markdown/HTML editing, collaboration primitives, deterministic persistence evidence, safe serialization, and Office document rendering.

## Product responsibility

- React + TipTap/ProseMirror Markdown and HTML WYSIWYG editing.
- Safe links and self-contained base64 raster images enforced across parsing, commands, collaboration, and serialization.
- SSR-safe hydration and host-controlled imperative APIs for AI insertion, persistence, and focus.
- Provider-neutral Yjs collaboration with host-owned transport, authorization, persistence, and lifecycle.
- Revision, transition, selection, and autosave evidence for conflict-aware host persistence.
- Offline multilingual typography and email-ready serialization.
- Network-free JSON-to-DOCX/XLSX/PPTX rendering through the bundled Python Office package.

## Onboarding

Install the React package and styles:

```bash
pnpm add @contextualwisdomlab/cwl-editor react react-dom
```

Start with the [repository README](../README.md) for component usage, host APIs, security boundaries, collaboration, persistence evidence, migration routing, email output, and Office rendering.

## Architecture and integration

Inkspan owns deterministic editor/document semantics and reusable local evidence. Hosts retain authenticated authorization, tenant identity, durable persistence, transport, encryption, retention, audit policy, and cross-service workflow authority.

Useful references include:

- [Server rendering](server-rendering.md)
- [Safe hyperlink policy](link-security.md)
- [Accessibility](accessibility.md)
- [Design tokens](design-tokens.md)
- [Revision-guarded restore](revision-guarded-restore.md)
- [Selection lifecycle](selection-lifecycle.md)

## Releases and verification

Use protected-branch history, package releases, current checks, and repository test evidence to determine what is shipped. This source page is only a publication prerequisite; GitHub Pages should be treated as live only after repository settings and the published HTTPS endpoint are verified.

- [Repository](https://github.com/ContextualWisdomLab/inkspan)
- [Ask DeepWiki](https://deepwiki.com/ContextualWisdomLab/inkspan)
