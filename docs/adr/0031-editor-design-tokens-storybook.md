# ADR 0031: Editor chrome design tokens and Storybook inventory

Status: Proposed

## Context

Inkspan ships repeating toolbar buttons, groups, and editor chrome styled through `--cwl-*` custom properties. Hosts already re-theme by overriding those properties, but the names, light/dark/print values, and buyer next action lived only inside `src/styles.css`. There was no typed catalog, no Design Tokens Format Module interchange snapshot, and no Storybook inventory of the repeating objects.

Inventorying the actual active-toolbar foreground/background pair also exposed a product-owned accessibility defect: the former dark `--cwl-accent: #4493f8` on `--cwl-accent-soft: #163356` produced about 4.13:1 for 13px active-button text, below the WCAG 2.2 4.5:1 normal-text threshold. Treating that shipped-default failure as a host override responsibility would contradict Inkspan's ownership of its default presentation.

## Alternatives considered

1. **Leave theming as undocumented CSS.** Rejected because hosts would keep reading internals and drift from the shipped token set.
2. **Generate CSS from a new token source of truth.** Rejected for this slice because it would rewrite the protected stylesheet and collide with print, forced-colors, and Office-unrelated presentation contracts.
3. **Add Figma Variables sync or a design-tool connector.** Rejected because Figma/design-tool credentials and sync authority are host-owned; Inkspan remains independently usable.
4. **Disclose the failing shipped dark pair and require every host to override it.** Rejected because the default palette is Inkspan-owned; documenting a product defect does not repair it.
5. **Publish a named catalog plus Storybook inventory while CSS remains runtime authority, and repair any failing shipped inventoried pair at the stylesheet boundary.** Selected because hosts can override and preview repeating chrome without moving presentation authority, while Inkspan remains accountable for its own defaults.

## Decision

Inkspan publishes a host-facing theme-token catalog for the nine shipped chrome tokens, a Design Tokens Format Module 2025.10 interchange snapshot, and a Storybook inventory of repeating toolbar/editor objects. Inkspan's own inventoried normal-text pairs must meet the WCAG 2.2 4.5:1 threshold in shipped light/dark/print defaults; the dark accent is therefore `#58a6ff` on `#163356` for active toolbar text, about 5.06:1. Hosts overriding `--cwl-*` on `.cwl-editor` must re-check contrast for their resulting body and active-toolbar pairs. Unknown token names fail closed. No Figma, network, persistence, credential, or model authority is added.

## Consequences and ownership trade-offs

Hosts gain a copyable token list and a Storybook preview. Inkspan keeps CSS as the runtime source and owns accessibility defects in its default token combinations. naruon and other CWL hosts can apply their own overrides through host-owned brand CSS and then use the same contrast helpers to validate those custom values. Complete DTCG conformance, Figma Variables, host-theme WCAG certification, and automated remediation of arbitrary host palettes remain out of scope.

## Failure and recovery

An unknown token name throws `EditorThemeTokenError` without reflecting caller input. A shipped default pair that fails an applicable repository contrast contract is repaired in Inkspan's token catalog and stylesheet together. A host override that fails contrast is recovered by changing only the named host tokens, not by editing Inkspan internals or disabling forced-colors.

## Security and privacy impact

The catalog contains only public presentation values. It does not carry document bodies, tenant identifiers, credentials, or diagnostics. Storybook is a local development preview and is not a production transport.

## Compatibility and migration

The catalog is additive. Existing CSS overrides on `.cwl-editor` continue to work. The dark default accent changes from `#4493f8` to `#58a6ff`; hosts that already override `--cwl-accent` are unaffected by that default-value change but remain responsible for validating their custom pair. A later CSS token addition or default-value change must update the catalog, directly affected documentation/tests, and this ADR together.

## Verification and acceptance evidence

Required evidence includes token-catalog tests against `src/styles.css`, deterministic contrast assertions for inventoried normal-text pairs, documentation-contract tests, Storybook inventory stories for toolbar button states and token swatches, and exact-head CI/coverage/package/security gates on the unchanged head. The accessibility regression must fail against the former `#4493f8`/`#163356` dark active pair and pass against the new `#58a6ff`/`#163356` pair. This ADR stays Proposed until protected integration.

## Rollback or supersession

Rollback removes the catalog export, Storybook inventory/config, operator/doctoring records, and this ADR together. Reverting only the compliant dark accent while retaining the active-text contrast requirement is not a valid partial rollback. Supersession requires a new ADR if CSS ceases to be runtime presentation authority or if a design-tool sync contract is accepted.
