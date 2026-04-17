# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Repository Status

This repository currently contains **specification and design documents only** — no source code, build scripts, or tests exist yet. The markdown files are the locked source of truth for a planned project. When implementation begins, code should conform to the rules and values fixed in these documents.

## Project Overview

**AI-Driven Dairy Demand Forecasting and Expiry-Aware Inventory Planning Dashboard for a single Nandini outlet.**

The system is conceptually three layers:
1. **Synthetic data generation** — produce one year of realistic daily sales using rule-based simulation (not flat random values).
2. **ML forecasting** — train on the generated history, predict the next 7 days of sales per product.
3. **Inventory / expiry-aware planning** — exists in the overall architecture but is **out of scope for the current phase**. Do not build reorder logic, expiry-aware order recommendations, or inventory-planning formulas yet.

Guiding principle: *the dashboard is the heart, forecasting is the brain.* Scope is intentionally locked to one outlet, one dairy product line (10 SKUs), daily granularity, 12 months of history, 7-day forecast horizon.

## Document Map

The specs are layered — read in this order to get the full picture:

- `nandini_dairy_forecasting_project_manifesto (1).md` — top-level vision, scope, dashboard functional areas (Sales / Inventory / Incoming / Forecast / Expiry views), in-scope vs out-of-scope decisions.
- `nandini_dairy_forecasting_database_schema.md` — the 8 tables: `products`, `daily_sales`, `inventory_batches`, `daily_inventory`, `purchase_orders`, `wastage`, `external_factors`, `forecast_results`.
- `nandini_dairy_product_values_and_multipliers.md` — **the numeric source of truth**: product master (price, cost, shelf life), `base_daily_demand`, and per-product `weekend_multiplier`, `hot_day_multiplier`, `festival_multiplier`, volatility tier.
- `nandini_data_generation_and_ml_scope.md` — locked source of truth for the data-generation + forecasting setup, including the current-phase boundary.
- `nandini_demand_generation_rules.md` — the demand formula and random-variation rules (overlaps with the scope doc; both must agree).
- `nandini_2025_festival_windows.md` — the 8 festival windows for 2025 with exact date ranges.

When the same fact appears in multiple files (e.g. random-variation ranges, the demand formula, festival windows), it must stay consistent across all of them. If you change one, update the others.

## Locked Design Rules

These are not suggestions — they are decisions that have been explicitly locked in the spec docs.

### Demand formula
```
generated_demand = base_daily_demand
                 × weekend_multiplier   (1.0 unless Sat/Sun)
                 × hot_day_multiplier   (1.0 unless temperature >= 30°C)
                 × festival_multiplier  (1.0 unless date is in a festival window)
                 × random_variation     (sampled per product per day from its volatility range)

units_sold = ceil(generated_demand)
sales_amount = units_sold × selling_price
```
Daily sales in the current phase are **demand-driven, not stock-capped** — do not clip to available inventory.

### Training period and weather
- Training window: **2025-01-01 to 2025-12-31** (Jan–Dec 2025).
- Weather source: **real 2025 Bangalore historical daily maximum temperature**.
- `external_factors.temperature` stores only daily max temperature.
- `hot_day = 1` iff `temperature >= 30°C`.
- Rainfall is **not used** in the locked version. Do not add rainfall logic.
- Weekend multiplier applies only on Saturday and Sunday.

### Festivals
Eight festival windows in 2025 (see `nandini_2025_festival_windows.md`). Rules:
- Every date inside an active window stores that festival name in `external_factors.festival_name`.
- Dates outside all windows store `None`.
- On overlap, keep the larger festival label — never stack festivals.

### Random variation by volatility
Sample one multiplier per product per day from the product's assigned range:
- Low: `0.97–1.03` (Toned Milk, Pure Cow Milk)
- Low-Medium: `0.95–1.05` (Slim Milk, Butter)
- Medium: `0.93–1.07` (Curd, Ghee, Paneer, Buttermilk, Cheese Slices)
- High: `0.90–1.10` (Ice Cream Cup)

### ML scope
The model is trained on the generated historical sales — **it must learn demand from the observations, not be handed the formulas/multipliers as features.** Output is next-7-day per-product sales prediction, written to `forecast_results`.

## When Implementing

- Treat `nandini_dairy_product_values_and_multipliers.md` as the canonical numeric input. Do not invent product values, prices, shelf lives, or multipliers.
- Keep the synthetic generator rule-based and reproducible (seeded random) so output can be regenerated deterministically.
- Do not build features that the manifesto lists as out of scope (multiple outlets, redistribution, routing, customer analytics, dynamic pricing, supplier analytics, full procurement).
- The schema in `nandini_dairy_forecasting_database_schema.md` is intentionally minimal — do not add columns or tables without updating that doc first.
