"""Seed data must stay synthetic: no real employers, and a fresh seed gives 80 jittered jobs."""
from __future__ import annotations

import re
import sys
from pathlib import Path

import pytest
from sqlalchemy import create_engine, select

BACKEND = Path(__file__).parent.parent
sys.path.insert(0, str(BACKEND))

import db.database as database  # noqa: E402
import db.seed_jobs as seed_module  # noqa: E402
from db.seed_jobs import _SEED, seed_jobs  # noqa: E402

# Brands and institutions the seed used to name, plus other likely reuses.
REAL_NAMES = [
    "Amazon", "Asian Paints", "BabyChakra", "BBMP", "BESCOM", "BigBasket", "Blinkit", "Blue Dart",
    "Bosch", "Brigade", "Chancery Pavilion", "Concentrix", "Daikin", "Delhivery", "DMart", "DTDC",
    "Dunzo", "Enrich", "Flipkart", "G4S", "Gokaldas", "Gold's Gym", "HCL", "Hometown", "IHM",
    "Infosys", "ISRO", "ISS", "ITC", "ITI", "Jaquar", "L&T", "Le Meridien", "Lemon Tree", "Lenskart",
    "MakeMyTrip", "Minda", "MTR", "Naturals", "Nightingales", "NIFT", "NIIT", "NSDC", "Oberoi", "Ola",
    "PMKVY", "Prestige", "Puravankara", "Rapido", "Raymond", "Reliance", "Safexpress", "Sheraton",
    "Shoppers Stop", "SIS", "Skill India", "Sobha", "Star Bazaar", "Sumadhura", "Swiggy", "Taj", "TCS",
    "Tops Security", "TVS", "Uber", "Urban Company", "Vivanta", "Washmart", "Windsor", "Wipro", "Zepto",
    "Zomato",
]


def _matching_real_names(employer: str) -> list[str]:
    return [
        name for name in REAL_NAMES
        if re.search(rf"(?<![a-z0-9]){re.escape(name.lower())}(?![a-z0-9])", employer.lower())
    ]


def test_checker_catches_a_real_name():
    """Guards the guard: the check below must be able to fail."""
    assert _matching_real_names("Swiggy") == ["Swiggy"]
    assert _matching_real_names("ITC Windsor Hotel") == ["ITC", "Windsor"]
    assert _matching_real_names("Kaval Security Services") == []


def test_no_seed_employer_matches_a_real_name():
    offenders = {e["employer"]: _matching_real_names(e["employer"]) for e in _SEED
                 if _matching_real_names(e["employer"])}
    assert offenders == {}


def test_seed_has_exactly_80_jobs():
    assert len(_SEED) == 80


@pytest.fixture
def temp_engine(tmp_path, monkeypatch):
    """Point seeding at a throwaway database; never touch db/kelasa_mitra.db."""
    engine = create_engine(f"sqlite:///{tmp_path / 'test.db'}")
    monkeypatch.setattr(seed_module, "ENGINE", engine)
    monkeypatch.setattr(database, "ENGINE", engine)
    yield engine
    engine.dispose()


def _rows(engine):
    with engine.connect() as conn:
        return conn.execute(select(database.jobs_table)).mappings().all()


def test_fresh_seed_gives_80_rows_with_jittered_coordinates(temp_engine):
    assert seed_jobs() == 80
    rows = _rows(temp_engine)
    assert len(rows) == 80
    assert len({r["lat"] for r in rows}) >= 70
    assert all(r["is_synthetic"] for r in rows)


def test_reseed_is_skipped_when_populated(temp_engine):
    seed_jobs()
    assert seed_jobs() == 0


def test_jitter_is_stable_across_seeds_in_one_process(tmp_path, monkeypatch):
    coords = []
    for name in ("a.db", "b.db"):
        engine = create_engine(f"sqlite:///{tmp_path / name}")
        monkeypatch.setattr(seed_module, "ENGINE", engine)
        monkeypatch.setattr(database, "ENGINE", engine)
        seed_jobs()
        coords.append(sorted((r["lat"], r["lon"]) for r in _rows(engine)))
        engine.dispose()
    assert coords[0] == coords[1]
