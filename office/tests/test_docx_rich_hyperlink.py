"""Contract tests for bounded external hyperlinks in DOCX rich paragraphs."""

from __future__ import annotations

from io import BytesIO
from xml.etree import ElementTree
from zipfile import ZipFile

from inkspan_office import load_schema, render_office_document

_WORD_NS = "http://schemas.openxmlformats.org/wordprocessingml/2006/main"
_REL_NS = "http://schemas.openxmlformats.org/package/2006/relationships"
_DOC_REL_NS = "http://schemas.openxmlformats.org/officeDocument/2006/relationships"
_HYPERLINK_REL = (
    "http://schemas.openxmlformats.org/officeDocument/2006/relationships/hyperlink"
)


def _rich_link_payload(href: str) -> dict[str, object]:
    """Build one minimal DOCX request containing a linked rich-text run."""

    return {
        "format": "docx",
        "blocks": [
            {
                "type": "rich_paragraph",
                "runs": [
                    {
                        "text": "Inkspan documentation",
                        "bold": True,
                        "href": href,
                    }
                ],
            }
        ],
    }


def test_docx_rich_run_schema_exposes_bounded_hyperlink_target() -> None:
    """The public schema must expose one bounded string target for rich runs."""

    schema = load_schema()
    href_schema = schema["$defs"]["richTextRun"]["properties"]["href"]

    assert href_schema["type"] == "string"
    assert href_schema["minLength"] == 1
    assert href_schema["maxLength"] == 4096


def test_docx_rich_run_renders_external_hyperlink_relationship() -> None:
    """One accepted HTTPS run must bind visible text to its exact relationship target."""

    href = "https://example.com/inkspan"
    rendered = render_office_document(_rich_link_payload(href))

    with ZipFile(BytesIO(rendered.data)) as package:
        document_root = ElementTree.fromstring(package.read("word/document.xml"))
        relationships_root = ElementTree.fromstring(
            package.read("word/_rels/document.xml.rels")
        )

    hyperlink = document_root.find(f".//{{{_WORD_NS}}}hyperlink")
    assert hyperlink is not None
    relationship_id = hyperlink.attrib[f"{{{_DOC_REL_NS}}}id"]
    assert "".join(hyperlink.itertext()) == "Inkspan documentation"

    relationship = next(
        relation
        for relation in relationships_root.findall(f"{{{_REL_NS}}}Relationship")
        if relation.attrib.get("Id") == relationship_id
    )
    assert relationship.attrib["Type"] == _HYPERLINK_REL
    assert relationship.attrib["Target"] == href
    assert relationship.attrib["TargetMode"] == "External"
