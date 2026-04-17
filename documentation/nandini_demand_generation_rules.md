# Nandini Demand Generation Rules

Locked rules for daily demand generation in the Jan–Dec 2025 training dataset.

## 1. Core daily demand formula

`generated_demand = base_daily_demand × weekend_multiplier × hot_day_multiplier × festival_multiplier × random_variation`

### Rule interpretation
- Start from `base_daily_demand` for the product.
- Apply `weekend_multiplier` only if the date is Saturday or Sunday. Otherwise use `1.0`.
- Apply `hot_day_multiplier` only if the daily maximum temperature is `>= 30°C`. Otherwise use `1.0`.
- Apply `festival_multiplier` only if the date falls inside the active festival window. Otherwise use `1.0`.
- Apply `random_variation` every day to avoid flat, repetitive sales values.

---

## 2. External factors table weather rule

In `external_factors`, store:

- `temperature` = **daily maximum temperature**

Derived rule:

- `hot_day = 1` if `temperature >= 30°C`
- `hot_day = 0` otherwise

No rainfall logic is used in the final locked version.

---

## 3. Random variation by product

Random variation is applied as a multiplier each day.

General ranges by volatility:
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

### How to use the range
- For each product on each day, randomly sample one multiplier from that product’s assigned range.
- Use that sampled value as `random_variation` in the demand formula.
- This keeps daily sales realistic and non-flat while respecting each product’s expected volatility.

---

## 4. Locked summary

- Demand is generated using a multiplicative formula.
- External weather input uses only **daily maximum temperature**.
- Hot day is derived from temperature using the `30°C+` rule.
- Random daily variation is introduced using product-specific multiplier ranges.

