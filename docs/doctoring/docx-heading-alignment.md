# DOCX heading alignment doctoring

Status: Implemented on protected main

## Decision trace

Inkspan Office applies its existing bounded DOCX paragraph-alignment authority to `heading` blocks. A heading may use only `left`, `center`, `right`, or `justify`. Omission preserves the heading style/default alignment. The renderer reuses the same mapping used by plain and rich paragraphs rather than introducing a heading-specific alignment vocabulary.

This is a deterministic presentation contract only. It does not grant arbitrary style, font, spacing, outline, TOC, page-layout, raw OOXML, network, model, credential, persistence, tenant, or authorization authority.

## Evidence and failure semantics

Protected implementation tests reopen generated DOCX with `python-docx`, inspect the WordprocessingML paragraph-justification semantics, exercise all four values, preserve inherited/default alignment when omitted, reject malformed values, assert deterministic bytes, and assert no partial publication after invalid input. The exact implementation head passed the repository CI, Security Scan, SAST, Office Python 3.11–3.14, 100% shipped production statement/branch coverage, and shipped-symbol docstring gates before merge.

`heading.alignment` is additive and optional. Hosts targeting an older Inkspan Office renderer must omit the field or negotiate compatibility before submission. Hosts remain responsible for source-format interpretation, authoring/layout policy, export authorization, tenant isolation, durable storage, and distribution.

## APA 7 references

Microsoft. (n.d.). *Working with paragraphs*. Microsoft Learn. Retrieved August 10, 2026, from https://learn.microsoft.com/en-us/office/open-xml/word/working-with-paragraphs

python-docx. (n.d.). *Working with text*. Retrieved August 10, 2026, from https://python-docx.readthedocs.io/en/latest/user/text.html
