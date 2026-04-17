"""
Inventory & reorder simulation for the Nandini Dairy project.

Reads the 7-day forecast from data/nandini.db, simulates day-by-day inventory
with FIFO batch consumption, expiry-driven wastage, and crate-based reordering.
Populates: inventory_batches, daily_inventory, purchase_orders, wastage.
Exports DB-derived dashboard snapshots after the simulation completes.
"""

import csv
import math
import os
import sqlite3
from datetime import date, timedelta

from dashboard_data import load_dashboard_data

# ── Paths ────────────────────────────────────────────────────────────────────
BASE_DIR = os.path.dirname(os.path.abspath(__file__))
DB_PATH = os.path.join(BASE_DIR, "data", "nandini.db")
DATA_DIR = os.path.join(BASE_DIR, "data")

PRODUCT_NAMES = {
    "P001": "Toned Milk", "P002": "Slim Milk", "P003": "Pure Cow Milk",
    "P004": "Curd", "P005": "Ghee", "P006": "Paneer",
    "P007": "Butter", "P008": "Buttermilk", "P009": "Cheese Slices",
    "P010": "Ice Cream Cup",
}


def load_products(conn):
    """Load product master from DB."""
    cur = conn.execute(
        "SELECT product_id, shelf_life_days, crate_size, coverage_window_days "
        "FROM products ORDER BY product_id"
    )
    products = {}
    for row in cur:
        products[row[0]] = {
            "shelf_life": row[1],
            "crate_size": row[2],
            "coverage_window": row[3],
        }
    return products


def load_forecasts(conn):
    """Load forecast into dict: {(target_date, product_id): predicted_units}."""
    cur = conn.execute(
        "SELECT target_date, product_id, predicted_units_sold FROM forecast_results"
    )
    forecasts = {}
    for row in cur:
        forecasts[(row[0], row[1])] = row[2]
    return forecasts


def get_forecast_dates(conn):
    """Return sorted list of target dates from forecast."""
    cur = conn.execute(
        "SELECT DISTINCT target_date FROM forecast_results ORDER BY target_date"
    )
    return [date.fromisoformat(row[0]) for row in cur]


def get_forecast_demand(forecasts, product_id, d):
    """Get forecast demand for a product on a date. Returns 0 if not available."""
    return forecasts.get((d.isoformat(), product_id), 0)


def clear_simulation_tables(conn):
    """Clear all simulation output tables for a fresh run."""
    conn.execute("DELETE FROM daily_inventory")
    conn.execute("DELETE FROM inventory_batches")
    conn.execute("DELETE FROM purchase_orders")
    conn.execute("DELETE FROM wastage")
    conn.commit()


def insert_batch(conn, product_id, mfd_date, expiry_date, received_date, qty):
    """Insert a batch and return its batch_id."""
    cur = conn.execute(
        "INSERT INTO inventory_batches "
        "(product_id, mfd_date, expiry_date, received_date, quantity_received) "
        "VALUES (?, ?, ?, ?, ?)",
        (product_id, mfd_date.isoformat(), expiry_date.isoformat(),
         received_date.isoformat(), qty),
    )
    return cur.lastrowid


def export_query_to_csv(conn, query, out_path, fieldnames):
    """Export a query result to CSV with the given fieldnames."""
    cur = conn.execute(query)
    with open(out_path, "w", newline="") as f:
        writer = csv.writer(f)
        writer.writerow(fieldnames)
        writer.writerows(cur.fetchall())


def export_simulation_outputs(conn):
    """Export simulation tables to CSV for the static frontend."""
    export_query_to_csv(
        conn,
        """SELECT date, product_id, opening_stock, stock_received, units_sold, closing_stock
           FROM daily_inventory
           ORDER BY date, product_id""",
        os.path.join(DATA_DIR, "daily_inventory.csv"),
        ["date", "product_id", "opening_stock", "stock_received", "units_sold", "closing_stock"],
    )
    export_query_to_csv(
        conn,
        """SELECT order_date, product_id, quantity_ordered
           FROM purchase_orders
           ORDER BY order_date, product_id""",
        os.path.join(DATA_DIR, "purchase_orders.csv"),
        ["order_date", "product_id", "quantity_ordered"],
    )
    export_query_to_csv(
        conn,
        """SELECT date, product_id, batch_id, quantity_wasted
           FROM wastage
           ORDER BY date, product_id, batch_id""",
        os.path.join(DATA_DIR, "wastage.csv"),
        ["date", "product_id", "batch_id", "quantity_wasted"],
    )
    export_query_to_csv(
        conn,
        """SELECT batch_id, product_id, mfd_date, expiry_date, received_date, quantity_received
           FROM inventory_batches
           ORDER BY received_date, product_id, batch_id""",
        os.path.join(DATA_DIR, "inventory_batches.csv"),
        ["batch_id", "product_id", "mfd_date", "expiry_date", "received_date", "quantity_received"],
    )


def export_dashboard_snapshot(conn):
    """Export a single JSON snapshot derived from SQLite for the frontend."""
    import json

    snapshot = load_dashboard_data(DB_PATH)

    out_path = os.path.join(DATA_DIR, "dashboard_snapshot.json")
    with open(out_path, "w") as f:
        json.dump(snapshot, f, indent=2)
    print(f"Exported dashboard snapshot -> {out_path}")


def run_simulation():
    conn = sqlite3.connect(DB_PATH)
    conn.execute("PRAGMA foreign_keys = ON")

    products = load_products(conn)
    forecasts = load_forecasts(conn)
    sim_days = get_forecast_dates(conn)

    if not sim_days:
        print("No forecast data found. Run init_db.py first.")
        conn.close()
        return

    print(f"Simulation: {sim_days[0].isoformat()} → {sim_days[-1].isoformat()} "
          f"({len(sim_days)} days, {len(products)} products)\n")

    clear_simulation_tables(conn)

    # Last forecast date (for filling gaps beyond horizon)
    last_day = sim_days[-1]

    # Per-product simulation state
    # batches: list of {batch_id, expiry_date, qty_remaining} sorted by expiry (FIFO)
    # pending_orders: {arrival_date_iso: qty}
    state = {}
    for pid in products:
        state[pid] = {"batches": [], "pending_orders": {}}

    # ── Seed day-1 stock ─────────────────────────────────────────────────
    day1 = sim_days[0]
    for pid, pinfo in products.items():
        demand = get_forecast_demand(forecasts, pid, day1)
        if demand <= 0:
            continue
        num_crates = math.ceil(demand / pinfo["crate_size"])
        seed_qty = num_crates * pinfo["crate_size"]
        expiry = day1 + timedelta(days=pinfo["shelf_life"])
        batch_id = insert_batch(conn, pid, day1, expiry, day1, seed_qty)
        state[pid]["batches"].append({
            "batch_id": batch_id,
            "expiry_date": expiry,
            "qty_remaining": seed_qty,
        })
    conn.commit()

    # ── Day-by-day simulation ────────────────────────────────────────────
    for day in sim_days:
        day_iso = day.isoformat()

        for pid, pinfo in products.items():
            st = state[pid]
            shelf_life = pinfo["shelf_life"]
            crate_size = pinfo["crate_size"]
            cov_window = pinfo["coverage_window"]

            # Step 2: Receive pending orders
            stock_received = 0
            if day_iso in st["pending_orders"]:
                recv_qty = st["pending_orders"].pop(day_iso)
                expiry = day + timedelta(days=shelf_life)
                batch_id = insert_batch(conn, pid, day, expiry, day, recv_qty)
                st["batches"].append({
                    "batch_id": batch_id,
                    "expiry_date": expiry,
                    "qty_remaining": recv_qty,
                })
                stock_received = recv_qty

            # Step 3: Expire batches (wastage)
            live_batches = []
            for b in st["batches"]:
                if b["expiry_date"] <= day:
                    if b["qty_remaining"] > 0:
                        conn.execute(
                            "INSERT INTO wastage (date, product_id, batch_id, quantity_wasted) "
                            "VALUES (?, ?, ?, ?)",
                            (day_iso, pid, b["batch_id"], b["qty_remaining"]),
                        )
                else:
                    live_batches.append(b)
            st["batches"] = live_batches

            # Sort by expiry for FIFO
            st["batches"].sort(key=lambda b: b["expiry_date"])

            # Opening stock (after receives and wastage, before sales)
            opening_stock = sum(b["qty_remaining"] for b in st["batches"])

            # Step 4: Process sales (FIFO)
            demand = get_forecast_demand(forecasts, pid, day)
            actual_sold = min(demand, opening_stock)
            remaining_to_sell = actual_sold

            for b in st["batches"]:
                if remaining_to_sell <= 0:
                    break
                sell_from_batch = min(b["qty_remaining"], remaining_to_sell)
                b["qty_remaining"] -= sell_from_batch
                remaining_to_sell -= sell_from_batch

            # Remove fully depleted batches
            st["batches"] = [b for b in st["batches"] if b["qty_remaining"] > 0]

            closing_stock = opening_stock - actual_sold

            # Step 5: Write daily_inventory
            conn.execute(
                "INSERT INTO daily_inventory "
                "(date, product_id, opening_stock, stock_received, units_sold, closing_stock) "
                "VALUES (?, ?, ?, ?, ?, ?)",
                (day_iso, pid, opening_stock, stock_received, actual_sold, closing_stock),
            )

            # Step 6: Compute reorder (end of day)
            # 6a: Usable stock (FIFO-aware)
            usable_stock = 0
            cumulative_demand_consumed = 0
            for b in st["batches"]:
                # Demand from tomorrow until this batch expires
                demand_until_expiry = 0
                d_check = day + timedelta(days=1)
                while d_check < b["expiry_date"]:
                    fc = get_forecast_demand(forecasts, pid, d_check)
                    if fc == 0 and d_check > last_day:
                        # Beyond forecast horizon: use last day's forecast
                        fc = get_forecast_demand(forecasts, pid, last_day)
                    demand_until_expiry += fc
                    d_check += timedelta(days=1)

                # Subtract demand already accounted for by older batches
                remaining_demand = max(0, demand_until_expiry - cumulative_demand_consumed)
                usable = min(b["qty_remaining"], remaining_demand)
                usable_stock += usable
                cumulative_demand_consumed += usable

            # 6b: Incoming stock (orders arriving tomorrow)
            tomorrow_iso = (day + timedelta(days=1)).isoformat()
            incoming_stock = st["pending_orders"].get(tomorrow_iso, 0)

            # 6c: Forecast demand over coverage window
            coverage_demand = 0
            for offset in range(1, cov_window + 1):
                fc_day = day + timedelta(days=offset)
                fc = get_forecast_demand(forecasts, pid, fc_day)
                if fc == 0 and fc_day > last_day:
                    fc = get_forecast_demand(forecasts, pid, last_day)
                coverage_demand += fc

            # 6d: Required quantity
            required_qty = max(0, coverage_demand - usable_stock - incoming_stock)

            order_qty = 0
            if required_qty > 0:
                num_crates = math.ceil(required_qty / crate_size)
                order_qty = num_crates * crate_size

                conn.execute(
                    "INSERT INTO purchase_orders (order_date, product_id, quantity_ordered) "
                    "VALUES (?, ?, ?)",
                    (day_iso, pid, order_qty),
                )
                arrival = (day + timedelta(days=1)).isoformat()
                st["pending_orders"][arrival] = (
                    st["pending_orders"].get(arrival, 0) + order_qty
                )

        conn.commit()

        # ── Print daily summary ──────────────────────────────────────────
        print(f"── {day_iso} ({day.strftime('%A')}) ──")
        print(f"  {'Product':<20} {'Open':>5} {'Recv':>5} {'Dmnd':>5} "
              f"{'Sold':>5} {'Waste':>5} {'Close':>5} {'Order':>5}")
        print(f"  {'-'*65}")

        cur = conn.execute(
            "SELECT product_id, opening_stock, stock_received, units_sold, closing_stock "
            "FROM daily_inventory WHERE date = ? ORDER BY product_id",
            (day_iso,),
        )
        inv_rows = {r[0]: r for r in cur}

        cur = conn.execute(
            "SELECT product_id, SUM(quantity_wasted) FROM wastage "
            "WHERE date = ? GROUP BY product_id",
            (day_iso,),
        )
        waste_map = {r[0]: r[1] for r in cur}

        cur = conn.execute(
            "SELECT product_id, SUM(quantity_ordered) FROM purchase_orders "
            "WHERE order_date = ? GROUP BY product_id",
            (day_iso,),
        )
        order_map = {r[0]: r[1] for r in cur}

        for pid in sorted(products.keys()):
            inv = inv_rows.get(pid)
            if not inv:
                continue
            demand = get_forecast_demand(forecasts, pid, day)
            wasted = waste_map.get(pid, 0)
            ordered = order_map.get(pid, 0)
            print(f"  {PRODUCT_NAMES[pid]:<20} {inv[1]:>5} {inv[2]:>5} {demand:>5} "
                  f"{inv[3]:>5} {wasted:>5} {inv[4]:>5} {ordered:>5}")
        print()

    export_simulation_outputs(conn)
    export_dashboard_snapshot(conn)
    conn.close()
    print("Simulation complete.")


if __name__ == "__main__":
    run_simulation()
