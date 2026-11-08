#!/usr/bin/env python3
"""
Generate docs/TEMPLATES_TO_REVIEW.md from the code, so nothing is retyped by hand.

Run after changing any en/kn/hi text (tests/test_data_and_docs.py fails until you do):
    python backend/scripts/gen_templates_review.py
"""
import json
import re
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent.parent
sys.path.insert(0, str(ROOT / "backend"))

from tools.follow_up import _FOLLOW_UP  # noqa: E402
from tools.job_ranker import _REASON_TEMPLATES, _SKILL_LABELS  # noqa: E402
from tools.skill_gap import _GAP_TEMPLATES, _GAP_NO_UPLIFT_TEMPLATES  # noqa: E402

skills = json.loads((ROOT / "backend/data/skills.json").read_text(encoding="utf-8"))
ts = (ROOT / "frontend/src/lib/i18n.ts").read_text(encoding="utf-8")


def ts_block(name, next_marker):
    start = ts.index(f"  {name}: {{")
    end = ts.index(next_marker, start)
    return dict(re.findall(r"^\s+(\w+): '(.*)',$", ts[start:end], flags=re.M))


ui = {"kn": ts_block("kn", "  hi: {"), "hi": ts_block("hi", "export function t")}
en_start = ts.index("const en = {")
ui_en = dict(re.findall(r"^\s+(\w+): '(.*)',$", ts[en_start:ts.index("export type StringKey")], flags=re.M))
assert set(ui["kn"]) == set(ui_en) == set(ui["hi"]), "i18n keys differ"


def cell(s):
    return s.replace("|", "\\|")


L = [
    "# Kannada and Hindi text to review",
    "",
    "**Status: not reviewed.** A native speaker has not checked any of this text. It was written by",
    "AI tools, and Claude Code reworded the skill-gap templates to avoid errors such as \"कामें\".",
    "Do not describe these as verified until a review is recorded here.",
    "",
    "Reviewer: mark each row OK or write the correction. Keep `{placeholders}` unchanged.",
    "Placeholders: `{skills}` and `{skill}` are skill names, `{dist}` and `{km}` are distances,",
    "`{n}` is a count, `{pay}` is a rupee amount.",
    "",
    "Reviewed by: TODO  |  Date: TODO",
    "",
    "## 1. Job match reasons (`backend/tools/job_ranker.py`)",
    "",
    "| Key | English | Kannada | Hindi | Review |",
    "|---|---|---|---|---|",
]
for key in _REASON_TEMPLATES["en"]:
    L.append(f"| {key} | {cell(_REASON_TEMPLATES['en'][key])} | {cell(_REASON_TEMPLATES['kn'][key])} | {cell(_REASON_TEMPLATES['hi'][key])} | |")

L += ["", "## 2. Skill-gap explanations (`backend/tools/skill_gap.py`)", "",
      "| Key | English | Kannada | Hindi | Review |", "|---|---|---|---|---|"]
for name, tpl in (("with pay uplift", _GAP_TEMPLATES), ("without pay uplift", _GAP_NO_UPLIFT_TEMPLATES)):
    L.append(f"| {name} | {cell(tpl['en'])} | {cell(tpl['kn'])} | {cell(tpl['hi'])} | |")

L += ["", "## 3. Follow-up questions (`backend/tools/follow_up.py`)", "",
      "| Key | English | Kannada | Hindi | Review |", "|---|---|---|---|---|"]
for key, tpl in _FOLLOW_UP.items():
    L.append(f"| {key} | {cell(tpl['en'])} | {cell(tpl['kn'])} | {cell(tpl['hi'])} | |")

L += ["", "## 4. Screen text (`frontend/src/lib/i18n.ts`)", "",
      "| Key | English | Kannada | Hindi | Review |", "|---|---|---|---|---|"]
for key, en in ui_en.items():
    L.append(f"| {key} | {cell(en)} | {cell(ui['kn'][key])} | {cell(ui['hi'][key])} | |")

L += ["", "## 5. Skill names in match reasons (`backend/tools/job_ranker.py`)", "",
      "| Skill | English | Kannada | Hindi | Review |", "|---|---|---|---|---|"]
for key, tpl in _SKILL_LABELS.items():
    L.append(f"| {key} | {cell(tpl['en'])} | {cell(tpl['kn'])} | {cell(tpl['hi'])} | |")

L += ["", "## 6. Skill names in skill-gap text (`backend/data/skills.json`)", "",
      "| Skill | English | Kannada | Hindi | Review |", "|---|---|---|---|---|"]
for s in skills:
    L.append(f"| {s['id']} | {cell(s['label_en'])} | {cell(s['label_kn'])} | {cell(s['label_hi'])} | |")

(ROOT / "docs").mkdir(exist_ok=True)
(ROOT / "docs" / "TEMPLATES_TO_REVIEW.md").write_text("\n".join(L) + "\n", encoding="utf-8")
print("rows:", sum(1 for x in L if x.startswith("| ") and not x.startswith("| Key") and not x.startswith("| Skill |")))
