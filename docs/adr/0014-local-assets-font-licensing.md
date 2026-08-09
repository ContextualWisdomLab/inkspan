# ADR 0014: Local assets and font-licensing boundary

Status: Proposed

## Context

Inkspan is intended to remain usable in offline and air-gapped environments while rendering Korean, English, Japanese, Simplified Chinese, Traditional Chinese, Vietnamese, and other supported text predictably. Fetching web fonts at runtime would introduce availability, privacy, CSP/egress, and supply-chain dependencies. Bundling fonts also creates a redistribution/licensing obligation that must remain visible to package consumers and acquisition reviewers.

The current package bundles Noto Sans-family WOFF2 subsets generated from the Google Fonts distribution. `src/fonts/OFL.txt` carries the SIL Open Font License 1.1 text and `src/fonts/NOTICE` records the bundled families, attribution, source, subset process, and license boundary.

## Alternatives considered

- Fetch fonts from Google Fonts or another CDN at runtime. Rejected because offline/air-gapped operation would fail and document rendering would gain external network, privacy, CSP, and provider-availability dependencies.
- Depend only on host/system fonts. Rejected as the default product contract because cross-platform glyph coverage, CJK/Vietnamese rendering, layout evidence, and acquisition reproducibility become host-specific.
- Bundle permissively redistributable local subsets with complete license/notice material and explicit package exports. Selected because rendering remains offline-capable while third-party asset obligations are reviewable.

## Decision

Inkspan bundles the supported Noto Sans-family font subsets as local package assets and exposes local CSS/font package paths. Runtime authoring/rendering must not require a remote font fetch. Bundled font software remains under SIL OFL-1.1; Inkspan application source remains under its own repository license. The OFL license text and attribution/NOTICE must ship with the redistributed font assets.

The product does not rename, imply ownership of, or silently relicense the Noto font software. Any future modified font must respect Reserved Font Name and other OFL conditions before distribution.

## Consequences

Offline and closed-network consumers get stable multilingual font availability and do not leak document access through third-party font requests. Package size is larger, and font inventory/licensing becomes part of release verification. Host applications may still choose their own typography, but the documented Inkspan offline asset path remains available without network authority.

## Failure and recovery

If a required bundled asset, license text, attribution record, CSS mapping, or package export is missing or inconsistent, package/release verification fails rather than silently falling back to a remote URL. If a font license or provenance cannot be established, remove the affected asset from the release until a reviewed replacement or corrected provenance record exists. Runtime must not auto-download a substitute.

## Security and privacy impact

Local fonts eliminate runtime font-CDN requests that could disclose client IP, application access timing, origin/referrer information, or violate CSP/egress policy. Shipping only reviewed assets reduces remote supply-chain substitution risk. Font files remain untrusted binary assets for downstream browser/font parsers, so package provenance and bounded asset inventory matter even though Inkspan does not execute them as code.

## Compatibility and migration

Package paths such as the local font CSS/assets are consumer-facing compatibility surfaces. Removing a bundled family, changing unicode-range coverage, renaming a family, changing weights, or replacing licenses requires release notes and rendering/packaging compatibility evidence. Hosts can migrate to their own fonts without changing canonical document semantics because font choice is presentation, not document authority. Rollback restores the last verified local asset inventory and its matching license/NOTICE files.

## Verification

Package verification must confirm the expected font files, CSS exports, `src/fonts/OFL.txt`, and `src/fonts/NOTICE` are included as intended. Tests or release evidence should verify no canonical Inkspan stylesheet requires a remote font URL, multilingual fixtures render with the declared local families/weights, and asset/license inventory matches package metadata and documentation. Supply-chain review checks the recorded upstream provenance before changing bundled font bytes.

## Rollback or supersession

Rollback restores the previous verified font/CSS inventory together with its exact license and NOTICE material. Supersession requires an explicit asset/provenance/license decision with offline/degraded-mode behavior, package-size and rendering compatibility analysis, supply-chain review, migration guidance, and a no-network rollback path.
