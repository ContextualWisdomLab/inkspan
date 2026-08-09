"""Cross-file contract for the Python versions advertised by Inkspan Office."""

from pathlib import Path
import re
import tomllib


REPOSITORY_ROOT = Path(__file__).resolve().parents[2]
SUPPORTED_PYTHON_VERSIONS = ("3.11", "3.12", "3.13", "3.14")


def _repository_text(relative_path: str) -> str:
    """Read one repository text artifact as UTF-8."""

    return (REPOSITORY_ROOT / relative_path).read_text(encoding="utf-8")


def test_python_support_range_matches_classifiers_and_ci_matrix() -> None:
    """Require package metadata and CI to cover the same bounded minor releases."""

    pyproject = tomllib.loads(_repository_text("office/pyproject.toml"))
    project = pyproject["project"]
    assert project["requires-python"] == ">=3.11,<3.15"

    classified_versions = tuple(
        classifier.rsplit(" :: ", maxsplit=1)[-1]
        for classifier in project["classifiers"]
        if classifier.startswith("Programming Language :: Python :: 3.")
    )
    assert classified_versions == SUPPORTED_PYTHON_VERSIONS

    workflow = _repository_text(".github/workflows/ci.yml")
    matrix_match = re.search(r'python-version:\s*\[([^\]]+)\]', workflow)
    assert matrix_match is not None
    matrix_versions = tuple(re.findall(r'"(3\.\d+)"', matrix_match.group(1)))
    assert matrix_versions == SUPPORTED_PYTHON_VERSIONS


def test_python_support_documentation_matches_the_fixed_ci_environment() -> None:
    """Keep buyer-facing and lockfile guidance aligned with the tested runtime set."""

    requirements = _repository_text("office/requirements-ci.txt")
    office_readme = _repository_text("office/README.md")
    root_readme = _repository_text("README.md")

    assert "ubuntu-24.04" in requirements
    assert "ubuntu-latest" not in requirements
    for version in SUPPORTED_PYTHON_VERSIONS:
        assert f"Python {version}" in office_readme
        assert f"Python {version}" in root_readme


def test_release_workflow_uses_the_same_fixed_runner_contract() -> None:
    """Prevent release verification from drifting onto a different runner image."""

    release_workflow = _repository_text(".github/workflows/release.yml")
    assert "runs-on: ubuntu-latest" not in release_workflow
    assert release_workflow.count("runs-on: ubuntu-24.04") == 2
