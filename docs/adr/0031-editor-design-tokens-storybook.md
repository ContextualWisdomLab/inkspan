# ADR 0031: Editor chrome design tokens and Storybook inventory

Status: Proposed

## Context

Inkspan ships repeating toolbar buttons, groups, and editor chrome styled through `--cwl-*` custom properties. Hosts already re-theme by overriding those properties, but the names, light/dark/forced-colors values, and buyer next action lived only inside `src/styles.css`. There was no typed catalog, no Design Tokens Format Module interchange snapshot, and no Storybook inventory of the repeating objects.

## Alternatives considered

1. **Leave theming as undocumented CSS.** Rejected because hosts would keep reading internals and drift from the shipped token set.
2. **Generate CSS from a new token source of truth.** Rejected for this slice because it would rewrite the protected stylesheet and collide with print, forced-colors, and Office-unrelated presentation contracts.
3. **Add Figma Variables sync or a design-tool connector.** Rejected because Figma/design-tool credentials and sync authority are host-owned; Inkspan remains independently usable.
4. **Publish a named catalog plus Storybook inventory while CSS remains runtime authority.** Selected because hosts can override and preview repeating chrome without moving presentation authority or adding a design-tool runtime.

## Decision

Inkspan publishes a host-facing theme-token catalog for the nine shipped chrome tokens, a Design Tokens Format Module 2025.10 interchange snapshot, and a Storybook inventory of repeating toolbar/editor objects. Hosts override `--cwl-*` on `.cwl-editor` after checking WCAG 2.2 contrast. Unknown token names fail closed. No Figma, network, persistence, credential, or model authority is added.

## Consequences and ownership trade-offs

Hosts gain a copyable token list and a Storybook preview. Inkspan keeps CSS as the runtime source. naruon and other CWL hosts can apply the same overrides through host-owned brand CSS. Complete DTCG conformance, Figma Variables, and host WCAG certification remain out of scope.

## Failure and recovery

An unknown token name throws `EditorThemeTokenError` without reflecting caller input. A host override that fails contrast is recovered by changing only the named tokens, not by editing Inkspan internals or disabling forced-colors.

## Security and privacy impact

The catalog contains only public presentation values. It does not carry document bodies, tenant identifiers, credentials, or diagnostics. Storybook is a local development preview and is not a production transport.

## Compatibility and migration

The catalog is additive. Existing CSS overrides on `.cwl-editor` continue to work. A later CSS token addition must update the catalog, Storybook inventory, and this ADR together.

## Verification and acceptance evidence

Required evidence includes token-catalog tests against `src/styles.css`, documentation-contract tests, Storybook inventory stories for toolbar button states and token swatches, and exact-head CI/coverage/package/security gates on the unchanged head. This ADR stays Proposed until protected integration.

## Rollback or supersession

Rollback removes the catalog export, Storybook inventory/config, operator/doctoring records, and this ADR together. Supersession requires a new ADR if CSS ceases to be runtime presentation authority or if a design-tool sync contract is accepted.
