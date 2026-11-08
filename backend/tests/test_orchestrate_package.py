"""
The watsonx Orchestrate tool package must hold exact copies of the backend logic and give
the same results as the backend endpoints, for the 13 samples and all seed jobs.
"""
from __future__ import annotations

import importlib.util
import json
import os
import subprocess
import sys
from pathlib import Path

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine, select

BACKEND = Path(__file__).parent.parent
ROOT = BACKEND.parent
ORCHESTRATE = ROOT / "orchestrate"
sys.path.insert(0, str(BACKEND))

os.environ["GROQ_API_KEY"] = ""

import db.database as database  # noqa: E402
import db.seed_jobs as seed_module  # noqa: E402
from db.seed_jobs import build_seed_rows, seed_jobs  # noqa: E402
from tools.profile_extractor import extract_profile  # noqa: E402

SAMPLES = json.loads((BACKEND / "tests" / "samples.json").read_text(encoding="utf-8"))


def _load_builder():
    spec = importlib.util.spec_from_file_location("build_kelasa_tools", ORCHESTRATE / "build_kelasa_tools.py")
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    return module


BUILDER = _load_builder()


@pytest.fixture(scope="module")
def package(tmp_path_factory) -> Path:
    out = tmp_path_factory.mktemp("pkg") / "kelasa_tools"
    BUILDER.build(out)
    return out


# ── The package is assembled, not hand-written ───────────────────────────────

@pytest.mark.parametrize("rel", BUILDER.BACKEND_FILES)
def test_backend_files_are_copied_byte_for_byte(package, rel):
    assert (package / rel).read_bytes() == (BACKEND / rel).read_bytes()


def test_package_ships_requirements_with_exact_pins(package):
    lines = (package / "requirements.txt").read_text(encoding="utf-8").split()
    assert lines == ["ibm-watsonx-orchestrate==2.19.1", "pydantic==2.14.3"]


def test_built_package_in_repo_is_up_to_date(package):
    """orchestrate/kelasa_tools/ must be rebuilt after any backend change."""
    built = ORCHESTRATE / "kelasa_tools"
    if not built.exists():
        pytest.skip("orchestrate/kelasa_tools/ has not been built")
    expected = sorted(p.relative_to(package).as_posix() for p in package.rglob("*") if p.is_file())
    actual = sorted(p.relative_to(built).as_posix() for p in built.rglob("*")
                    if p.is_file() and "__pycache__" not in p.parts)
    assert actual == expected
    for rel in expected:
        assert (built / rel).read_bytes() == (package / rel).read_bytes(), rel


# ── The snapshot is exactly the seed ─────────────────────────────────────────

def test_seed_ids_are_deterministic():
    ids = [row["id"] for row in build_seed_rows()]
    assert ids == [f"job-{i:03d}" for i in range(1, len(ids) + 1)] and len(ids) == 94
    assert build_seed_rows() == build_seed_rows()


def test_snapshot_equals_seed_rows():
    snapshot = json.loads((BACKEND / "data" / "jobs_snapshot.json").read_text(encoding="utf-8"))
    assert snapshot == build_seed_rows()


@pytest.fixture(scope="module")
def seeded_rows(tmp_path_factory):
    """Seed a throwaway SQLite file and read it back through get_all_jobs()."""
    engine = create_engine(f"sqlite:///{tmp_path_factory.mktemp('db') / 'jobs.db'}")
    old = (seed_module.ENGINE, database.ENGINE)
    seed_module.ENGINE = database.ENGINE = engine
    try:
        seed_jobs()
        rows = database.get_all_jobs()
    finally:
        seed_module.ENGINE, database.ENGINE = old
        engine.dispose()
    return rows


def test_sqlite_rows_equal_snapshot(seeded_rows):
    by_id = {row["id"]: row for row in seeded_rows}
    assert {row["id"]: row for row in build_seed_rows()} == by_id


# ── Same results as the backend ──────────────────────────────────────────────

RUNNER = r"""
import json, sys
sys.stdin.reconfigure(encoding="utf-8")   # -I ignores PYTHONIOENCODING
sys.stdout.reconfigure(encoding="utf-8")
sys.path.insert(0, sys.argv[1])
import kelasa_core
cases = json.loads(sys.stdin.read())
out = []
for text, lang in cases:
    out.append({
        "extract": kelasa_core.extract_profile_result(text, lang),
        "matches": kelasa_core.find_matches_result(text, lang),
        "gaps": kelasa_core.skill_gap_result(text, lang),
    })
heavy = sorted(m for m in ("fastapi", "langdetect", "sqlalchemy", "groq", "dotenv") if m in sys.modules)
print(json.dumps({"results": out, "heavy_modules": heavy}, ensure_ascii=False))
"""

EXTRA_CASES = [
    ["I am a cook", "en"],                       # no area -> follow-up
    ["I live in Whitefield", "kn"],             # no skills -> follow-up
    ["ನಾನು ವಿಜಯನಗರದಲ್ಲಿ ಡ್ರೈವರ್ ಆಗಿದ್ದೆ", "kn"],
]


@pytest.fixture(scope="module")
def cases():
    return [[s["input"], s["ui_language"]] for s in SAMPLES] + EXTRA_CASES


@pytest.fixture(scope="module")
def package_output(package, cases):
    """Run the package in a separate, isolated interpreter that cannot see backend/."""
    result = subprocess.run(
        [sys.executable, "-I", "-c", RUNNER, str(package)],
        input=json.dumps(cases, ensure_ascii=False), capture_output=True, text=True,
        encoding="utf-8", check=True, env={**os.environ, "PYTHONIOENCODING": "utf-8"},
    )
    return json.loads(result.stdout)


@pytest.fixture(scope="module")
def client(seeded_rows):
    import routers.matches as matches_router
    import routers.skill_gap as skill_gap_router
    from main import app
    old = (matches_router.get_all_jobs, skill_gap_router.get_all_jobs)
    matches_router.get_all_jobs = skill_gap_router.get_all_jobs = lambda: seeded_rows
    yield TestClient(app)
    matches_router.get_all_jobs, skill_gap_router.get_all_jobs = old


def test_package_imports_nothing_heavy(package_output):
    assert package_output["heavy_modules"] == []


def test_all_samples_covered(cases):
    assert len(cases) == len(SAMPLES) + len(EXTRA_CASES) == 16


def test_profiles_match_backend(package_output, cases):
    for (text, lang), result in zip(cases, package_output["results"]):
        assert result["extract"]["profile"] == extract_profile(text, ui_language=lang).model_dump(), text


def test_follow_ups_match_backend(package_output, cases, client):
    for (text, lang), result in zip(cases, package_output["results"]):
        profile = extract_profile(text, ui_language=lang).model_dump()
        backend = client.post("/api/matches", json={"profile": profile}).json()
        assert result["extract"]["follow_up_question"] == backend["follow_up_question"], text
        assert result["matches"]["follow_up_question"] == backend["follow_up_question"], text


def test_matches_match_backend(package_output, cases, client):
    compared = 0
    for (text, lang), result in zip(cases, package_output["results"]):
        profile = extract_profile(text, ui_language=lang).model_dump()
        backend = client.post("/api/matches", json={"profile": profile}).json()
        assert result["matches"]["matches"] == backend["matches"], text
        compared += bool(backend["matches"])
    assert compared >= 13


def test_skill_gaps_match_backend(package_output, cases, client):
    for (text, lang), result in zip(cases, package_output["results"]):
        profile = extract_profile(text, ui_language=lang).model_dump()
        if result["gaps"]["follow_up_question"]:
            continue
        backend = client.post("/api/skill-gap", json={"profile": profile}).json()
        assert result["gaps"]["gaps"] == backend["gaps"], text


def test_reply_lines_come_from_tool_results(package_output):
    for result in package_output["results"]:
        matches, gaps = result["matches"], result["gaps"]
        if matches["follow_up_question"]:
            assert matches["reply_lines"] == [matches["follow_up_question"]]
            continue
        for line, match in zip(matches["reply_lines"], matches["matches"]):
            assert match["reason"] in line and match["job"]["title"] in line
        assert gaps["reply_lines"] == [g["explanation"] for g in gaps["gaps"]]


# ── Optional: the real decorators, with the orchestrate venv ─────────────────

VENV_PY = ORCHESTRATE / ".venv" / "Scripts" / "python.exe"


@pytest.mark.skipif(not VENV_PY.exists(), reason="orchestrate/.venv not present")
def test_tool_decorators_import_from_package_root(package):
    script = (
        "import json, kelasa_mitra_tools as k;"
        "print(json.dumps({t.__tool_spec__.name: sorted(t.__tool_spec__.input_schema.properties)"
        " for t in (k.extract_profile, k.find_matches, k.skill_gap)}))"
    )
    result = subprocess.run([str(VENV_PY), "-c", script], cwd=package, capture_output=True,
                            text=True, encoding="utf-8", check=True,
                            env={**os.environ, "PYTHONDONTWRITEBYTECODE": "1"})
    assert json.loads(result.stdout) == {
        name: ["ui_language", "worker_text"] for name in ("extract_profile", "find_matches", "skill_gap")
    }


ADK_LOADER = r"""
import sys
from ibm_watsonx_orchestrate.agent_builder.tools.utils import extract_python_tools
root, entry = sys.argv[1], sys.argv[2]
tools = extract_python_tools(file=entry, requirements_file=root + "/requirements.txt", package_root=root)
for t in tools:
    print(t.__tool_spec__.name, t.__tool_spec__.binding.python.function)
"""


@pytest.mark.skipif(not VENV_PY.exists(), reason="orchestrate/.venv not present")
def test_adk_loader_accepts_the_package_like_the_cli(package):
    """Runs the same loader `orchestrate tools import -k python -p ... -f ...` uses, from the
    package's parent folder, with relative paths. A kelasa_tools.py entry file used to fail here."""
    entry = BUILDER.SOURCE_FILES[1]
    assert entry != f"{package.name}.py", "entry file must not share the package folder's name"
    result = subprocess.run(
        [str(VENV_PY), "-c", ADK_LOADER, package.name, f"{package.name}/{entry}"],
        cwd=package.parent, capture_output=True, text=True, encoding="utf-8",
        env={**os.environ, "PYTHONDONTWRITEBYTECODE": "1", "PYTHONIOENCODING": "utf-8"},
    )
    assert result.returncode == 0, result.stdout + result.stderr
    module = entry.removesuffix(".py")
    names = ("extract_profile ", "find_matches ", "skill_gap ")
    tool_lines = [line for line in result.stdout.splitlines() if line.startswith(names)]  # skip ADK INFO logs
    assert sorted(tool_lines) == [
        f"{name} {module}:{name}" for name in ("extract_profile", "find_matches", "skill_gap")
    ]
