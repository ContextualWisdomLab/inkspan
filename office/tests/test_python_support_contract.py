"""Cross-file contract for the Python versions advertised by Inkspan Office."""

from pathlib import Path
import re
import tomllib


REPOSITORY_ROOT = Path(__file__).resolve().parents[2]
SUPPORTED_PYTHON_VERSIONS = ("3.11", "3.12", "3.13", "3.14")
PYTHON_312_LXML_LINUX_SHA256 = (
    "bc783ee3147e60a25aa0445ea82b3e8aabb83b240f2b95d32cb75587ff781814"
)
PYTHON_312_PILLOW_LINUX_SHA256 = (
    "78cb2c6865a35ab8ff8b75fd122f6033b92a62c82801110e48ddd6c936a45d91"
)


def _repository_text(relative_path: str) -> str:
    """Read one repository text artifact as UTF-8."""

    return (REPOSITORY_ROOT / relative_path).read_text(encoding="utf-8")


def _workflow_job_block(workflow: str, job_name: str) -> str:
    """Return one named top-level job block from a repository workflow."""

    match = re.search(
        rf"(?ms)^  {re.escape(job_name)}:\n(?P<body>.*?)(?=^  [A-Za-z0-9_-]+:\n|\Z)",
        workflow,
    )
    assert match is not None, f"workflow job {job_name!r} is missing"
    return f"  {job_name}:\n{match.group('body')}"


def test_python_support_range_matches_classifiers_and_ci_matrix() -> None:
    """Require package metadata and the Office CI job to cover the same minors."""

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
    office_job = _workflow_job_block(workflow, "office")
    assert "runs-on: ubuntu-24.04" in office_job
    assert "runs-on: ubuntu-latest" not in office_job
    matrix_match = re.search(
        r"python-version:\s*\$\{\{\s*github\.event_name\s*==\s*'pull_request'"
        r"\s*&&\s*fromJSON\('(\[[^']+\])'\)\s*\|\|\s*"
        r"fromJSON\('(\[[^']+\])'\)\s*\}\}",
        office_job,
    )
    assert matrix_match is not None
    pull_request_versions, push_versions = (
        tuple(re.findall(r'"(3\.\d+)"', versions))
        for versions in matrix_match.groups()
    )
    assert pull_request_versions == (SUPPORTED_PYTHON_VERSIONS[-1],)
    assert push_versions == SUPPORTED_PYTHON_VERSIONS


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


def test_python_312_binary_wheels_are_covered_by_the_hash_lock() -> None:
    """Keep the exact Ubuntu CPython 3.12 binary wheel digests in the lock."""

    requirements = _repository_text("office/requirements-ci.txt")
    lxml_block = requirements[
        requirements.index("lxml==6.1.0") : requirements.index("openpyxl==3.1.5")
    ]
    pillow_block = requirements[
        requirements.index("Pillow==12.3.0") : requirements.index("pluggy==1.6.0")
    ]

    assert f"--hash=sha256:{PYTHON_312_LXML_LINUX_SHA256}" in lxml_block
    assert f"--hash=sha256:{PYTHON_312_PILLOW_LINUX_SHA256}" in pillow_block


def test_release_workflow_uses_the_same_fixed_runner_contract() -> None:
    """Bind both release jobs independently to the supported runner image."""

    release_workflow = _repository_text(".github/workflows/release.yml")
    for job_name in ("build-release-artifacts", "publish-release"):
        job = _workflow_job_block(release_workflow, job_name)
        assert "runs-on: ubuntu-24.04" in job
        assert "runs-on: ubuntu-latest" not in job
