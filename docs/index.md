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
- Network-free JSON-to-DOCX/XLSX/PPTX rendering through the separately installed Inkspan Office Python package.

## Onboarding

Install the React package and styles:

```bash
pnpm add @contextualwisdomlab/cwl-editor react react-dom
```

Start with the [repository README](https://github.com/ContextualWisdomLab/inkspan#readme) for component usage, host APIs, security boundaries, collaboration, persistence evidence, migration routing, email output, and Office rendering.

## Architecture and integration

Inkspan owns deterministic editor/document semantics and reusable local evidence. Hosts retain authenticated authorization, tenant identity, durable persistence, transport, encryption, retention, audit policy, and cross-service workflow authority.

Useful references include:

- [Canonical documentation index](README.md)
- [Server rendering](server-rendering.md)
- [Safe hyperlink policy](link-security.md)
- [Accessibility](accessibility.md)
- [Design tokens](design-tokens.md)
- [Revision-guarded restore](revision-guarded-restore.md)
- [Selection lifecycle](selection-lifecycle.md)

## Releases and verification

Use the [release evidence authority](adr/0010-release-evidence-authority.md) and [release security contract](release-security.md) to determine what is shipped. Release only the exact integrated protected-main head after its version identity, artifact inventory and digests, package-consumer evidence, required test, security and accessibility gates, SBOM and provenance, formal review, and repository-protection evidence all pass. Missing, conflicting, stale, or unverified evidence fails closed; a package release or green checks alone are insufficient. This source page is only a publication prerequisite; GitHub Pages should be treated as live only after repository settings and the published HTTPS endpoint are verified.

- [Repository](https://github.com/ContextualWisdomLab/inkspan)
- [Ask DeepWiki](https://deepwiki.com/ContextualWisdomLab/inkspan)
