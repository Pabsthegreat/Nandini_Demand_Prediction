"""
Synthetic daily sales data generator for the Nandini Dairy Forecasting project.

Generates:
  - data/external_factors.csv
  - data/daily_sales.csv

Uses real 2025 Bangalore daily max temperatures from Open-Meteo.
All rules follow the locked spec documents.
"""

import csv
import math
import os
import random
from datetime import date, timedelta

# ── Reproducibility ──────────────────────────────────────────────────────────
SEED = 42
random.seed(SEED)

# ── Output directory ─────────────────────────────────────────────────────────
OUTPUT_DIR = os.path.join(os.path.dirname(os.path.abspath(__file__)), "data")
os.makedirs(OUTPUT_DIR, exist_ok=True)

# ── Training period ──────────────────────────────────────────────────────────
START_DATE = date(2025, 1, 1)
END_DATE = date(2025, 12, 31)

# ── Real 2025 Bangalore daily max temperatures (Open-Meteo, °C) ─────────────
TEMPERATURES = [
    26.5, 26.4, 25.9, 25.8, 26.5, 26.2, 27.3, 27.1, 25.9, 26.9,
    27.7, 28.6, 28.1, 27.5, 25.5, 26.6, 26.7, 27.2, 22.9, 27.2,
    27.8, 28.6, 29.6, 27.6, 29.0, 29.1, 28.2, 28.1, 29.4, 29.3,
    30.5, 30.5, 31.0, 30.3, 30.6, 30.4, 29.7, 30.0, 29.9, 29.6,
    28.9, 30.6, 31.6, 31.9, 32.0, 31.3, 31.9, 31.8, 31.6, 32.8,
    32.7, 32.3, 32.2, 31.9, 30.5, 30.1, 30.6, 30.9, 31.4, 31.4,
    32.2, 33.1, 33.1, 33.2, 33.3, 34.0, 34.2, 33.7, 31.6, 31.2,
    30.7, 34.0, 34.4, 33.7, 33.4, 35.0, 34.8, 33.8, 33.1, 34.0,
    33.2, 29.6, 30.7, 31.1, 33.5, 33.9, 35.2, 34.9, 34.4, 34.3,
    33.3, 32.6, 32.7, 29.0, 31.1, 32.9, 34.8, 34.3, 33.2, 33.2,
    34.0, 33.5, 32.1, 33.7, 33.6, 34.0, 33.2, 33.6, 32.8, 34.3,
    34.2, 34.5, 35.5, 36.2, 35.5, 34.2, 34.2, 33.4, 34.2, 34.7,
    34.5, 33.7, 34.5, 33.7, 35.3, 34.0, 33.5, 32.8, 32.3, 31.5,
    32.0, 31.2, 33.5, 32.4, 33.1, 30.9, 29.4, 29.1, 28.2, 27.4,
    26.5, 28.6, 28.0, 25.5, 26.9, 25.5, 26.2, 26.4, 26.0, 24.1,
    29.5, 29.5, 28.9, 28.8, 29.3, 30.2, 31.5, 30.9, 31.8, 28.8,
    29.8, 27.8, 27.6, 26.1, 27.0, 24.2, 25.9, 26.2, 27.7, 28.7,
    28.7, 28.1, 29.0, 26.9, 27.0, 27.4, 28.0, 27.9, 29.4, 29.3,
    29.4, 28.5, 28.4, 25.2, 28.0, 28.3, 27.3, 28.0, 30.1, 29.0,
    29.5, 28.6, 27.8, 28.2, 26.5, 27.0, 28.0, 27.5, 27.5, 26.1,
    26.5, 26.6, 25.2, 25.5, 25.0, 25.6, 26.1, 25.8, 26.5, 27.1,
    27.9, 27.0, 28.1, 28.5, 28.5, 28.8, 27.1, 27.9, 28.0, 27.2,
    26.5, 26.5, 25.0, 25.5, 23.2, 24.7, 26.0, 26.7, 25.5, 22.6,
    25.1, 27.2, 26.9, 27.0, 27.3, 28.0, 27.1, 28.4, 26.6, 25.8,
    25.4, 27.8, 26.9, 26.6, 27.1, 25.5, 26.0, 26.8, 27.0, 27.7,
    28.0, 28.1, 27.5, 26.2, 27.2, 28.0, 27.8, 28.4, 27.5, 25.6,
    27.2, 24.3, 26.7, 27.0, 27.0, 25.3, 25.4, 27.1, 26.9, 26.5,
    28.0, 28.3, 28.1, 29.2, 28.0, 29.5, 26.3, 28.5, 27.1, 28.7,
    27.8, 27.5, 27.0, 27.0, 27.8, 27.8, 28.0, 26.6, 27.1, 26.3,
    27.3, 27.3, 27.0, 25.4, 24.5, 25.7, 25.1, 26.6, 27.6, 23.9,
    24.0, 26.8, 26.9, 27.2, 28.4, 27.8, 28.0, 27.0, 27.4, 26.5,
    27.5, 27.2, 26.5, 28.8, 27.5, 27.9, 28.0, 27.9, 26.7, 26.3,
    26.5, 24.5, 26.6, 27.8, 27.2, 26.9, 26.5, 26.8, 26.5, 26.5,
    25.2, 24.8, 22.2, 21.4, 23.9, 24.8, 25.0, 25.9, 24.9, 25.5,
    26.5, 27.1, 27.2, 27.4, 26.5, 26.7, 27.2, 26.0, 26.4, 25.0,
    26.9, 27.0, 26.5, 25.2, 25.7, 24.8, 25.6, 25.2, 26.8, 26.4,
    26.0, 26.6, 27.2, 28.6, 28.1,
]

# ── Festival windows (locked spec) ──────────────────────────────────────────
FESTIVALS = [
    ("New Year",           date(2025, 1, 1),   date(2025, 1, 1)),
    ("Pongal/Sankranti",   date(2025, 1, 12),  date(2025, 1, 14)),
    ("Ugadi",              date(2025, 3, 28),   date(2025, 3, 30)),
    ("Raksha Bandhan",     date(2025, 8, 8),    date(2025, 8, 9)),
    ("Ganesh Chaturthi",   date(2025, 8, 25),   date(2025, 8, 27)),
    ("Navratri/Dussehra",  date(2025, 9, 30),   date(2025, 10, 2)),
    ("Deepavali",          date(2025, 10, 18),  date(2025, 10, 20)),
    ("Christmas",          date(2025, 12, 24),  date(2025, 12, 25)),
]

# ── Product master (locked spec) ────────────────────────────────────────────
PRODUCTS = [
    {
        "product_id": "P001", "product_name": "Toned Milk",
        "pack_size": "500 ml", "selling_price": 26, "cost_price": 23.4,
        "shelf_life_days": 2, "base_daily_demand": 90,
        "weekend_multiplier": 1.05, "hot_day_multiplier": 1.00,
        "festival_multiplier": 1.05,
        "random_range": (0.85, 1.15),
    },
    {
        "product_id": "P002", "product_name": "Slim Milk",
        "pack_size": "500 ml", "selling_price": 29, "cost_price": 26.1,
        "shelf_life_days": 2, "base_daily_demand": 20,
        "weekend_multiplier": 1.00, "hot_day_multiplier": 1.00,
        "festival_multiplier": 1.00,
        "random_range": (0.82, 1.18),
    },
    {
        "product_id": "P003", "product_name": "Pure Cow Milk",
        "pack_size": "500 ml", "selling_price": 26, "cost_price": 23.4,
        "shelf_life_days": 2, "base_daily_demand": 70,
        "weekend_multiplier": 1.05, "hot_day_multiplier": 1.00,
        "festival_multiplier": 1.08,
        "random_range": (0.85, 1.15),
    },
    {
        "product_id": "P004", "product_name": "Curd",
        "pack_size": "500 g", "selling_price": 28, "cost_price": 25.2,
        "shelf_life_days": 4, "base_daily_demand": 50,
        "weekend_multiplier": 1.08, "hot_day_multiplier": 1.10,
        "festival_multiplier": 1.10,
        "random_range": (0.78, 1.22),
    },
    {
        "product_id": "P005", "product_name": "Ghee",
        "pack_size": "200 ml", "selling_price": 135, "cost_price": 121.5,
        "shelf_life_days": 270, "base_daily_demand": 4,
        "weekend_multiplier": 1.00, "hot_day_multiplier": 1.00,
        "festival_multiplier": 1.40,
        "random_range": (0.78, 1.22),
    },
    {
        "product_id": "P006", "product_name": "Paneer",
        "pack_size": "200 g", "selling_price": 96, "cost_price": 86.4,
        "shelf_life_days": 7, "base_daily_demand": 15,
        "weekend_multiplier": 1.20, "hot_day_multiplier": 1.00,
        "festival_multiplier": 1.35,
        "random_range": (0.78, 1.22),
    },
    {
        "product_id": "P007", "product_name": "Butter",
        "pack_size": "100 g", "selling_price": 44, "cost_price": 39.6,
        "shelf_life_days": 180, "base_daily_demand": 12,
        "weekend_multiplier": 1.08, "hot_day_multiplier": 1.00,
        "festival_multiplier": 1.10,
        "random_range": (0.82, 1.18),
    },
    {
        "product_id": "P008", "product_name": "Buttermilk",
        "pack_size": "200 ml", "selling_price": 10, "cost_price": 9.0,
        "shelf_life_days": 3, "base_daily_demand": 30,
        "weekend_multiplier": 1.05, "hot_day_multiplier": 1.20,
        "festival_multiplier": 1.00,
        "random_range": (0.78, 1.22),
    },
    {
        "product_id": "P009", "product_name": "Cheese Slices",
        "pack_size": "200 g", "selling_price": 136, "cost_price": 122.4,
        "shelf_life_days": 90, "base_daily_demand": 6,
        "weekend_multiplier": 1.05, "hot_day_multiplier": 1.00,
        "festival_multiplier": 1.00,
        "random_range": (0.78, 1.22),
    },
    {
        "product_id": "P010", "product_name": "Ice Cream Cup",
        "pack_size": "100 ml", "selling_price": 20, "cost_price": 18.0,
        "shelf_life_days": 180, "base_daily_demand": 8,
        "weekend_multiplier": 1.15, "hot_day_multiplier": 1.35,
        "festival_multiplier": 1.00,
        "random_range": (0.70, 1.30),
    },
]

DAY_NAMES = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"]


def get_festival(d: date) -> str:
    """Return the festival name for a date, or 'None'."""
    for name, start, end in FESTIVALS:
        if start <= d <= end:
            return name
    return "None"


def generate():
    num_days = (END_DATE - START_DATE).days + 1
    assert len(TEMPERATURES) == num_days, (
        f"Temperature array length {len(TEMPERATURES)} != expected {num_days} days"
    )

    # ── Build external_factors rows ──────────────────────────────────────
    external_rows = []
    for i in range(num_days):
        d = START_DATE + timedelta(days=i)
        temp = TEMPERATURES[i]
        external_rows.append({
            "date": d.isoformat(),
            "day_of_week": DAY_NAMES[d.weekday()],
            "temperature": temp,
            "hot_day": 1 if temp >= 30.0 else 0,
            "festival_name": get_festival(d),
        })

    # Write external_factors.csv
    ef_path = os.path.join(OUTPUT_DIR, "external_factors.csv")
    with open(ef_path, "w", newline="") as f:
        writer = csv.DictWriter(f, fieldnames=[
            "date", "day_of_week", "temperature", "hot_day", "festival_name",
        ])
        writer.writeheader()
        writer.writerows(external_rows)
    print(f"Wrote {len(external_rows)} rows -> {ef_path}")

    # ── Build daily_sales rows ───────────────────────────────────────────
    sales_rows = []
    sales_id = 1

    for ef in external_rows:
        d = ef["date"]
        is_weekend = ef["day_of_week"] in ("Saturday", "Sunday")
        is_hot = ef["hot_day"] == 1
        is_festival = ef["festival_name"] != "None"

        for p in PRODUCTS:
            demand = p["base_daily_demand"]

            if is_weekend:
                demand *= p["weekend_multiplier"]
            if is_hot:
                demand *= p["hot_day_multiplier"]
            if is_festival:
                demand *= p["festival_multiplier"]

            lo, hi = p["random_range"]
            demand *= random.uniform(lo, hi)

            units_sold = math.ceil(demand)
            selling_price = p["selling_price"]

            sales_rows.append({
                "sales_id": sales_id,
                "date": d,
                "product_id": p["product_id"],
                "units_sold": units_sold,
                "selling_price": selling_price,
                "sales_amount": units_sold * selling_price,
            })
            sales_id += 1

    # Write daily_sales.csv
    ds_path = os.path.join(OUTPUT_DIR, "daily_sales.csv")
    with open(ds_path, "w", newline="") as f:
        writer = csv.DictWriter(f, fieldnames=[
            "sales_id", "date", "product_id", "units_sold",
            "selling_price", "sales_amount",
        ])
        writer.writeheader()
        writer.writerows(sales_rows)
    print(f"Wrote {len(sales_rows)} rows -> {ds_path}")

    # ── Also write products.csv for reference ────────────────────────────
    prod_path = os.path.join(OUTPUT_DIR, "products.csv")
    with open(prod_path, "w", newline="") as f:
        writer = csv.DictWriter(f, fieldnames=[
            "product_id", "product_name", "pack_size",
            "selling_price", "cost_price", "shelf_life_days",
        ])
        writer.writeheader()
        for p in PRODUCTS:
            writer.writerow({
                "product_id": p["product_id"],
                "product_name": p["product_name"],
                "pack_size": p["pack_size"],
                "selling_price": p["selling_price"],
                "cost_price": p["cost_price"],
                "shelf_life_days": p["shelf_life_days"],
            })
    print(f"Wrote {len(PRODUCTS)} rows -> {prod_path}")


if __name__ == "__main__":
    generate()
