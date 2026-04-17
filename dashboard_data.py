"""
Helpers for loading dashboard data directly from SQLite.
"""

from __future__ import annotations

import os
import sqlite3

BASE_DIR = os.path.dirname(os.path.abspath(__file__))
DB_PATH = os.path.join(BASE_DIR, "data", "nandini.db")


def load_dashboard_data(db_path: str = DB_PATH) -> dict:
    """Return the dashboard payload read directly from SQLite."""
    conn = sqlite3.connect(db_path)
    try:
        return {
            "products": [
                {
                    "product_id": row[0],
                    "product_name": row[1],
                    "pack_size": row[2],
                    "selling_price": row[3],
                    "cost_price": row[4],
                    "shelf_life_days": row[5],
                    "crate_size": row[6],
                    "coverage_window_days": row[7],
                }
                for row in conn.execute(
                    """SELECT product_id, product_name, pack_size, selling_price, cost_price,
                              shelf_life_days, crate_size, coverage_window_days
                       FROM products
                       ORDER BY product_id"""
                )
            ],
            "forecast": [
                {
                    "forecast_id": row[0],
                    "forecast_date": row[1],
                    "target_date": row[2],
                    "product_id": row[3],
                    "predicted_units_sold": row[4],
                }
                for row in conn.execute(
                    """SELECT forecast_id, forecast_date, target_date, product_id, predicted_units_sold
                       FROM forecast_results
                       ORDER BY target_date, product_id"""
                )
            ],
            "dailyInventory": [
                {
                    "date": row[0],
                    "product_id": row[1],
                    "opening_stock": row[2],
                    "stock_received": row[3],
                    "units_sold": row[4],
                    "closing_stock": row[5],
                }
                for row in conn.execute(
                    """SELECT date, product_id, opening_stock, stock_received, units_sold, closing_stock
                       FROM daily_inventory
                       ORDER BY date, product_id"""
                )
            ],
            "purchaseOrders": [
                {
                    "order_date": row[0],
                    "product_id": row[1],
                    "quantity_ordered": row[2],
                }
                for row in conn.execute(
                    """SELECT order_date, product_id, quantity_ordered
                       FROM purchase_orders
                       ORDER BY order_date, product_id"""
                )
            ],
            "wastage": [
                {
                    "date": row[0],
                    "product_id": row[1],
                    "batch_id": row[2],
                    "quantity_wasted": row[3],
                }
                for row in conn.execute(
                    """SELECT date, product_id, batch_id, quantity_wasted
                       FROM wastage
                       ORDER BY date, product_id, batch_id"""
                )
            ],
        }
    finally:
        conn.close()
