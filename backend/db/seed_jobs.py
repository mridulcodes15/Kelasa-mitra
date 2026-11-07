"""
Seed 80 synthetic Bengaluru jobs into the database.
Run directly:  python -m db.seed_jobs
Or called from main.py at startup.

Coordinate jitter: each job lat/lon is randomised ±0.008° (~0-1.5 km) from
the area centre so distances shown to workers are realistic rather than all
being identical.  The seed is deterministic (seeded by job index) so the DB
is stable across re-seeds.
"""
from __future__ import annotations

import json
import math
import random
import uuid
from datetime import datetime, timezone

from sqlalchemy import insert

from db.database import ENGINE, init_db, jobs_table

# ~1.5 km at Bengaluru's latitude expressed in degrees
_JITTER_DEG = 0.008
_RNG = random.Random(42)  # deterministic seed


def _jitter(lat: float, lon: float) -> tuple[float, float]:
    """Randomly offset lat/lon by up to ±_JITTER_DEG (~1.5 km)."""
    dlat = (_RNG.random() * 2 - 1) * _JITTER_DEG
    dlon = (_RNG.random() * 2 - 1) * _JITTER_DEG
    return round(lat + dlat, 6), round(lon + dlon, 6)

# fmt: off
_SEED: list[dict] = [
    # ── HOSPITALITY ──────────────────────────────────────────────────────────
    {"title": "Hotel Room Attendant", "employer": "Chancery Pavilion", "area": "Residency Road", "lat": 12.9733, "lon": 77.6018, "pay_min": 12000, "pay_max": 16000, "skills": ["hotel_helper", "housekeeping"], "languages": ["kannada", "english"], "type": "job"},
    {"title": "Restaurant Helper", "employer": "MTR Foods Outlet", "area": "Majestic", "lat": 12.9773, "lon": 77.5713, "pay_min": 10000, "pay_max": 13000, "skills": ["hotel_helper", "cook"], "languages": ["kannada"], "type": "job"},
    {"title": "Kitchen Assistant", "employer": "The Oberoi Hotel", "area": "MG Road", "lat": 12.9756, "lon": 77.6099, "pay_min": 14000, "pay_max": 18000, "skills": ["cook", "food_handler"], "languages": ["english", "kannada"], "type": "job"},
    {"title": "Canteen Worker", "employer": "Infosys Campus Canteen", "area": "Electronic City", "lat": 12.8452, "lon": 77.6602, "pay_min": 11000, "pay_max": 14000, "skills": ["cook", "food_handler"], "languages": ["kannada", "hindi"], "type": "job"},
    {"title": "Catering Assistant", "employer": "Taj Vivanta", "area": "MG Road", "lat": 12.9756, "lon": 77.6099, "pay_min": 13000, "pay_max": 17000, "skills": ["cook", "event_helper", "food_handler"], "languages": ["english"], "type": "job"},
    {"title": "Banquet Staff", "employer": "Le Meridien", "area": "Residency Road", "lat": 12.9733, "lon": 77.6018, "pay_min": 12000, "pay_max": 15000, "skills": ["event_helper", "hotel_helper"], "languages": ["english", "kannada"], "type": "job"},
    {"title": "Hotel Housekeeper", "employer": "Lemon Tree Hotel", "area": "Whitefield", "lat": 12.9698, "lon": 77.7499, "pay_min": 11000, "pay_max": 14500, "skills": ["housekeeping", "hotel_helper"], "languages": ["kannada"], "type": "job"},
    {"title": "Pool Attendant", "employer": "Sheraton Grand", "area": "Brigade Road", "lat": 12.9716, "lon": 77.6099, "pay_min": 12000, "pay_max": 15000, "skills": ["swimming_pool", "housekeeping"], "languages": ["english"], "type": "job"},
    # ── DELIVERY / TRANSPORT ─────────────────────────────────────────────────
    {"title": "Delivery Executive", "employer": "Swiggy", "area": "Koramangala", "lat": 12.9352, "lon": 77.6245, "pay_min": 16000, "pay_max": 22000, "skills": ["delivery", "two_wheeler"], "languages": ["kannada", "hindi"], "type": "job"},
    {"title": "Delivery Executive", "employer": "Zomato", "area": "Indiranagar", "lat": 12.9784, "lon": 77.6408, "pay_min": 15000, "pay_max": 21000, "skills": ["delivery", "two_wheeler"], "languages": ["kannada"], "type": "job"},
    {"title": "Last Mile Delivery Agent", "employer": "Amazon Flex", "area": "Whitefield", "lat": 12.9698, "lon": 77.7499, "pay_min": 17000, "pay_max": 23000, "skills": ["delivery", "two_wheeler", "driving_licence"], "languages": ["english", "kannada"], "type": "job"},
    {"title": "Courier Delivery Boy", "employer": "Delhivery", "area": "Marathahalli", "lat": 12.9591, "lon": 77.6971, "pay_min": 14000, "pay_max": 18000, "skills": ["delivery", "two_wheeler"], "languages": ["kannada", "hindi"], "type": "job"},
    {"title": "Personal Driver", "employer": "MakeMyTrip Executive Transport", "area": "MG Road", "lat": 12.9756, "lon": 77.6099, "pay_min": 18000, "pay_max": 25000, "skills": ["driver_car", "driving_licence"], "languages": ["english", "kannada"], "type": "job"},
    {"title": "Cab Driver", "employer": "Ola Fleet", "area": "Yeshwanthpur", "lat": 13.0210, "lon": 77.5371, "pay_min": 20000, "pay_max": 30000, "skills": ["driver_car", "driving_licence", "basic_english"], "languages": ["kannada", "hindi"], "type": "job"},
    {"title": "App-Based Driver", "employer": "Rapido", "area": "Majestic", "lat": 12.9773, "lon": 77.5713, "pay_min": 14000, "pay_max": 20000, "skills": ["two_wheeler", "driving_licence"], "languages": ["kannada"], "type": "job"},
    {"title": "Logistics Executive", "employer": "Flipkart Logistics", "area": "Electronic City", "lat": 12.8452, "lon": 77.6602, "pay_min": 16000, "pay_max": 20000, "skills": ["delivery", "warehouse", "two_wheeler"], "languages": ["kannada", "hindi"], "type": "job"},
    {"title": "Auto Driver", "employer": "Self-Employed (Namma Auto)", "area": "Jayanagar", "lat": 12.9250, "lon": 77.5938, "pay_min": 15000, "pay_max": 22000, "skills": ["auto_driver", "driving_licence"], "languages": ["kannada"], "type": "job"},
    # ── SECURITY ─────────────────────────────────────────────────────────────
    {"title": "Security Guard", "employer": "G4S Security Solutions", "area": "Whitefield", "lat": 12.9698, "lon": 77.7499, "pay_min": 13000, "pay_max": 16000, "skills": ["security_guard"], "languages": ["kannada"], "type": "job"},
    {"title": "Security Guard", "employer": "Tops Security", "area": "Electronic City", "lat": 12.8452, "lon": 77.6602, "pay_min": 12500, "pay_max": 15500, "skills": ["security_guard"], "languages": ["kannada", "hindi"], "type": "job"},
    {"title": "Night Watchman", "employer": "Brigade Residences", "area": "Koramangala", "lat": 12.9352, "lon": 77.6245, "pay_min": 12000, "pay_max": 14500, "skills": ["watchman", "security_guard"], "languages": ["kannada"], "type": "job"},
    {"title": "Gatekeeper", "employer": "Sobha Dream Acres", "area": "Marathahalli", "lat": 12.9591, "lon": 77.6971, "pay_min": 13000, "pay_max": 16000, "skills": ["watchman"], "languages": ["kannada"], "type": "job"},
    {"title": "Security Supervisor", "employer": "SIS Group", "area": "HSR Layout", "lat": 12.9116, "lon": 77.6474, "pay_min": 17000, "pay_max": 21000, "skills": ["security_guard", "basic_english"], "languages": ["kannada", "english"], "type": "job"},
    # ── DOMESTIC / CLEANING ───────────────────────────────────────────────────
    {"title": "Housekeeping Staff", "employer": "Clean & Clear Facility Mgmt", "area": "Indiranagar", "lat": 12.9784, "lon": 77.6408, "pay_min": 10000, "pay_max": 13000, "skills": ["housekeeping"], "languages": ["kannada"], "type": "job"},
    {"title": "Office Cleaning Staff", "employer": "ISS Facility Services", "area": "Koramangala", "lat": 12.9352, "lon": 77.6245, "pay_min": 10000, "pay_max": 13500, "skills": ["housekeeping", "sanitation"], "languages": ["kannada"], "type": "job"},
    {"title": "Domestic Help", "employer": "Urban Company", "area": "BTM Layout", "lat": 12.9165, "lon": 77.6101, "pay_min": 12000, "pay_max": 16000, "skills": ["housekeeping", "cook"], "languages": ["kannada", "hindi"], "type": "job"},
    {"title": "Nanny / Babysitter", "employer": "BabyChakra Home Services", "area": "Jayanagar", "lat": 12.9250, "lon": 77.5938, "pay_min": 10000, "pay_max": 14000, "skills": ["babysitter"], "languages": ["kannada"], "type": "job"},
    {"title": "Elder Care Attendant", "employer": "Nightingales Home Health", "area": "JP Nagar", "lat": 12.9063, "lon": 77.5857, "pay_min": 12000, "pay_max": 16000, "skills": ["elder_care"], "languages": ["kannada", "hindi"], "type": "job"},
    {"title": "Laundry Worker", "employer": "Washmart Laundry Services", "area": "Rajajinagar", "lat": 12.9936, "lon": 77.5527, "pay_min": 9000, "pay_max": 12000, "skills": ["laundry"], "languages": ["kannada"], "type": "job"},
    {"title": "Gardener", "employer": "Brigade Oasis Apartments", "area": "Banashankari", "lat": 12.9254, "lon": 77.5468, "pay_min": 9000, "pay_max": 12000, "skills": ["gardener"], "languages": ["kannada"], "type": "job"},
    # ── CONSTRUCTION / TECHNICAL ─────────────────────────────────────────────
    {"title": "Electrician (Residential)", "employer": "Sumadhura Construction", "area": "Yelahanka", "lat": 13.1007, "lon": 77.5963, "pay_min": 18000, "pay_max": 25000, "skills": ["electrician"], "languages": ["kannada"], "type": "job"},
    {"title": "Electrical Technician", "employer": "Wipro Facilities", "area": "Electronic City", "lat": 12.8452, "lon": 77.6602, "pay_min": 20000, "pay_max": 28000, "skills": ["electrician", "ac_technician"], "languages": ["kannada", "english"], "type": "job"},
    {"title": "Plumber", "employer": "Prestige Group", "area": "Whitefield", "lat": 12.9698, "lon": 77.7499, "pay_min": 16000, "pay_max": 22000, "skills": ["plumber"], "languages": ["kannada"], "type": "job"},
    {"title": "Plumbing Helper", "employer": "Happy Homes Maintenance", "area": "BTM Layout", "lat": 12.9165, "lon": 77.6101, "pay_min": 12000, "pay_max": 16000, "skills": ["plumber", "construction_helper"], "languages": ["kannada"], "type": "job"},
    {"title": "Mason", "employer": "L&T Construction", "area": "Hebbal", "lat": 13.0353, "lon": 77.5970, "pay_min": 20000, "pay_max": 28000, "skills": ["mason"], "languages": ["kannada", "hindi"], "type": "job"},
    {"title": "Construction Worker", "employer": "Puravankara Projects", "area": "Yelahanka", "lat": 13.1007, "lon": 77.5963, "pay_min": 14000, "pay_max": 18000, "skills": ["construction_helper"], "languages": ["kannada", "hindi"], "type": "job"},
    {"title": "AC Technician", "employer": "Daikin Service Centre", "area": "Vijayanagar", "lat": 12.9728, "lon": 77.5337, "pay_min": 18000, "pay_max": 26000, "skills": ["ac_technician"], "languages": ["kannada", "hindi"], "type": "job"},
    {"title": "Painter", "employer": "Asian Paints Home Solutions", "area": "Malleshwaram", "lat": 13.0030, "lon": 77.5690, "pay_min": 16000, "pay_max": 22000, "skills": ["painting"], "languages": ["kannada"], "type": "job"},
    {"title": "Welder Helper", "employer": "Bosch India", "area": "Peenya", "lat": 13.0284, "lon": 77.5176, "pay_min": 14000, "pay_max": 19000, "skills": ["welder", "factory_worker"], "languages": ["kannada", "hindi"], "type": "job"},
    {"title": "Carpenter", "employer": "Hometown Furniture", "area": "Yeshwanthpur", "lat": 13.0210, "lon": 77.5371, "pay_min": 18000, "pay_max": 24000, "skills": ["carpenter"], "languages": ["kannada"], "type": "job"},
    {"title": "Mobile Repair Technician", "employer": "iCare Mobile Services", "area": "Indiranagar", "lat": 12.9784, "lon": 77.6408, "pay_min": 14000, "pay_max": 20000, "skills": ["mobile_repair"], "languages": ["kannada", "english"], "type": "job"},
    # ── RETAIL / OFFICE ───────────────────────────────────────────────────────
    {"title": "Retail Sales Executive", "employer": "Reliance Smart", "area": "HSR Layout", "lat": 12.9116, "lon": 77.6474, "pay_min": 12000, "pay_max": 16000, "skills": ["retail_sales", "pos_billing"], "languages": ["kannada", "english"], "type": "job"},
    {"title": "Cashier", "employer": "BigBasket Store", "area": "Koramangala", "lat": 12.9352, "lon": 77.6245, "pay_min": 13000, "pay_max": 16000, "skills": ["pos_billing"], "languages": ["kannada"], "type": "job"},
    {"title": "Store Associate", "employer": "DMart Marathahalli", "area": "Marathahalli", "lat": 12.9591, "lon": 77.6971, "pay_min": 12000, "pay_max": 15000, "skills": ["retail_sales", "warehouse"], "languages": ["kannada", "hindi"], "type": "job"},
    {"title": "Data Entry Operator", "employer": "Wipro BPS", "area": "Electronic City", "lat": 12.8452, "lon": 77.6602, "pay_min": 14000, "pay_max": 18000, "skills": ["data_entry", "basic_english"], "languages": ["english", "kannada"], "type": "job"},
    {"title": "Telecaller", "employer": "Concentrix", "area": "Whitefield", "lat": 12.9698, "lon": 77.7499, "pay_min": 14000, "pay_max": 18000, "skills": ["telecalling", "basic_english"], "languages": ["english", "hindi"], "type": "job"},
    {"title": "Customer Support Executive", "employer": "HCL BPO", "area": "Electronic City", "lat": 12.8452, "lon": 77.6602, "pay_min": 15000, "pay_max": 20000, "skills": ["telecalling", "basic_english"], "languages": ["english"], "type": "job"},
    # ── GARMENT / TAILORING ───────────────────────────────────────────────────
    {"title": "Stitching Operator", "employer": "Raymond Garments", "area": "Peenya", "lat": 13.0284, "lon": 77.5176, "pay_min": 12000, "pay_max": 16000, "skills": ["tailoring"], "languages": ["kannada", "hindi"], "type": "job"},
    {"title": "Tailor (Alterations)", "employer": "Shoppers Stop", "area": "Malleshwaram", "lat": 13.0030, "lon": 77.5690, "pay_min": 13000, "pay_max": 17000, "skills": ["tailoring"], "languages": ["kannada"], "type": "job"},
    {"title": "Garment Production Helper", "employer": "Gokaldas Exports", "area": "Peenya", "lat": 13.0284, "lon": 77.5176, "pay_min": 11000, "pay_max": 14000, "skills": ["tailoring", "factory_worker"], "languages": ["kannada", "hindi"], "type": "job"},
    # ── LOGISTICS / WAREHOUSE ─────────────────────────────────────────────────
    {"title": "Warehouse Packer", "employer": "Amazon Fulfillment", "area": "Whitefield", "lat": 12.9698, "lon": 77.7499, "pay_min": 14000, "pay_max": 18000, "skills": ["warehouse"], "languages": ["kannada", "hindi"], "type": "job"},
    {"title": "Inventory Helper", "employer": "Flipkart Warehouse", "area": "Domlur", "lat": 12.9601, "lon": 77.6394, "pay_min": 13000, "pay_max": 17000, "skills": ["warehouse", "data_entry"], "languages": ["kannada"], "type": "job"},
    {"title": "Forklift Operator", "employer": "Safexpress Logistics", "area": "Peenya", "lat": 13.0284, "lon": 77.5176, "pay_min": 18000, "pay_max": 24000, "skills": ["forklift", "warehouse"], "languages": ["kannada", "hindi"], "type": "job"},
    {"title": "Loading Staff", "employer": "DTDC Courier Hub", "area": "Yeshwanthpur", "lat": 13.0210, "lon": 77.5371, "pay_min": 12000, "pay_max": 15000, "skills": ["warehouse"], "languages": ["kannada"], "type": "job"},
    # ── PERSONAL SERVICES ─────────────────────────────────────────────────────
    {"title": "Barber", "employer": "Enrich Salon", "area": "Indiranagar", "lat": 12.9784, "lon": 77.6408, "pay_min": 14000, "pay_max": 20000, "skills": ["barber"], "languages": ["kannada", "english"], "type": "job"},
    {"title": "Beautician", "employer": "Naturals Salon", "area": "Koramangala", "lat": 12.9352, "lon": 77.6245, "pay_min": 15000, "pay_max": 22000, "skills": ["beautician"], "languages": ["kannada"], "type": "job"},
    {"title": "Gym Trainer", "employer": "Gold's Gym Whitefield", "area": "Whitefield", "lat": 12.9698, "lon": 77.7499, "pay_min": 16000, "pay_max": 24000, "skills": ["gym_trainer", "basic_english"], "languages": ["english", "kannada"], "type": "job"},
    {"title": "Massage Therapist", "employer": "Jaquar Spa & Wellness", "area": "Residency Road", "lat": 12.9733, "lon": 77.6018, "pay_min": 15000, "pay_max": 22000, "skills": ["beautician", "elder_care"], "languages": ["english"], "type": "job"},
    # ── FACTORY / MANUFACTURING ───────────────────────────────────────────────
    {"title": "Machine Operator", "employer": "TVS Sundaram Fasteners", "area": "Peenya", "lat": 13.0284, "lon": 77.5176, "pay_min": 16000, "pay_max": 21000, "skills": ["factory_worker"], "languages": ["kannada", "hindi"], "type": "job"},
    {"title": "Production Worker", "employer": "Minda Industries", "area": "Bidadi", "lat": 12.7987, "lon": 77.3867, "pay_min": 14000, "pay_max": 18000, "skills": ["factory_worker"], "languages": ["kannada"], "type": "job"},
    {"title": "Quality Inspector", "employer": "ISRO Ancillary Supplier", "area": "Peenya", "lat": 13.0284, "lon": 77.5176, "pay_min": 18000, "pay_max": 24000, "skills": ["factory_worker", "data_entry"], "languages": ["kannada", "english"], "type": "job"},
    {"title": "Packaging Line Worker", "employer": "ITC Paperboards", "area": "Bidadi", "lat": 12.7987, "lon": 77.3867, "pay_min": 13000, "pay_max": 17000, "skills": ["factory_worker", "warehouse"], "languages": ["kannada", "hindi"], "type": "job"},
    # ── APPRENTICESHIPS ───────────────────────────────────────────────────────
    {"title": "Electrician Apprentice", "employer": "BESCOM Training", "area": "Majestic", "lat": 12.9773, "lon": 77.5713, "pay_min": 8000, "pay_max": 10000, "skills": ["electrician"], "languages": ["kannada"], "type": "apprenticeship"},
    {"title": "Plumbing Apprentice", "employer": "NSDC Skill Hub", "area": "Jayanagar", "lat": 12.9250, "lon": 77.5938, "pay_min": 7000, "pay_max": 9500, "skills": ["plumber"], "languages": ["kannada", "hindi"], "type": "apprenticeship"},
    {"title": "Tailoring Apprentice", "employer": "NIFT Bangalore Outreach", "area": "Peenya", "lat": 13.0284, "lon": 77.5176, "pay_min": 6000, "pay_max": 8500, "skills": ["tailoring"], "languages": ["kannada"], "type": "apprenticeship"},
    {"title": "Mobile Repair Apprentice", "employer": "PMKVY Centre Whitefield", "area": "Whitefield", "lat": 12.9698, "lon": 77.7499, "pay_min": 6500, "pay_max": 9000, "skills": ["mobile_repair"], "languages": ["kannada", "hindi"], "type": "apprenticeship"},
    {"title": "Carpentry Apprentice", "employer": "Skill India Hub Peenya", "area": "Peenya", "lat": 13.0284, "lon": 77.5176, "pay_min": 7500, "pay_max": 10000, "skills": ["carpenter"], "languages": ["kannada"], "type": "apprenticeship"},
    {"title": "AC Service Apprentice", "employer": "Daikin Training Centre", "area": "Electronic City", "lat": 12.8452, "lon": 77.6602, "pay_min": 7000, "pay_max": 10000, "skills": ["ac_technician"], "languages": ["kannada", "english"], "type": "apprenticeship"},
    {"title": "Data Entry Apprentice", "employer": "NIIT Digital Bengaluru", "area": "Koramangala", "lat": 12.9352, "lon": 77.6245, "pay_min": 7000, "pay_max": 9500, "skills": ["data_entry", "basic_english"], "languages": ["english", "kannada"], "type": "apprenticeship"},
    {"title": "Welding Apprentice", "employer": "ITI Rajajinagar", "area": "Rajajinagar", "lat": 12.9936, "lon": 77.5527, "pay_min": 7500, "pay_max": 10000, "skills": ["welder"], "languages": ["kannada", "hindi"], "type": "apprenticeship"},
    {"title": "Cooking Apprentice", "employer": "IHM Bangalore", "area": "Malleshwaram", "lat": 13.0030, "lon": 77.5690, "pay_min": 6000, "pay_max": 8500, "skills": ["cook", "food_handler"], "languages": ["kannada", "english"], "type": "apprenticeship"},
    {"title": "Security Training Programme", "employer": "G4S Academy", "area": "Yelahanka", "lat": 13.1007, "lon": 77.5963, "pay_min": 7000, "pay_max": 9000, "skills": ["security_guard"], "languages": ["kannada", "english"], "type": "apprenticeship"},
    {"title": "Housekeeping Apprentice", "employer": "Taj Hospitality Training", "area": "MG Road", "lat": 12.9756, "lon": 77.6099, "pay_min": 6500, "pay_max": 9000, "skills": ["housekeeping", "hotel_helper"], "languages": ["english", "kannada"], "type": "apprenticeship"},
    {"title": "Driving Training (LMV)", "employer": "Motor Driving School Jayanagar", "area": "Jayanagar", "lat": 12.9250, "lon": 77.5938, "pay_min": 7000, "pay_max": 9500, "skills": ["driver_car", "driving_licence"], "languages": ["kannada"], "type": "apprenticeship"},
    # ── ADDITIONAL MIXED ──────────────────────────────────────────────────────
    {"title": "Sanitation Worker", "employer": "BBMP Contractual", "area": "Majestic", "lat": 12.9773, "lon": 77.5713, "pay_min": 11000, "pay_max": 14000, "skills": ["sanitation"], "languages": ["kannada"], "type": "job"},
    {"title": "Farm / Garden Labourer", "employer": "Hesaraghatta Farm Co-op", "area": "Yelahanka", "lat": 13.1007, "lon": 77.5963, "pay_min": 10000, "pay_max": 13000, "skills": ["gardener", "farm_worker"], "languages": ["kannada"], "type": "job"},
    {"title": "Truck Driver (LMV)", "employer": "Blue Dart Logistics", "area": "KR Puram", "lat": 13.0090, "lon": 77.6974, "pay_min": 20000, "pay_max": 30000, "skills": ["truck_driver", "driving_licence"], "languages": ["hindi", "kannada"], "type": "job"},
    {"title": "Event Helper", "employer": "Kingdom of Dreams Events", "area": "Whitefield", "lat": 12.9698, "lon": 77.7499, "pay_min": 10000, "pay_max": 14000, "skills": ["event_helper"], "languages": ["kannada", "hindi"], "type": "job"},
    {"title": "POS Billing Staff", "employer": "Star Bazaar", "area": "BTM Layout", "lat": 12.9165, "lon": 77.6101, "pay_min": 12000, "pay_max": 15000, "skills": ["pos_billing", "basic_english"], "languages": ["kannada", "english"], "type": "job"},
    {"title": "Food Handler (FSSAI Certified)", "employer": "Zomato Hyperpure", "area": "Domlur", "lat": 12.9601, "lon": 77.6394, "pay_min": 14000, "pay_max": 18000, "skills": ["food_handler", "warehouse"], "languages": ["kannada", "english"], "type": "job"},
    {"title": "Swimming Pool Attendant", "employer": "ITC Windsor Hotel", "area": "Malleshwaram", "lat": 13.0030, "lon": 77.5690, "pay_min": 13000, "pay_max": 17000, "skills": ["swimming_pool"], "languages": ["english", "kannada"], "type": "job"},
]
# fmt: on

POSTED_AT = datetime.now(timezone.utc).isoformat()


def seed_jobs() -> int:
    """Insert all seed jobs (skip if DB already populated). Returns count inserted."""
    init_db()
    with ENGINE.connect() as conn:
        existing = conn.execute(jobs_table.select()).rowcount
        # rowcount on SELECT is -1 on SQLite; use fetchall
        existing_count = len(conn.execute(jobs_table.select()).fetchall())
        if existing_count > 0:
            return 0  # already seeded

        rows = []
        for i, entry in enumerate(_SEED):
            jlat, jlon = _jitter(entry["lat"], entry["lon"])
            rows.append({
                "id": str(uuid.uuid4()),
                "title": entry["title"],
                "employer": entry["employer"],
                "area": entry["area"],
                "lat": jlat,
                "lon": jlon,
                "pay_min": entry["pay_min"],
                "pay_max": entry["pay_max"],
                "skills_required": json.dumps(entry["skills"]),
                "languages": json.dumps(entry["languages"]),
                "type": entry["type"],
                "posted_at": POSTED_AT,
                "is_synthetic": True,
            })
        conn.execute(insert(jobs_table), rows)
        conn.commit()
        return len(rows)


if __name__ == "__main__":
    n = seed_jobs()
    print(f"Seeded {n} jobs." if n else "Already seeded.")
