"""The evaluation inputs are well formed and run_eval.py produces an honest report."""
from __future__ import annotations

import importlib.util
import json
from collections import Counter
from pathlib import Path

BACKEND = Path(__file__).parent.parent

spec = importlib.util.spec_from_file_location("run_eval", BACKEND / "scripts" / "run_eval.py")
run_eval = importlib.util.module_from_spec(spec)
spec.loader.exec_module(run_eval)

SAMPLES = run_eval.load_samples()
SKILLS = {s["id"] for s in json.loads((BACKEND / "data" / "skills.json").read_text(encoding="utf-8"))}
AREAS = {a["id"] for a in json.loads((BACKEND / "data" / "areas.json").read_text(encoding="utf-8"))}


def test_five_inputs_per_language():
    assert Counter(s["language"] for s in SAMPLES) == {"en": 5, "kn": 5, "hi": 5}
    assert len({s["id"] for s in SAMPLES}) == 15


def test_expected_labels_are_marked_and_valid():
    for s in SAMPLES:
        exp = s["expected"]
        assert exp["label_status"], s["id"]
        assert set(exp["skills_contain"]) <= SKILLS, s["id"]
        assert set(exp["top_match_requires_any"]) <= SKILLS, s["id"]
        assert exp["area_id"] in AREAS, s["id"]


def test_inputs_are_in_their_script():
    ranges = {"kn": ("ಀ", "೿"), "hi": ("ऀ", "ॿ")}
    for s in SAMPLES:
        if s["language"] in ranges:
            lo, hi = ranges[s["language"]]
            assert any(lo <= c <= hi for c in s["input"]), s["id"]


def test_report_is_labelled_honestly(tmp_path):
    rows = run_eval.evaluate(SAMPLES, repeats=1)
    assert len(rows) == 15
    log = tmp_path / "warmup.txt"
    log.write_text("Asking agent x\nOK after 11.2 s\nHTTP status: 200\nOK after 10.8 s\n", encoding="utf-8")
    report = run_eval.render(rows, 1, run_eval.read_warmup_seconds([log]))
    assert "prototype benchmark on synthetic inputs, not a field study" in report
    assert "Assumption, not measured" in report
    assert "DRAFT" in report
    assert "median 11.0 s" in report and "2 successful run(s)" in report


def test_report_without_warmup_says_not_measured():
    report = run_eval.render(run_eval.evaluate(SAMPLES[:1], repeats=1), 1, [])
    assert "Not measured in this run" in report
