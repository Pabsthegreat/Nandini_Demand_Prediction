"""
Verification script for the Nandini demand forecasting model.

Runs 4 checks:
  1. Actual vs Predicted on Dec 2025 test set (per product)
  2. Signal detection — does the model respond to weekend/temperature/festival?
  3. Sanity check — are predictions within expected base demand ranges?
  4. Residual analysis — bias and error distribution per product
"""

import csv
import math
import os

import joblib
import numpy as np

# ── Paths ────────────────────────────────────────────────────────────────────
BASE_DIR = os.path.dirname(os.path.abspath(__file__))
DATA_DIR = os.path.join(BASE_DIR, "data")
MODEL_DIR = os.path.join(BASE_DIR, "models")

PRODUCT_IDS = [f"P{str(i).zfill(3)}" for i in range(1, 11)]
PID_TO_INT = {pid: i for i, pid in enumerate(PRODUCT_IDS)}
INT_TO_PID = {i: pid for pid, i in PID_TO_INT.items()}

PRODUCT_NAMES = {
    "P001": "Toned Milk", "P002": "Slim Milk", "P003": "Pure Cow Milk",
    "P004": "Curd", "P005": "Ghee", "P006": "Paneer",
    "P007": "Butter", "P008": "Buttermilk", "P009": "Cheese Slices",
    "P010": "Ice Cream Cup",
}

# Known base demands and multipliers from the spec
BASE_DEMANDS = {
    "P001": 90, "P002": 20, "P003": 70, "P004": 50, "P005": 4,
    "P006": 15, "P007": 12, "P008": 30, "P009": 6, "P010": 8,
}
WEEKEND_MULT = {
    "P001": 1.05, "P002": 1.00, "P003": 1.05, "P004": 1.08, "P005": 1.00,
    "P006": 1.20, "P007": 1.08, "P008": 1.05, "P009": 1.05, "P010": 1.15,
}
HOTDAY_MULT = {
    "P001": 1.00, "P002": 1.00, "P003": 1.00, "P004": 1.10, "P005": 1.00,
    "P006": 1.00, "P007": 1.00, "P008": 1.20, "P009": 1.00, "P010": 1.35,
}
FESTIVAL_MULT = {
    "P001": 1.05, "P002": 1.00, "P003": 1.08, "P004": 1.10, "P005": 1.40,
    "P006": 1.35, "P007": 1.10, "P008": 1.00, "P009": 1.00, "P010": 1.00,
}

DAY_NAME_TO_INT = {
    "Monday": 0, "Tuesday": 1, "Wednesday": 2, "Thursday": 3,
    "Friday": 4, "Saturday": 5, "Sunday": 6,
}


def load_data():
    ef = {}
    with open(os.path.join(DATA_DIR, "external_factors.csv")) as f:
        for row in csv.DictReader(f):
            ef[row["date"]] = row

    sales = []
    with open(os.path.join(DATA_DIR, "daily_sales.csv")) as f:
        for row in csv.DictReader(f):
            sales.append(row)

    return ef, sales


def make_features(dow, is_weekend, temp, is_festival, pid_int):
    return np.array([[dow, is_weekend, temp, is_festival, pid_int]], dtype=np.float64)


def main():
    model = joblib.load(os.path.join(MODEL_DIR, "demand_model.joblib"))
    ef, sales = load_data()

    # ════════════════════════════════════════════════════════════════════
    # CHECK 1: Actual vs Predicted on Dec 2025 test set
    # ════════════════════════════════════════════════════════════════════
    print("=" * 70)
    print("  CHECK 1: Actual vs Predicted — December 2025 (per product)")
    print("=" * 70)

    dec_sales = [r for r in sales if r["date"] >= "2025-12-01"]

    for pid in PRODUCT_IDS:
        prod_rows = [r for r in dec_sales if r["product_id"] == pid]
        actuals = []
        preds = []
        for row in prod_rows:
            ext = ef[row["date"]]
            dow = DAY_NAME_TO_INT[ext["day_of_week"]]
            features = make_features(
                dow,
                1 if dow >= 5 else 0,
                float(ext["temperature"]),
                0 if ext["festival_name"] == "None" else 1,
                PID_TO_INT[pid],
            )
            pred = max(0, model.predict(features)[0])
            actuals.append(int(row["units_sold"]))
            preds.append(round(pred, 1))

        print(f"\n  {PRODUCT_NAMES[pid]} ({pid}):")
        print(f"    Actual:    {actuals}")
        print(f"    Predicted: {[int(round(p)) for p in preds]}")
        diffs = [int(round(p)) - a for a, p in zip(actuals, preds)]
        print(f"    Diff:      {diffs}")

    # ════════════════════════════════════════════════════════════════════
    # CHECK 2: Signal detection — weekend, temperature, festival
    # ════════════════════════════════════════════════════════════════════
    print(f"\n{'=' * 70}")
    print("  CHECK 2: Signal Detection — Does the model respond correctly?")
    print("=" * 70)

    # Test conditions: normal weekday (Wed), temp=27, no festival
    baseline_dow = 2  # Wednesday
    baseline_temp = 27.0

    print(f"\n  Baseline: Wednesday, 27°C, no festival")
    print(f"  Comparing against: weekend / hot day (35°C) / festival\n")
    print(f"  {'Product':<20} {'Base':>6} {'Wknd':>6} {'Δ%':>6}  {'Hot':>6} {'Δ%':>6}  {'Fest':>6} {'Δ%':>6}")
    print(f"  {'-' * 72}")

    signals_ok = 0
    signals_total = 0

    for pid_int in range(10):
        pid = INT_TO_PID[pid_int]

        # Baseline: weekday, 27°C, no festival
        base_pred = model.predict(make_features(baseline_dow, 0, baseline_temp, 0, pid_int))[0]

        # Weekend: Saturday, 27°C, no festival
        wknd_pred = model.predict(make_features(5, 1, baseline_temp, 0, pid_int))[0]

        # Hot day: Wednesday, 35°C, no festival
        hot_pred = model.predict(make_features(baseline_dow, 0, 35.0, 0, pid_int))[0]

        # Festival: Wednesday, 27°C, festival
        fest_pred = model.predict(make_features(baseline_dow, 0, baseline_temp, 1, pid_int))[0]

        wknd_pct = (wknd_pred - base_pred) / base_pred * 100 if base_pred > 0 else 0
        hot_pct = (hot_pred - base_pred) / base_pred * 100 if base_pred > 0 else 0
        fest_pct = (fest_pred - base_pred) / base_pred * 100 if base_pred > 0 else 0

        # Expected direction from spec multipliers
        exp_wknd = (WEEKEND_MULT[pid] - 1) * 100
        exp_hot = (HOTDAY_MULT[pid] - 1) * 100
        exp_fest = (FESTIVAL_MULT[pid] - 1) * 100

        # Check direction (sign matches or both ~0)
        def direction_ok(actual_pct, expected_pct):
            if abs(expected_pct) < 1:  # multiplier is 1.0 — no expected change
                return abs(actual_pct) < 5  # allow small noise
            return (actual_pct > 0) == (expected_pct > 0)

        w_ok = direction_ok(wknd_pct, exp_wknd)
        h_ok = direction_ok(hot_pct, exp_hot)
        f_ok = direction_ok(fest_pct, exp_fest)

        signals_total += 3
        signals_ok += sum([w_ok, h_ok, f_ok])

        w_mark = "ok" if w_ok else "MISS"
        h_mark = "ok" if h_ok else "MISS"
        f_mark = "ok" if f_ok else "MISS"

        print(f"  {PRODUCT_NAMES[pid]:<20} {base_pred:>6.1f} {wknd_pred:>6.1f} {wknd_pct:>+5.1f}% {hot_pred:>6.1f} {hot_pct:>+5.1f}% {fest_pred:>6.1f} {fest_pct:>+5.1f}%")
        print(f"  {'':20} {'':>6} {'expected':>6} {exp_wknd:>+5.1f}% {'':>6} {exp_hot:>+5.1f}% {'':>6} {exp_fest:>+5.1f}%  [{w_mark}|{h_mark}|{f_mark}]")

    print(f"\n  Signal direction accuracy: {signals_ok}/{signals_total} ({signals_ok/signals_total*100:.0f}%)")

    # ════════════════════════════════════════════════════════════════════
    # CHECK 3: Sanity — predictions within expected ranges
    # ════════════════════════════════════════════════════════════════════
    print(f"\n{'=' * 70}")
    print("  CHECK 3: Sanity — Are forecast values within expected ranges?")
    print("=" * 70)

    forecast_rows = []
    with open(os.path.join(DATA_DIR, "forecast_results.csv")) as f:
        for row in csv.DictReader(f):
            forecast_rows.append(row)

    print(f"\n  {'Product':<20} {'Base':>5} {'Min OK':>7} {'Max OK':>7} | {'Forecast range':>16} {'Status':>8}")
    print(f"  {'-' * 70}")

    all_sane = True
    for pid in PRODUCT_IDS:
        base = BASE_DEMANDS[pid]
        # Reasonable range: 60% to 160% of base (accounting for multipliers + randomness)
        lo = math.floor(base * 0.60)
        hi = math.ceil(base * 1.60)

        fvals = [int(r["predicted_units_sold"]) for r in forecast_rows if r["product_id"] == pid]
        fmin, fmax = min(fvals), max(fvals)
        ok = fmin >= lo and fmax <= hi
        if not ok:
            all_sane = False

        status = "PASS" if ok else "WARN"
        print(f"  {PRODUCT_NAMES[pid]:<20} {base:>5} {lo:>7} {hi:>7} | {fmin:>7} – {fmax:<7} {status:>8}")

    print(f"\n  Overall: {'ALL PASS' if all_sane else 'SOME WARNINGS — review flagged products'}")

    # ════════════════════════════════════════════════════════════════════
    # CHECK 4: Residual analysis — bias per product
    # ════════════════════════════════════════════════════════════════════
    print(f"\n{'=' * 70}")
    print("  CHECK 4: Residual Analysis — Bias and Error Distribution (Dec 2025)")
    print("=" * 70)

    print(f"\n  {'Product':<20} {'Mean Err':>9} {'Std Err':>9} {'Bias':>12}")
    print(f"  {'-' * 52}")

    for pid in PRODUCT_IDS:
        prod_rows = [r for r in dec_sales if r["product_id"] == pid]
        residuals = []
        for row in prod_rows:
            ext = ef[row["date"]]
            dow = DAY_NAME_TO_INT[ext["day_of_week"]]
            features = make_features(
                dow,
                1 if dow >= 5 else 0,
                float(ext["temperature"]),
                0 if ext["festival_name"] == "None" else 1,
                PID_TO_INT[pid],
            )
            pred = model.predict(features)[0]
            actual = int(row["units_sold"])
            residuals.append(pred - actual)  # positive = over-predicting

        residuals = np.array(residuals)
        mean_err = np.mean(residuals)
        std_err = np.std(residuals)

        if abs(mean_err) < 1:
            bias = "negligible"
        elif mean_err > 0:
            bias = "over-predict"
        else:
            bias = "under-predict"

        print(f"  {PRODUCT_NAMES[pid]:<20} {mean_err:>+9.2f} {std_err:>9.2f} {bias:>12}")

    print()


if __name__ == "__main__":
    main()
