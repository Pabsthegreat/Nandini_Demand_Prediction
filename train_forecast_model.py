"""
Demand forecasting model for the Nandini Dairy project.

Trains GradientBoostingRegressor and RandomForestRegressor on daily_sales +
external_factors, evaluates on held-out December 2025, then generates a
7-day forecast (Jan 1–7, 2026) written to data/forecast_results.csv.
"""

import csv
import math
import os
from datetime import date, timedelta

import joblib
import numpy as np
from sklearn.ensemble import GradientBoostingRegressor, RandomForestRegressor
from sklearn.metrics import mean_absolute_error, mean_squared_error

# ── Paths ────────────────────────────────────────────────────────────────────
BASE_DIR = os.path.dirname(os.path.abspath(__file__))
DATA_DIR = os.path.join(BASE_DIR, "data")
MODEL_DIR = os.path.join(BASE_DIR, "models")
os.makedirs(MODEL_DIR, exist_ok=True)

# ── Product ID encoding ──────────────────────────────────────────────────────
PRODUCT_IDS = [f"P{str(i).zfill(3)}" for i in range(1, 11)]
PID_TO_INT = {pid: i for i, pid in enumerate(PRODUCT_IDS)}
INT_TO_PID = {i: pid for pid, i in PID_TO_INT.items()}

PRODUCT_NAMES = {
    "P001": "Toned Milk", "P002": "Slim Milk", "P003": "Pure Cow Milk",
    "P004": "Curd", "P005": "Ghee", "P006": "Paneer",
    "P007": "Butter", "P008": "Buttermilk", "P009": "Cheese Slices",
    "P010": "Ice Cream Cup",
}

# ── Festival windows (for forecast period) ───────────────────────────────────
FESTIVALS = [
    ("New Year", date(2026, 1, 1), date(2026, 1, 1)),
]


def is_festival(d: date) -> int:
    for _, start, end in FESTIVALS:
        if start <= d <= end:
            return 1
    return 0


# ── Load data ────────────────────────────────────────────────────────────────
def load_data():
    # Load external factors
    ef = {}
    with open(os.path.join(DATA_DIR, "external_factors.csv")) as f:
        for row in csv.DictReader(f):
            ef[row["date"]] = {
                "temperature": float(row["temperature"]),
                "day_of_week": row["day_of_week"],
                "festival_name": row["festival_name"],
            }

    # Load daily sales
    sales = []
    with open(os.path.join(DATA_DIR, "daily_sales.csv")) as f:
        for row in csv.DictReader(f):
            sales.append(row)

    return ef, sales


DAY_NAME_TO_INT = {
    "Monday": 0, "Tuesday": 1, "Wednesday": 2, "Thursday": 3,
    "Friday": 4, "Saturday": 5, "Sunday": 6,
}


def build_features(sales, ef):
    """Build feature matrix X and target vector y from sales + external factors."""
    X, y = [], []

    for row in sales:
        d = row["date"]
        ext = ef[d]
        dow = DAY_NAME_TO_INT[ext["day_of_week"]]

        features = [
            dow,                                              # day_of_week (0-6)
            1 if dow >= 5 else 0,                             # is_weekend
            ext["temperature"],                               # temperature
            0 if ext["festival_name"] == "None" else 1,       # is_festival
            PID_TO_INT[row["product_id"]],                    # product_id encoded
        ]
        X.append(features)
        y.append(int(row["units_sold"]))

    return np.array(X, dtype=np.float64), np.array(y, dtype=np.float64)


FEATURE_NAMES = ["day_of_week", "is_weekend", "temperature", "is_festival", "product_id"]


# ── Train/test split ─────────────────────────────────────────────────────────
def split_train_test(X, y, sales):
    """Split: Jan–Nov 2025 = train, Dec 2025 = test."""
    train_mask = []
    test_mask = []
    for i, row in enumerate(sales):
        if row["date"] < "2025-12-01":
            train_mask.append(i)
        else:
            test_mask.append(i)

    train_mask = np.array(train_mask)
    test_mask = np.array(test_mask)

    return X[train_mask], X[test_mask], y[train_mask], y[test_mask], test_mask


# ── Evaluation ───────────────────────────────────────────────────────────────
def evaluate(model, X_test, y_test, sales, test_indices, label="Model"):
    preds = model.predict(X_test)
    preds = np.maximum(preds, 0)  # demand can't be negative

    mae = mean_absolute_error(y_test, preds)
    rmse = math.sqrt(mean_squared_error(y_test, preds))
    # MAPE — avoid division by zero
    nonzero = y_test > 0
    mape = np.mean(np.abs((y_test[nonzero] - preds[nonzero]) / y_test[nonzero])) * 100

    print(f"\n{'='*60}")
    print(f"  {label} — Overall Test Metrics (Dec 2025)")
    print(f"{'='*60}")
    print(f"  MAE:  {mae:.2f} units")
    print(f"  RMSE: {rmse:.2f} units")
    print(f"  MAPE: {mape:.1f}%")

    # Per-product breakdown
    print(f"\n  {'Product':<20} {'MAE':>6} {'RMSE':>7} {'MAPE%':>7}")
    print(f"  {'-'*42}")

    product_maes = {}
    for pid_int in range(10):
        mask = X_test[:, 4] == pid_int
        if mask.sum() == 0:
            continue
        p_y = y_test[mask]
        p_pred = preds[mask]
        p_mae = mean_absolute_error(p_y, p_pred)
        p_rmse = math.sqrt(mean_squared_error(p_y, p_pred))
        p_nonzero = p_y > 0
        p_mape = np.mean(np.abs((p_y[p_nonzero] - p_pred[p_nonzero]) / p_y[p_nonzero])) * 100
        pid = INT_TO_PID[pid_int]
        print(f"  {PRODUCT_NAMES[pid]:<20} {p_mae:>6.2f} {p_rmse:>7.2f} {p_mape:>6.1f}%")
        product_maes[pid] = p_mae

    return mae, rmse, mape


# ── Forecast next 7 days ────────────────────────────────────────────────────
def forecast_7days(model, ef):
    """Generate predictions for Jan 1–7, 2026."""
    # Estimate early-Jan temperature from late-Dec 2025 average
    dec_temps = [v["temperature"] for k, v in ef.items() if k >= "2025-12-25"]
    avg_temp = sum(dec_temps) / len(dec_temps) if dec_temps else 27.0

    forecast_date_str = date(2025, 12, 31).isoformat()  # "forecast made on"
    rows = []
    forecast_id = 1

    for day_offset in range(1, 8):
        d = date(2025, 12, 31) + timedelta(days=day_offset)
        dow = d.weekday()
        is_wknd = 1 if dow >= 5 else 0
        is_fest = is_festival(d)

        for pid_int in range(10):
            features = np.array([[dow, is_wknd, avg_temp, is_fest, pid_int]], dtype=np.float64)
            pred = max(0, model.predict(features)[0])
            units = math.ceil(pred)
            pid = INT_TO_PID[pid_int]

            rows.append({
                "forecast_id": forecast_id,
                "forecast_date": forecast_date_str,
                "target_date": d.isoformat(),
                "product_id": pid,
                "predicted_units_sold": units,
            })
            forecast_id += 1

    # Write CSV
    out_path = os.path.join(DATA_DIR, "forecast_results.csv")
    with open(out_path, "w", newline="") as f:
        writer = csv.DictWriter(f, fieldnames=[
            "forecast_id", "forecast_date", "target_date",
            "product_id", "predicted_units_sold",
        ])
        writer.writeheader()
        writer.writerows(rows)

    print(f"\nWrote {len(rows)} forecast rows -> {out_path}")

    # Print summary
    print(f"\n{'='*60}")
    print(f"  7-Day Forecast (Jan 1–7, 2026)")
    print(f"  Temperature assumption: {avg_temp:.1f}°C (late-Dec avg)")
    print(f"{'='*60}")
    print(f"  {'Product':<20} {'Day1':>5} {'Day2':>5} {'Day3':>5} {'Day4':>5} {'Day5':>5} {'Day6':>5} {'Day7':>5}")
    print(f"  {'-'*57}")

    for pid_int in range(10):
        pid = INT_TO_PID[pid_int]
        vals = [r["predicted_units_sold"] for r in rows if r["product_id"] == pid]
        vals_str = "".join(f"{v:>5}" for v in vals)
        print(f"  {PRODUCT_NAMES[pid]:<20}{vals_str}")

    return rows


# ── Main ─────────────────────────────────────────────────────────────────────
def main():
    print("Loading data...")
    ef, sales = load_data()

    print("Building features...")
    X, y = build_features(sales, ef)
    print(f"  Total samples: {len(y)}")
    print(f"  Features: {FEATURE_NAMES}")

    print("Splitting train (Jan–Nov) / test (Dec)...")
    X_train, X_test, y_train, y_test, test_idx = split_train_test(X, y, sales)
    print(f"  Train: {len(y_train)}  |  Test: {len(y_test)}")

    # ── Train Gradient Boosting ──────────────────────────────────────────
    print("\nTraining GradientBoostingRegressor...")
    gb = GradientBoostingRegressor(
        n_estimators=200,
        max_depth=5,
        learning_rate=0.1,
        subsample=0.8,
        random_state=42,
    )
    gb.fit(X_train, y_train)
    gb_mae, gb_rmse, gb_mape = evaluate(gb, X_test, y_test, sales, test_idx,
                                         label="Gradient Boosting")

    # ── Train Random Forest ──────────────────────────────────────────────
    print("\nTraining RandomForestRegressor...")
    rf = RandomForestRegressor(
        n_estimators=200,
        max_depth=10,
        random_state=42,
        n_jobs=-1,
    )
    rf.fit(X_train, y_train)
    rf_mae, rf_rmse, rf_mape = evaluate(rf, X_test, y_test, sales, test_idx,
                                         label="Random Forest")

    # ── Pick winner ──────────────────────────────────────────────────────
    if gb_mae <= rf_mae:
        winner, winner_name = gb, "Gradient Boosting"
    else:
        winner, winner_name = rf, "Random Forest"

    print(f"\n>> Winner: {winner_name} (lower MAE)")

    # Feature importance
    print(f"\n  Feature Importances ({winner_name}):")
    for name, imp in sorted(zip(FEATURE_NAMES, winner.feature_importances_),
                            key=lambda x: -x[1]):
        print(f"    {name:<20} {imp:.4f}")

    # ── Save model ───────────────────────────────────────────────────────
    model_path = os.path.join(MODEL_DIR, "demand_model.joblib")
    joblib.dump(winner, model_path)
    print(f"\nSaved model -> {model_path}")

    # ── Forecast ─────────────────────────────────────────────────────────
    forecast_7days(winner, ef)


if __name__ == "__main__":
    main()
