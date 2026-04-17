"""
Initialize the Nandini SQLite database.

Creates all 8 schema tables in data/nandini.db, seeds the historical source
tables, fetches runtime weather into external_factors from a live API,
generates a fresh 7-day demand forecast from the trained model, and stores
the results in SQLite.
"""

import csv
import math
import os
import sqlite3
from datetime import date, timedelta

import joblib
import numpy as np
from weather_api import WeatherApiError, fetch_forecast_weather

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
    hot_day INTEGER NOT NULL DEFAULT 0,
    festival_name TEXT,
    source TEXT NOT NULL DEFAULT 'api'
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
    ensure_external_factors_schema(conn)
    print("Created 8 tables.")


def ensure_external_factors_schema(conn):
    """Upgrade external_factors columns in-place for older SQLite files."""
    existing_columns = {
        row[1]
        for row in conn.execute("PRAGMA table_info(external_factors)")
    }
    required_columns = {
        "hot_day": "INTEGER NOT NULL DEFAULT 0",
        "source": "TEXT NOT NULL DEFAULT 'api'",
    }

    for column_name, ddl in required_columns.items():
        if column_name not in existing_columns:
            conn.execute(f"ALTER TABLE external_factors ADD COLUMN {column_name} {ddl}")
    conn.commit()


def festival_name_for_day(d: date) -> str:
    for festival_name, start, end in FESTIVALS:
        if start <= d <= end:
            return festival_name
    return "None"


def seed_external_factors(conn):
    """Load runtime weather window only: today plus next 7 days."""
    runtime_start = date.today()
    runtime_rows = fetch_forecast_weather(runtime_start, days=8)

    rows = runtime_rows
    if not rows:
        raise WeatherApiError("Weather API returned no daily rows.")

    conn.execute("DELETE FROM external_factors")
    conn.executemany(
        """INSERT INTO external_factors
           (date, day_of_week, temperature, hot_day, festival_name, source)
           VALUES (?, ?, ?, ?, ?, ?)""",
        [
            (
                row["date"],
                row["day_of_week"],
                float(row["temperature"]),
                int(row["hot_day"]),
                festival_name_for_day(date.fromisoformat(row["date"])),
                "api",
            )
            for row in rows
        ],
    )
    conn.commit()
    print(
        f"Loaded {len(rows)} runtime external factor rows "
        f"({runtime_start.isoformat()} → {(runtime_start + timedelta(days=7)).isoformat()}) from live API."
    )


def seed_daily_sales(conn):
    """Load historical sales from CSV into SQLite."""
    csv_path = os.path.join(DATA_DIR, "daily_sales.csv")
    with open(csv_path) as f:
        rows = list(csv.DictReader(f))

    conn.execute("DELETE FROM daily_sales")
    conn.executemany(
        """INSERT INTO daily_sales
           (sales_id, date, product_id, units_sold, selling_price, sales_amount)
           VALUES (?, ?, ?, ?, ?, ?)""",
        [
            (
                int(row["sales_id"]),
                row["date"],
                row["product_id"],
                int(row["units_sold"]),
                float(row["selling_price"]),
                float(row["sales_amount"]),
            )
            for row in rows
        ],
    )
    conn.commit()
    print(f"Loaded {len(rows)} daily sales rows.")


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


def load_forecast_weather_lookup(conn):
    """Map forecast target date to live weather row stored in the database."""
    today_iso = date.today().isoformat()
    cur = conn.execute(
        """SELECT date, temperature, festival_name
           FROM external_factors
           WHERE date > ?
           ORDER BY date""",
        (today_iso,),
    )
    return {
        row[0]: {
            "temperature": float(row[1]),
            "festival_name": row[2] or "None",
        }
        for row in cur
    }


def export_query_to_csv(conn, query, out_path, fieldnames):
    """Export a query result to CSV with the given fieldnames."""
    cur = conn.execute(query)
    with open(out_path, "w", newline="") as f:
        writer = csv.writer(f)
        writer.writerow(fieldnames)
        writer.writerows(cur.fetchall())


def generate_forecast(conn):
    """Generate a fresh 7-day forecast from the trained model and insert into DB."""
    model_path = os.path.join(MODEL_DIR, "demand_model.joblib")
    model = joblib.load(model_path)
    weather_by_date = load_forecast_weather_lookup(conn)

    today = date.today()
    forecast_date_str = today.isoformat()

    # Clear existing forecasts
    conn.execute("DELETE FROM forecast_results")

    rows = []
    for day_offset in range(1, 8):
        d = today + timedelta(days=day_offset)
        dow = d.weekday()
        is_wknd = 1 if dow >= 5 else 0
        weather = weather_by_date.get(d.isoformat())
        if weather is None:
            raise RuntimeError(
                f"Missing live weather in external_factors for forecast date {d.isoformat()}."
            )
        is_fest = 0 if weather["festival_name"] == "None" else 1
        temp = weather["temperature"]

        for pid_int in range(10):
            features = np.array([[dow, is_wknd, temp, is_fest, pid_int]],
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

    export_query_to_csv(
        conn,
        """SELECT forecast_id, forecast_date, target_date, product_id, predicted_units_sold
           FROM forecast_results
           ORDER BY target_date, product_id""",
        os.path.join(DATA_DIR, "forecast_results.csv"),
        ["forecast_id", "forecast_date", "target_date", "product_id", "predicted_units_sold"],
    )

    print(f"\nGenerated 7-day forecast ({len(rows)} rows)")
    print(f"  Forecast date : {forecast_date_str}")
    print(f"  Target window : {(today + timedelta(days=1)).isoformat()} → "
          f"{(today + timedelta(days=7)).isoformat()}")
    print("  Temperature   : live API forecast stored in external_factors")

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
    seed_external_factors(conn)
    seed_daily_sales(conn)
    generate_forecast(conn)

    conn.close()
    print(f"\nDone. Database ready at {DB_PATH}")


if __name__ == "__main__":
    main()
