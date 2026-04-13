"""
Initialize the Nandini SQLite database.

Creates all 8 schema tables in data/nandini.db, seeds the products table
from data/products.csv, and generates a fresh 7-day demand forecast from
the trained model.
"""

import csv
import math
import os
import sqlite3
from datetime import date, timedelta

import joblib
import numpy as np

# ── Paths ────────────────────────────────────────────────────────────────────
BASE_DIR = os.path.dirname(os.path.abspath(__file__))
DATA_DIR = os.path.join(BASE_DIR, "data")
MODEL_DIR = os.path.join(BASE_DIR, "models")
DB_PATH = os.path.join(DATA_DIR, "nandini.db")

# ── Product ID encoding (must match train_forecast_model.py) ─────────────────
PRODUCT_IDS = [f"P{str(i).zfill(3)}" for i in range(1, 11)]
PID_TO_INT = {pid: i for i, pid in enumerate(PRODUCT_IDS)}
INT_TO_PID = {i: pid for pid, i in PID_TO_INT.items()}

PRODUCT_NAMES = {
    "P001": "Toned Milk", "P002": "Slim Milk", "P003": "Pure Cow Milk",
    "P004": "Curd", "P005": "Ghee", "P006": "Paneer",
    "P007": "Butter", "P008": "Buttermilk", "P009": "Cheese Slices",
    "P010": "Ice Cream Cup",
}

# From nandini_inventory_and_reorder_logic.md sections 4 & 5
CRATE_SIZES = {
    "P001": 20, "P002": 20, "P003": 20, "P004": 20, "P005": 12,
    "P006": 10, "P007": 20, "P008": 24, "P009": 10, "P010": 24,
}
COVERAGE_WINDOWS = {
    "P001": 1, "P002": 1, "P003": 1, "P004": 2, "P005": 7,
    "P006": 2, "P007": 4, "P008": 1, "P009": 4, "P010": 4,
}

# ── Festival windows (2025 + early 2026) ─────────────────────────────────────
FESTIVALS = [
    ("Makar Sankranti", date(2025, 1, 13), date(2025, 1, 15)),
    ("Ugadi", date(2025, 3, 30), date(2025, 4, 1)),
    ("Ramadan/Eid", date(2025, 3, 29), date(2025, 3, 31)),
    ("Ganesh Chaturthi", date(2025, 8, 27), date(2025, 9, 3)),
    ("Navaratri", date(2025, 10, 2), date(2025, 10, 7)),
    ("Dussehra", date(2025, 10, 2), date(2025, 10, 3)),
    ("Diwali", date(2025, 10, 20), date(2025, 10, 23)),
    ("Christmas/New Year", date(2025, 12, 24), date(2026, 1, 1)),
]


def is_festival(d: date) -> int:
    for _, start, end in FESTIVALS:
        if start <= d <= end:
            return 1
    return 0


# ── Schema DDL ───────────────────────────────────────────────────────────────
SCHEMA_SQL = """
CREATE TABLE IF NOT EXISTS products (
    product_id TEXT PRIMARY KEY,
    product_name TEXT NOT NULL,
    pack_size TEXT NOT NULL,
    selling_price REAL NOT NULL,
    cost_price REAL NOT NULL,
    shelf_life_days INTEGER NOT NULL,
    crate_size INTEGER NOT NULL DEFAULT 0,
    coverage_window_days INTEGER NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS daily_sales (
    sales_id INTEGER PRIMARY KEY AUTOINCREMENT,
    date TEXT NOT NULL,
    product_id TEXT NOT NULL REFERENCES products(product_id),
    units_sold INTEGER NOT NULL,
    selling_price REAL NOT NULL,
    sales_amount REAL NOT NULL
);

CREATE TABLE IF NOT EXISTS inventory_batches (
    batch_id INTEGER PRIMARY KEY AUTOINCREMENT,
    product_id TEXT NOT NULL REFERENCES products(product_id),
    mfd_date TEXT NOT NULL,
    expiry_date TEXT NOT NULL,
    received_date TEXT NOT NULL,
    quantity_received INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS daily_inventory (
    inventory_id INTEGER PRIMARY KEY AUTOINCREMENT,
    date TEXT NOT NULL,
    product_id TEXT NOT NULL REFERENCES products(product_id),
    opening_stock INTEGER NOT NULL,
    stock_received INTEGER NOT NULL,
    units_sold INTEGER NOT NULL,
    closing_stock INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS purchase_orders (
    order_id INTEGER PRIMARY KEY AUTOINCREMENT,
    order_date TEXT NOT NULL,
    product_id TEXT NOT NULL REFERENCES products(product_id),
    quantity_ordered INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS wastage (
    wastage_id INTEGER PRIMARY KEY AUTOINCREMENT,
    date TEXT NOT NULL,
    product_id TEXT NOT NULL REFERENCES products(product_id),
    batch_id INTEGER REFERENCES inventory_batches(batch_id),
    quantity_wasted INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS external_factors (
    date TEXT PRIMARY KEY,
    day_of_week TEXT NOT NULL,
    temperature REAL NOT NULL,
    festival_name TEXT
);

CREATE TABLE IF NOT EXISTS forecast_results (
    forecast_id INTEGER PRIMARY KEY AUTOINCREMENT,
    forecast_date TEXT NOT NULL,
    target_date TEXT NOT NULL,
    product_id TEXT NOT NULL REFERENCES products(product_id),
    predicted_units_sold INTEGER NOT NULL
);
"""


def create_tables(conn):
    """Create all 8 schema tables."""
    conn.executescript(SCHEMA_SQL)
    print("Created 8 tables.")


def seed_products(conn):
    """Load products from CSV into the products table."""
    csv_path = os.path.join(DATA_DIR, "products.csv")
    with open(csv_path) as f:
        reader = csv.DictReader(f)
        rows = list(reader)

    conn.executemany(
        """INSERT OR REPLACE INTO products
           (product_id, product_name, pack_size, selling_price, cost_price,
            shelf_life_days, crate_size, coverage_window_days)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?)""",
        [(r["product_id"], r["product_name"], r["pack_size"],
          float(r["selling_price"]), float(r["cost_price"]),
          int(r["shelf_life_days"]),
          CRATE_SIZES[r["product_id"]],
          COVERAGE_WINDOWS[r["product_id"]]) for r in rows],
    )
    conn.commit()
    print(f"Loaded {len(rows)} products.")


def generate_forecast(conn):
    """Generate a fresh 7-day forecast from the trained model and insert into DB."""
    model_path = os.path.join(MODEL_DIR, "demand_model.joblib")
    model = joblib.load(model_path)

    # Temperature estimate: use late-Dec 2025 average from external_factors.csv
    ef_path = os.path.join(DATA_DIR, "external_factors.csv")
    dec_temps = []
    with open(ef_path) as f:
        for row in csv.DictReader(f):
            if row["date"] >= "2025-12-25":
                dec_temps.append(float(row["temperature"]))
    avg_temp = sum(dec_temps) / len(dec_temps) if dec_temps else 27.0

    today = date.today()
    forecast_date_str = today.isoformat()

    # Clear existing forecasts
    conn.execute("DELETE FROM forecast_results")

    rows = []
    for day_offset in range(1, 8):
        d = today + timedelta(days=day_offset)
        dow = d.weekday()
        is_wknd = 1 if dow >= 5 else 0
        is_fest = is_festival(d)

        for pid_int in range(10):
            features = np.array([[dow, is_wknd, avg_temp, is_fest, pid_int]],
                                dtype=np.float64)
            pred = max(0, model.predict(features)[0])
            units = math.ceil(pred)
            pid = INT_TO_PID[pid_int]
            rows.append((forecast_date_str, d.isoformat(), pid, units))

    conn.executemany(
        """INSERT INTO forecast_results
           (forecast_date, target_date, product_id, predicted_units_sold)
           VALUES (?, ?, ?, ?)""",
        rows,
    )
    conn.commit()

    print(f"\nGenerated 7-day forecast ({len(rows)} rows)")
    print(f"  Forecast date : {forecast_date_str}")
    print(f"  Target window : {(today + timedelta(days=1)).isoformat()} → "
          f"{(today + timedelta(days=7)).isoformat()}")
    print(f"  Temperature   : {avg_temp:.1f}°C (late-Dec 2025 avg)")

    # Print summary table
    print(f"\n  {'Product':<20} ", end="")
    for day_offset in range(1, 8):
        d = today + timedelta(days=day_offset)
        print(f"{d.strftime('%a'):>5}", end="")
    print()
    print(f"  {'-'*55}")

    for pid_int in range(10):
        pid = INT_TO_PID[pid_int]
        vals = [r[3] for r in rows if r[2] == pid]
        vals_str = "".join(f"{v:>5}" for v in vals)
        print(f"  {PRODUCT_NAMES[pid]:<20} {vals_str}")


def main():
    print(f"Database: {DB_PATH}\n")

    conn = sqlite3.connect(DB_PATH)
    conn.execute("PRAGMA foreign_keys = ON")

    create_tables(conn)
    seed_products(conn)
    generate_forecast(conn)

    conn.close()
    print(f"\nDone. Database ready at {DB_PATH}")


if __name__ == "__main__":
    main()
