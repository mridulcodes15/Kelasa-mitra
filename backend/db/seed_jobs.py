"""
Seed 80 synthetic Bengaluru jobs into the database.
Run directly:  python -m db.seed_jobs
Or called from main.py at startup.

All employers are invented names; no job here is real.

Coordinate jitter: each job lat/lon is randomised up to ±0.008° (about 0.9 km on
each axis, about 1.2 km at most) from the area centre so distances shown to workers are realistic rather than all
being identical.

Everything is deterministic: job IDs are job-001 to job-080, the jitter uses a fixed
random seed, and posted_at is a fixed date. build_seed_rows() is the single source
for both the SQLite seed and data/jobs_snapshot.json (used by the Orchestrate tools).
"""
from __future__ import annotations

import json
import random
from typing import Any

from sqlalchemy import insert

from db.database import ENGINE, init_db, jobs_table

# About 0.9 km per axis at Bengaluru's latitude, expressed in degrees
_JITTER_DEG = 0.008


def _jitter(rng: random.Random, lat: float, lon: float) -> tuple[float, float]:
    """Randomly offset lat/lon by up to ±_JITTER_DEG on each axis."""
    dlat = (rng.random() * 2 - 1) * _JITTER_DEG
    dlon = (rng.random() * 2 - 1) * _JITTER_DEG
    return round(lat + dlat, 6), round(lon + dlon, 6)

# fmt: off
_SEED: list[dict] = [
    # ── HOSPITALITY ──────────────────────────────────────────────────────────
    {"title": "Hotel Room Attendant", "employer": "Sampige Court Hotel", "area": "Residency Road", "lat": 12.9733, "lon": 77.6018, "pay_min": 12000, "pay_max": 16000, "skills": ["hotel_helper", "housekeeping"], "languages": ["kannada", "english"], "type": "job"},
    {"title": "Restaurant Helper", "employer": "Malli Tiffin Room", "area": "Majestic", "lat": 12.9773, "lon": 77.5713, "pay_min": 10000, "pay_max": 13000, "skills": ["hotel_helper", "cook"], "languages": ["kannada"], "type": "job"},
    {"title": "Kitchen Assistant", "employer": "Kavana Grand Hotel", "area": "MG Road", "lat": 12.9756, "lon": 77.6099, "pay_min": 14000, "pay_max": 18000, "skills": ["cook", "food_handler"], "languages": ["english", "kannada"], "type": "job"},
    {"title": "Canteen Worker", "employer": "Techpark Campus Canteen Co.", "area": "Electronic City", "lat": 12.8452, "lon": 77.6602, "pay_min": 11000, "pay_max": 14000, "skills": ["cook", "food_handler"], "languages": ["kannada", "hindi"], "type": "job"},
    {"title": "Catering Assistant", "employer": "Nandi Banquets & Catering", "area": "MG Road", "lat": 12.9756, "lon": 77.6099, "pay_min": 13000, "pay_max": 17000, "skills": ["cook", "event_helper", "food_handler"], "languages": ["english"], "type": "job"},
    {"title": "Banquet Staff", "employer": "Residency Hall Banquets", "area": "Residency Road", "lat": 12.9733, "lon": 77.6018, "pay_min": 12000, "pay_max": 15000, "skills": ["event_helper", "hotel_helper"], "languages": ["english", "kannada"], "type": "job"},
    {"title": "Hotel Housekeeper", "employer": "Whitefield Stay Hotel", "area": "Whitefield", "lat": 12.9698, "lon": 77.7499, "pay_min": 11000, "pay_max": 14500, "skills": ["housekeeping", "hotel_helper"], "languages": ["kannada"], "type": "job"},
    {"title": "Pool Attendant", "employer": "Kabini Pool Hotel", "area": "Brigade Road", "lat": 12.9716, "lon": 77.6099, "pay_min": 12000, "pay_max": 15000, "skills": ["swimming_pool", "housekeeping"], "languages": ["english"], "type": "job"},
    # ── DELIVERY / TRANSPORT ─────────────────────────────────────────────────
    {"title": "Delivery Executive", "employer": "QuickDabba Delivery", "area": "Koramangala", "lat": 12.9352, "lon": 77.6245, "pay_min": 16000, "pay_max": 22000, "skills": ["delivery", "two_wheeler"], "languages": ["kannada", "hindi"], "type": "job"},
    {"title": "Delivery Executive", "employer": "FoodHop Riders", "area": "Indiranagar", "lat": 12.9784, "lon": 77.6408, "pay_min": 15000, "pay_max": 21000, "skills": ["delivery", "two_wheeler"], "languages": ["kannada"], "type": "job"},
    {"title": "Last Mile Delivery Agent", "employer": "LastMile Mitra", "area": "Whitefield", "lat": 12.9698, "lon": 77.7499, "pay_min": 17000, "pay_max": 23000, "skills": ["delivery", "two_wheeler", "driving_licence"], "languages": ["english", "kannada"], "type": "job"},
    {"title": "Courier Delivery Boy", "employer": "SwiftParcel Couriers", "area": "Marathahalli", "lat": 12.9591, "lon": 77.6971, "pay_min": 14000, "pay_max": 18000, "skills": ["delivery", "two_wheeler"], "languages": ["kannada", "hindi"], "type": "job"},
    {"title": "Personal Driver", "employer": "CityLine Executive Transport", "area": "MG Road", "lat": 12.9756, "lon": 77.6099, "pay_min": 18000, "pay_max": 25000, "skills": ["driver_car", "driving_licence"], "languages": ["english", "kannada"], "type": "job"},
    {"title": "Cab Driver", "employer": "GreenRoute Cabs", "area": "Yeshwanthpur", "lat": 13.0210, "lon": 77.5371, "pay_min": 20000, "pay_max": 30000, "skills": ["driver_car", "driving_licence", "basic_english"], "languages": ["kannada", "hindi"], "type": "job"},
    {"title": "App-Based Driver", "employer": "ZipRide Bikes", "area": "Majestic", "lat": 12.9773, "lon": 77.5713, "pay_min": 14000, "pay_max": 20000, "skills": ["two_wheeler", "driving_licence"], "languages": ["kannada"], "type": "job"},
    {"title": "Logistics Executive", "employer": "CartRoute Logistics", "area": "Electronic City", "lat": 12.8452, "lon": 77.6602, "pay_min": 16000, "pay_max": 20000, "skills": ["delivery", "warehouse", "two_wheeler"], "languages": ["kannada", "hindi"], "type": "job"},
    {"title": "Auto Driver", "employer": "Self-Employed (Auto Stand Co-op)", "area": "Jayanagar", "lat": 12.9250, "lon": 77.5938, "pay_min": 15000, "pay_max": 22000, "skills": ["auto_driver", "driving_licence"], "languages": ["kannada"], "type": "job"},
    # ── SECURITY ─────────────────────────────────────────────────────────────
    {"title": "Security Guard", "employer": "Kaval Security Services", "area": "Whitefield", "lat": 12.9698, "lon": 77.7499, "pay_min": 13000, "pay_max": 16000, "skills": ["security_guard"], "languages": ["kannada"], "type": "job"},
    {"title": "Security Guard", "employer": "Gatewatch Security", "area": "Electronic City", "lat": 12.8452, "lon": 77.6602, "pay_min": 12500, "pay_max": 15500, "skills": ["security_guard"], "languages": ["kannada", "hindi"], "type": "job"},
    {"title": "Night Watchman", "employer": "Lakeview Residences", "area": "Koramangala", "lat": 12.9352, "lon": 77.6245, "pay_min": 12000, "pay_max": 14500, "skills": ["watchman", "security_guard"], "languages": ["kannada"], "type": "job"},
    {"title": "Gatekeeper", "employer": "Greenpark Apartments", "area": "Marathahalli", "lat": 12.9591, "lon": 77.6971, "pay_min": 13000, "pay_max": 16000, "skills": ["watchman"], "languages": ["kannada"], "type": "job"},
    {"title": "Security Supervisor", "employer": "Suraksha Mitra Agency", "area": "HSR Layout", "lat": 12.9116, "lon": 77.6474, "pay_min": 17000, "pay_max": 21000, "skills": ["security_guard", "basic_english"], "languages": ["kannada", "english"], "type": "job"},
    # ── DOMESTIC / CLEANING ───────────────────────────────────────────────────
    {"title": "Housekeeping Staff", "employer": "Shubhra Facility Care", "area": "Indiranagar", "lat": 12.9784, "lon": 77.6408, "pay_min": 10000, "pay_max": 13000, "skills": ["housekeeping"], "languages": ["kannada"], "type": "job"},
    {"title": "Office Cleaning Staff", "employer": "Spotless Office Care", "area": "Koramangala", "lat": 12.9352, "lon": 77.6245, "pay_min": 10000, "pay_max": 13500, "skills": ["housekeeping", "sanitation"], "languages": ["kannada"], "type": "job"},
    {"title": "Domestic Help", "employer": "HomeHelp Mitra", "area": "BTM Layout", "lat": 12.9165, "lon": 77.6101, "pay_min": 12000, "pay_max": 16000, "skills": ["housekeeping", "cook"], "languages": ["kannada", "hindi"], "type": "job"},
    {"title": "Nanny / Babysitter", "employer": "Little Steps Home Services", "area": "Jayanagar", "lat": 12.9250, "lon": 77.5938, "pay_min": 10000, "pay_max": 14000, "skills": ["babysitter"], "languages": ["kannada"], "type": "job"},
    {"title": "Elder Care Attendant", "employer": "Arogya Home Attendants", "area": "JP Nagar", "lat": 12.9063, "lon": 77.5857, "pay_min": 12000, "pay_max": 16000, "skills": ["elder_care"], "languages": ["kannada", "hindi"], "type": "job"},
    {"title": "Laundry Worker", "employer": "Fresh Fold Laundry", "area": "Rajajinagar", "lat": 12.9936, "lon": 77.5527, "pay_min": 9000, "pay_max": 12000, "skills": ["laundry"], "languages": ["kannada"], "type": "job"},
    {"title": "Gardener", "employer": "Cubbon View Apartments", "area": "Banashankari", "lat": 12.9254, "lon": 77.5468, "pay_min": 9000, "pay_max": 12000, "skills": ["gardener"], "languages": ["kannada"], "type": "job"},
    # ── CONSTRUCTION / TECHNICAL ─────────────────────────────────────────────
    {"title": "Electrician (Residential)", "employer": "Shilpa Builders", "area": "Yelahanka", "lat": 13.1007, "lon": 77.5963, "pay_min": 18000, "pay_max": 25000, "skills": ["electrician"], "languages": ["kannada"], "type": "job"},
    {"title": "Electrical Technician", "employer": "TechCampus Facilities", "area": "Electronic City", "lat": 12.8452, "lon": 77.6602, "pay_min": 20000, "pay_max": 28000, "skills": ["electrician", "ac_technician"], "languages": ["kannada", "english"], "type": "job"},
    {"title": "Plumber", "employer": "Mantap Maintenance", "area": "Whitefield", "lat": 12.9698, "lon": 77.7499, "pay_min": 16000, "pay_max": 22000, "skills": ["plumber"], "languages": ["kannada"], "type": "job"},
    {"title": "Plumbing Helper", "employer": "Happy Tap Maintenance", "area": "BTM Layout", "lat": 12.9165, "lon": 77.6101, "pay_min": 12000, "pay_max": 16000, "skills": ["plumber", "construction_helper"], "languages": ["kannada"], "type": "job"},
    {"title": "Mason", "employer": "Gopura Constructions", "area": "Hebbal", "lat": 13.0353, "lon": 77.5970, "pay_min": 20000, "pay_max": 28000, "skills": ["mason"], "languages": ["kannada", "hindi"], "type": "job"},
    {"title": "Construction Worker", "employer": "Vasati Projects", "area": "Yelahanka", "lat": 13.1007, "lon": 77.5963, "pay_min": 14000, "pay_max": 18000, "skills": ["construction_helper"], "languages": ["kannada", "hindi"], "type": "job"},
    {"title": "AC Technician", "employer": "CoolAir Service Centre", "area": "Vijayanagar", "lat": 12.9728, "lon": 77.5337, "pay_min": 18000, "pay_max": 26000, "skills": ["ac_technician"], "languages": ["kannada", "hindi"], "type": "job"},
    {"title": "Painter", "employer": "Rangoli Home Painters", "area": "Malleshwaram", "lat": 13.0030, "lon": 77.5690, "pay_min": 16000, "pay_max": 22000, "skills": ["painting"], "languages": ["kannada"], "type": "job"},
    {"title": "Welder Helper", "employer": "Peenya Fabrication Works", "area": "Peenya", "lat": 13.0284, "lon": 77.5176, "pay_min": 14000, "pay_max": 19000, "skills": ["welder", "factory_worker"], "languages": ["kannada", "hindi"], "type": "job"},
    {"title": "Carpenter", "employer": "Teakline Furniture", "area": "Yeshwanthpur", "lat": 13.0210, "lon": 77.5371, "pay_min": 18000, "pay_max": 24000, "skills": ["carpenter"], "languages": ["kannada"], "type": "job"},
    {"title": "Mobile Repair Technician", "employer": "PhoneFix Corner", "area": "Indiranagar", "lat": 12.9784, "lon": 77.6408, "pay_min": 14000, "pay_max": 20000, "skills": ["mobile_repair"], "languages": ["kannada", "english"], "type": "job"},
    # ── RETAIL / OFFICE ───────────────────────────────────────────────────────
    {"title": "Retail Sales Executive", "employer": "Janata Smart Store", "area": "HSR Layout", "lat": 12.9116, "lon": 77.6474, "pay_min": 12000, "pay_max": 16000, "skills": ["retail_sales", "pos_billing"], "languages": ["kannada", "english"], "type": "job"},
    {"title": "Cashier", "employer": "DailyCart Store", "area": "Koramangala", "lat": 12.9352, "lon": 77.6245, "pay_min": 13000, "pay_max": 16000, "skills": ["pos_billing"], "languages": ["kannada"], "type": "job"},
    {"title": "Store Associate", "employer": "ValueMart Marathahalli", "area": "Marathahalli", "lat": 12.9591, "lon": 77.6971, "pay_min": 12000, "pay_max": 15000, "skills": ["retail_sales", "warehouse"], "languages": ["kannada", "hindi"], "type": "job"},
    {"title": "Data Entry Operator", "employer": "DataDesk Services", "area": "Electronic City", "lat": 12.8452, "lon": 77.6602, "pay_min": 14000, "pay_max": 18000, "skills": ["data_entry", "basic_english"], "languages": ["english", "kannada"], "type": "job"},
    {"title": "Telecaller", "employer": "HelloLine Call Centre", "area": "Whitefield", "lat": 12.9698, "lon": 77.7499, "pay_min": 14000, "pay_max": 18000, "skills": ["telecalling", "basic_english"], "languages": ["english", "hindi"], "type": "job"},
    {"title": "Customer Support Executive", "employer": "VoiceDesk BPO", "area": "Electronic City", "lat": 12.8452, "lon": 77.6602, "pay_min": 15000, "pay_max": 20000, "skills": ["telecalling", "basic_english"], "languages": ["english"], "type": "job"},
    # ── GARMENT / TAILORING ───────────────────────────────────────────────────
    {"title": "Stitching Operator", "employer": "Silk Thread Garments", "area": "Peenya", "lat": 13.0284, "lon": 77.5176, "pay_min": 12000, "pay_max": 16000, "skills": ["tailoring"], "languages": ["kannada", "hindi"], "type": "job"},
    {"title": "Tailor (Alterations)", "employer": "Fashion Corner Alterations", "area": "Malleshwaram", "lat": 13.0030, "lon": 77.5690, "pay_min": 13000, "pay_max": 17000, "skills": ["tailoring"], "languages": ["kannada"], "type": "job"},
    {"title": "Garment Production Helper", "employer": "Kasuti Garment Exports", "area": "Peenya", "lat": 13.0284, "lon": 77.5176, "pay_min": 11000, "pay_max": 14000, "skills": ["tailoring", "factory_worker"], "languages": ["kannada", "hindi"], "type": "job"},
    # ── LOGISTICS / WAREHOUSE ─────────────────────────────────────────────────
    {"title": "Warehouse Packer", "employer": "BoxHub Fulfilment", "area": "Whitefield", "lat": 12.9698, "lon": 77.7499, "pay_min": 14000, "pay_max": 18000, "skills": ["warehouse"], "languages": ["kannada", "hindi"], "type": "job"},
    {"title": "Inventory Helper", "employer": "CartRoute Warehouse", "area": "Domlur", "lat": 12.9601, "lon": 77.6394, "pay_min": 13000, "pay_max": 17000, "skills": ["warehouse", "data_entry"], "languages": ["kannada"], "type": "job"},
    {"title": "Forklift Operator", "employer": "SafeLift Logistics", "area": "Peenya", "lat": 13.0284, "lon": 77.5176, "pay_min": 18000, "pay_max": 24000, "skills": ["forklift", "warehouse"], "languages": ["kannada", "hindi"], "type": "job"},
    {"title": "Loading Staff", "employer": "SwiftParcel Hub", "area": "Yeshwanthpur", "lat": 13.0210, "lon": 77.5371, "pay_min": 12000, "pay_max": 15000, "skills": ["warehouse"], "languages": ["kannada"], "type": "job"},
    # ── PERSONAL SERVICES ─────────────────────────────────────────────────────
    {"title": "Barber", "employer": "Sundari Salon", "area": "Indiranagar", "lat": 12.9784, "lon": 77.6408, "pay_min": 14000, "pay_max": 20000, "skills": ["barber"], "languages": ["kannada", "english"], "type": "job"},
    {"title": "Beautician", "employer": "Mallige Beauty Parlour", "area": "Koramangala", "lat": 12.9352, "lon": 77.6245, "pay_min": 15000, "pay_max": 22000, "skills": ["beautician"], "languages": ["kannada"], "type": "job"},
    {"title": "Gym Trainer", "employer": "IronWorks Gym Whitefield", "area": "Whitefield", "lat": 12.9698, "lon": 77.7499, "pay_min": 16000, "pay_max": 24000, "skills": ["gym_trainer", "basic_english"], "languages": ["english", "kannada"], "type": "job"},
    {"title": "Massage Therapist", "employer": "Tranquil Spa & Wellness", "area": "Residency Road", "lat": 12.9733, "lon": 77.6018, "pay_min": 15000, "pay_max": 22000, "skills": ["beautician", "elder_care"], "languages": ["english"], "type": "job"},
    # ── FACTORY / MANUFACTURING ───────────────────────────────────────────────
    {"title": "Machine Operator", "employer": "Peenya Fasteners Works", "area": "Peenya", "lat": 13.0284, "lon": 77.5176, "pay_min": 16000, "pay_max": 21000, "skills": ["factory_worker"], "languages": ["kannada", "hindi"], "type": "job"},
    {"title": "Production Worker", "employer": "Bidadi Auto Parts Works", "area": "Bidadi", "lat": 12.7987, "lon": 77.3867, "pay_min": 14000, "pay_max": 18000, "skills": ["factory_worker"], "languages": ["kannada"], "type": "job"},
    {"title": "Quality Inspector", "employer": "Precision Parts Supplier", "area": "Peenya", "lat": 13.0284, "lon": 77.5176, "pay_min": 18000, "pay_max": 24000, "skills": ["factory_worker", "data_entry"], "languages": ["kannada", "english"], "type": "job"},
    {"title": "Packaging Line Worker", "employer": "Bidadi Paperboard Works", "area": "Bidadi", "lat": 12.7987, "lon": 77.3867, "pay_min": 13000, "pay_max": 17000, "skills": ["factory_worker", "warehouse"], "languages": ["kannada", "hindi"], "type": "job"},
    # ── APPRENTICESHIPS ───────────────────────────────────────────────────────
    {"title": "Electrician Apprentice", "employer": "Wiring Skills Training Yard", "area": "Majestic", "lat": 12.9773, "lon": 77.5713, "pay_min": 8000, "pay_max": 10000, "skills": ["electrician"], "languages": ["kannada"], "type": "apprenticeship"},
    {"title": "Plumbing Apprentice", "employer": "Jayanagar Trades Workshop", "area": "Jayanagar", "lat": 12.9250, "lon": 77.5938, "pay_min": 7000, "pay_max": 9500, "skills": ["plumber"], "languages": ["kannada", "hindi"], "type": "apprenticeship"},
    {"title": "Tailoring Apprentice", "employer": "Stitchcraft Workshop", "area": "Peenya", "lat": 13.0284, "lon": 77.5176, "pay_min": 6000, "pay_max": 8500, "skills": ["tailoring"], "languages": ["kannada"], "type": "apprenticeship"},
    {"title": "Mobile Repair Apprentice", "employer": "Whitefield Repair Workshop", "area": "Whitefield", "lat": 12.9698, "lon": 77.7499, "pay_min": 6500, "pay_max": 9000, "skills": ["mobile_repair"], "languages": ["kannada", "hindi"], "type": "apprenticeship"},
    {"title": "Carpentry Apprentice", "employer": "Peenya Woodcraft Workshop", "area": "Peenya", "lat": 13.0284, "lon": 77.5176, "pay_min": 7500, "pay_max": 10000, "skills": ["carpenter"], "languages": ["kannada"], "type": "apprenticeship"},
    {"title": "AC Service Apprentice", "employer": "CoolAir Training Yard", "area": "Electronic City", "lat": 12.8452, "lon": 77.6602, "pay_min": 7000, "pay_max": 10000, "skills": ["ac_technician"], "languages": ["kannada", "english"], "type": "apprenticeship"},
    {"title": "Data Entry Apprentice", "employer": "Keyboard Skills Workshop", "area": "Koramangala", "lat": 12.9352, "lon": 77.6245, "pay_min": 7000, "pay_max": 9500, "skills": ["data_entry", "basic_english"], "languages": ["english", "kannada"], "type": "apprenticeship"},
    {"title": "Welding Apprentice", "employer": "Rajajinagar Welding Workshop", "area": "Rajajinagar", "lat": 12.9936, "lon": 77.5527, "pay_min": 7500, "pay_max": 10000, "skills": ["welder"], "languages": ["kannada", "hindi"], "type": "apprenticeship"},
    {"title": "Cooking Apprentice", "employer": "Malleshwaram Kitchen Workshop", "area": "Malleshwaram", "lat": 13.0030, "lon": 77.5690, "pay_min": 6000, "pay_max": 8500, "skills": ["cook", "food_handler"], "languages": ["kannada", "english"], "type": "apprenticeship"},
    {"title": "Security Training Programme", "employer": "Kaval Training Yard", "area": "Yelahanka", "lat": 13.1007, "lon": 77.5963, "pay_min": 7000, "pay_max": 9000, "skills": ["security_guard"], "languages": ["kannada", "english"], "type": "apprenticeship"},
    {"title": "Housekeeping Apprentice", "employer": "Sampige Hospitality Training", "area": "MG Road", "lat": 12.9756, "lon": 77.6099, "pay_min": 6500, "pay_max": 9000, "skills": ["housekeeping", "hotel_helper"], "languages": ["english", "kannada"], "type": "apprenticeship"},
    {"title": "Driving Training (LMV)", "employer": "Steady Wheels Driving Yard", "area": "Jayanagar", "lat": 12.9250, "lon": 77.5938, "pay_min": 7000, "pay_max": 9500, "skills": ["driver_car", "driving_licence"], "languages": ["kannada"], "type": "apprenticeship"},
    # ── ADDITIONAL MIXED ──────────────────────────────────────────────────────
    {"title": "Sanitation Worker", "employer": "Clean Ward Contractors", "area": "Majestic", "lat": 12.9773, "lon": 77.5713, "pay_min": 11000, "pay_max": 14000, "skills": ["sanitation"], "languages": ["kannada"], "type": "job"},
    {"title": "Farm / Garden Labourer", "employer": "Green Acre Farm Co-op", "area": "Yelahanka", "lat": 13.1007, "lon": 77.5963, "pay_min": 10000, "pay_max": 13000, "skills": ["gardener", "farm_worker"], "languages": ["kannada"], "type": "job"},
    {"title": "Truck Driver (LMV)", "employer": "RoadLine Logistics", "area": "KR Puram", "lat": 13.0090, "lon": 77.6974, "pay_min": 20000, "pay_max": 30000, "skills": ["truck_driver", "driving_licence"], "languages": ["hindi", "kannada"], "type": "job"},
    {"title": "Event Helper", "employer": "Utsava Event Helpers", "area": "Whitefield", "lat": 12.9698, "lon": 77.7499, "pay_min": 10000, "pay_max": 14000, "skills": ["event_helper"], "languages": ["kannada", "hindi"], "type": "job"},
    {"title": "POS Billing Staff", "employer": "Janata Bazaar Store", "area": "BTM Layout", "lat": 12.9165, "lon": 77.6101, "pay_min": 12000, "pay_max": 15000, "skills": ["pos_billing", "basic_english"], "languages": ["kannada", "english"], "type": "job"},
    {"title": "Food Handler (FSSAI Certified)", "employer": "FreshCrate Supplies", "area": "Domlur", "lat": 12.9601, "lon": 77.6394, "pay_min": 14000, "pay_max": 18000, "skills": ["food_handler", "warehouse"], "languages": ["kannada", "english"], "type": "job"},
    {"title": "Swimming Pool Attendant", "employer": "Cubbon Lane Hotel", "area": "Malleshwaram", "lat": 13.0030, "lon": 77.5690, "pay_min": 13000, "pay_max": 17000, "skills": ["swimming_pool"], "languages": ["english", "kannada"], "type": "job"},
]
# fmt: on

POSTED_AT = "2026-01-01T00:00:00+00:00"  # fixed, so every seed and snapshot is identical


def build_seed_rows() -> list[dict[str, Any]]:
    """
    Return the 80 seed jobs in the shape get_all_jobs() returns
    (skills_required and languages as lists). Same output on every call.
    """
    rng = random.Random(42)
    rows = []
    for index, entry in enumerate(_SEED, start=1):
        jlat, jlon = _jitter(rng, entry["lat"], entry["lon"])
        rows.append({
            "id": f"job-{index:03d}",
            "title": entry["title"],
            "employer": entry["employer"],
            "area": entry["area"],
            "lat": jlat,
            "lon": jlon,
            "pay_min": entry["pay_min"],
            "pay_max": entry["pay_max"],
            "skills_required": list(entry["skills"]),
            "languages": list(entry["languages"]),
            "type": entry["type"],
            "posted_at": POSTED_AT,
            "is_synthetic": True,
        })
    return rows


def seed_jobs() -> int:
    """Insert all seed jobs (skip if DB already populated). Returns count inserted."""
    init_db()
    with ENGINE.connect() as conn:
        existing_count = len(conn.execute(jobs_table.select()).fetchall())
        if existing_count > 0:
            return 0  # already seeded

        rows = [
            {**row,
             "skills_required": json.dumps(row["skills_required"]),
             "languages": json.dumps(row["languages"])}
            for row in build_seed_rows()
        ]
        conn.execute(insert(jobs_table), rows)
        conn.commit()
        return len(rows)


if __name__ == "__main__":
    n = seed_jobs()
    print(f"Seeded {n} jobs." if n else "Already seeded.")
