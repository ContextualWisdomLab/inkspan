# DOCX external hyperlink relationship doctoring

Status: Active-PR evidence for Proposed ADR 0026; protected `main` remains shipped authority.

## Scope

This record grounds Inkspan Office's bounded external-hyperlink proposal in the Office Open XML packaging/WordprocessingML model and the actual `python-docx` 1.2.0 writer boundary. It does not claim that Inkspan validates destination safety, reachability, content, ownership, or authorization.

## Standards and primary-library evidence

ECMA-376 is the Ecma International Office Open XML standard family and maps to ISO/IEC 29500. The current Ecma publication identifies the family as the 5th edition; Part 1 (Fundamentals and Markup Language Reference) is 5th edition December 2016, while Part 2 (Open Packaging Conventions) is 5th edition December 2021. Together they define the markup/package relationship model that DOCX consumers and producers use.

Microsoft's Open XML SDK documentation describes the WordprocessingML `w:hyperlink` element and demonstrates that its `r:id` points to the relationship carrying the hyperlink target. The packaging API's `HyperlinkRelationship` exposes relationship ID, relationship type, external/internal state, and target URI as distinct package metadata.

`python-docx` 1.2.0 exposes hyperlink reading semantics, but its feature analysis explicitly labels adding an external hyperlink as **not yet implemented**. Inkspan therefore cannot represent the feature as a supported high-level `python-docx` writer call. The active implementation uses a narrow OOXML adapter only at the relationship/hyperlink boundary and verifies the resulting package directly.

## Product decision derived from the evidence

Inkspan Office does not need to reproduce a general-purpose Word hyperlink editor. The smallest interoperable DOCX fidelity contract is:

1. preserve one existing rich-text run and its supported emphasis;
2. create a `w:hyperlink` wrapper with an `r:id`;
3. bind that ID to one external hyperlink relationship;
4. preserve the exact accepted target;
5. keep validation and rendering network-free;
6. reject destination classes whose interpretation would require broader security/normalization authority.

The current proposal therefore permits only printable-ASCII absolute HTTP(S) targets. This is intentionally narrower than Inkspan's interactive safe-link policy. It avoids silently introducing local-file relationships, executable/data schemes, embedded credentials, protocol-relative/relative interpretation, Unicode IDN/IRI normalization, or other destination transformations into the Python Office renderer.

Visible document text remains Unicode-capable. The target restriction is a transport/package policy, not a text-language limitation. Hosts that intentionally support internationalized destinations must convert and authorize the destination before passing an ASCII URI to Inkspan Office.

## Security interpretation

An OOXML external relationship is passive package metadata until a consuming application chooses to act on it. Inkspan's renderer never dereferences a target and does not perform DNS, HTTP, redirects, credential lookup, local-file reads, or destination content inspection.

Accordingly:

- syntactic acceptance is **not** a safe-site verdict;
- the Office renderer does not replace host phishing, allowlist, tenant, legal, or content policy;
- target validation is fail-closed and structural;
- ordinary diagnostics identify only the field path and never reflect a rejected target;
- arbitrary relationship IDs/types and raw OOXML remain outside the public JSON contract.

## Verification mapping

Active PR #137 verifies:

- schema type/min/max contract for `href`;
- accepted HTTP and HTTPS examples;
- exact `w:hyperlink` placement and `r:id` relationship resolution;
- external hyperlink relationship type, exact target, and `TargetMode="External"`;
- retention of bold/italic/underline formatting inside the linked run;
- deterministic repeated rendering;
- rejection of non-string/mapping-like, empty, oversized, executable/data/mail/telephone, relative/protocol-relative, UNC/backslash, malformed authority/port, credential-bearing, whitespace/control, and non-ASCII targets without target reflection;
- Python 3.11–3.14 full Office suite, exact 100% shipped production statement/branch coverage, shipped-symbol docstrings, wheel/schema/license inspection, CI, Security Scan, SAST, and live-base/review gates before integration.

The initial RED head is retained as evidence that protected main could not express the feature. A later failed implementation head that regressed unrelated Office behavior is diagnostic evidence only; it does not transfer acceptance. Protected-main integration is required before this doctoring record may describe the hyperlink capability as shipped.

## Rollback and future expansion

Because `href` is optional, rollback requires no data migration. Producers can omit the field or target an older renderer contract. A future broader URI vocabulary requires a new/superseding ADR if it adds internal bookmarks, Unicode/IRI normalization, additional schemes, destination checking, or different relationship authority.

## References — APA 7th

Ecma International. (2021). *ECMA-376: Office Open XML file formats* (5th ed.). https://ecma-international.org/publications-and-standards/standards/ecma-376/

Microsoft. (n.d.). *Hyperlink class (DocumentFormat.OpenXml.Wordprocessing)*. Microsoft Learn. Retrieved August 10, 2026, from https://learn.microsoft.com/en-us/dotnet/api/documentformat.openxml.wordprocessing.hyperlink

Microsoft. (n.d.). *HyperlinkRelationship class (DocumentFormat.OpenXml.Packaging)*. Microsoft Learn. Retrieved August 10, 2026, from https://learn.microsoft.com/en-us/dotnet/api/documentformat.openxml.packaging.hyperlinkrelationship

python-docx. (n.d.). *Hyperlink — python-docx 1.2.0 documentation*. Retrieved August 10, 2026, from https://python-docx.readthedocs.io/en/latest/dev/analysis/features/text/hyperlink.html
