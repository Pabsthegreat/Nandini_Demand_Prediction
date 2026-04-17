# Nandini Data Generation and ML Scope

Locked source of truth for the data-generation and forecasting setup.

## 1. Project flow

The project is split into three conceptual layers:

1. **Synthetic data generation**
   - Generate realistic historical daily sales for each product and day.
2. **ML forecasting**
   - Train a model on the generated historical data.
   - Predict sales for the next 7 days.
3. **Inventory / expiry-aware planning**
   - This exists in the overall project architecture, but is **not part of the current phase**.

Current phase focus:
- **Generate daily sales data**
- **Train the ML model on that generated sales data**

Out of scope for now:
- Stock reordering logic
- Expiry-aware order recommendation
- Inventory-planning formulas

---

## 2. Training year and external factors

### Training period
- **Jan 1, 2025 to Dec 31, 2025**

### Temperature logic
- Use **real 2025 Bangalore historical weather**
- In `external_factors`, store only:
  - `temperature` = **daily maximum temperature**

### Temperature bands
- **Low:** `20–25°C`
- **Medium:** `26–29°C`
- **High:** `30°C and above`

### Hot day rule
- `hot_day = 1` if `temperature >= 30°C`
- `hot_day = 0` otherwise

### Rainfall
- Rainfall is **not used** in the final locked version for current demand generation logic.

### Weekend rule
- Weekend multiplier applies only on:
  - **Saturday**
  - **Sunday**

---

## 3. Festival windows for 2025

| Festival | Active window | Stored `festival_name` |
|---|---|---|
| New Year | 2025-01-01 to 2025-01-01 | `New Year` |
| Pongal / Sankranti | 2025-01-12 to 2025-01-14 | `Pongal/Sankranti` |
| Ugadi | 2025-03-28 to 2025-03-30 | `Ugadi` |
| Raksha Bandhan | 2025-08-08 to 2025-08-09 | `Raksha Bandhan` |
| Ganesh Chaturthi | 2025-08-25 to 2025-08-27 | `Ganesh Chaturthi` |
| Navratri / Dussehra | 2025-09-30 to 2025-10-02 | `Navratri/Dussehra` |
| Deepavali | 2025-10-18 to 2025-10-20 | `Deepavali` |
| Christmas | 2025-12-24 to 2025-12-25 | `Christmas` |

### Festival storage rule
- Every date inside the active window stores that festival name in `festival_name`
- Dates outside all festival windows store `None`
- If overlap ever happens, keep the larger festival label instead of stacking festivals

---

## 4. Core daily demand generation formula

`generated_demand = base_daily_demand × weekend_multiplier × hot_day_multiplier × festival_multiplier × random_variation`

### Rule interpretation
- Start from `base_daily_demand`
- Apply `weekend_multiplier` only if the date is Saturday or Sunday, otherwise `1.0`
- Apply `hot_day_multiplier` only if `temperature >= 30°C`, otherwise `1.0`
- Apply `festival_multiplier` only if the date falls inside the festival window, otherwise `1.0`
- Apply `random_variation` every day to avoid flat sales values

---

## 5. Units sold rule

- `units_sold = ceil(generated_demand)`

For the current phase, daily sales are treated as **demand-driven**, not stock-capped.

---

## 6. Random variation by product

### General ranges by volatility
- **Low volatility:** `0.97 – 1.03`
- **Low-Medium volatility:** `0.95 – 1.05`
- **Medium volatility:** `0.93 – 1.07`
- **High volatility:** `0.90 – 1.10`

### Product-wise random variation ranges

| Product ID | Product Name | Volatility | Random variation range |
|---|---|---|---|
| P001 | Toned Milk | Low | `0.97 – 1.03` |
| P002 | Slim Milk | Low-Medium | `0.95 – 1.05` |
| P003 | Pure Cow Milk | Low | `0.97 – 1.03` |
| P004 | Curd | Medium | `0.93 – 1.07` |
| P005 | Ghee | Medium | `0.93 – 1.07` |
| P006 | Paneer | Medium | `0.93 – 1.07` |
| P007 | Butter | Low-Medium | `0.95 – 1.05` |
| P008 | Buttermilk | Medium | `0.93 – 1.07` |
| P009 | Cheese Slices | Medium | `0.93 – 1.07` |
| P010 | Ice Cream Cup | High | `0.90 – 1.10` |

### Usage rule
- For each product on each day, randomly sample one multiplier from that product’s assigned range
- Use that sampled value as `random_variation` in the demand formula

---

## 7. Locked daily_sales table

### Columns
- `sales_id`
- `date`
- `product_id`
- `units_sold`
- `selling_price`
- `sales_amount`

### Rule
- `sales_amount = units_sold × selling_price`

---

## 8. ML role in the project

### Why ML is still included
The synthetic business rules are used to generate realistic historical data.
The ML model is then trained on this historical data to learn demand behavior from observations, rather than being directly given the formulas.

### Current ML objective
- Train on generated daily historical sales data
- Predict **next 7 days sales** for each product

### Not part of the current phase
- Reorder recommendation logic
- Expiry-aware stock decision engine
- Inventory optimization formulas

---

## 9. Locked summary

- Historical data is generated using rule-based demand logic
- Weather uses only **daily maximum temperature** from real 2025 Bangalore data
- Hot day is derived using the `30°C+` rule
- Festivals are calendar-based with fixed 2025 active windows
- Daily sales are generated using the multiplicative demand formula
- `units_sold` is stored as `ceil(generated_demand)`
- `daily_sales` is the main generated dataset for the current phase
- The ML model is trained on this generated history to forecast the next 7 days

