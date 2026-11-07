"""Audit script: compare DB state with what seed_jobs would produce."""
import sys, os, random
sys.path.insert(0, str(__import__('pathlib').Path(__file__).parent.parent))
os.environ.setdefault("GROQ_API_KEY", "")

from db.seed_jobs import _SEED
from db.database import get_all_jobs

rng = random.Random(42)
jittered_lats = []
for s in _SEED:
    jlat = s["lat"] + rng.uniform(-0.008, 0.008)
    rng.uniform(-0.008, 0.008)  # consume lon slot
    jittered_lats.append(round(jlat, 4))

jobs = get_all_jobs()
db_lats = [round(j["lat"], 4) for j in jobs]

print(f"_SEED entries  : {len(_SEED)}")
print(f"DB rows        : {len(jobs)}")
print(f"Unique jittered lats in seed : {len(set(jittered_lats))}")
print(f"Unique lats in DB            : {len(set(db_lats))}")

# If DB has old non-jittered coordinates, the lats will cluster at area centers
area_lats = set(round(s["lat"], 4) for s in _SEED)
db_lat_set = set(db_lats)
exact_area_matches = db_lat_set & area_lats
print(f"DB lats that exactly match area centers (old non-jittered): {len(exact_area_matches)}")
print()
if len(set(db_lats)) < 40:
    print("VERDICT: DB has OLD coordinates (not jittered). Delete kelasa_mitra.db to fix.")
else:
    print("VERDICT: DB coordinates appear jittered.")
