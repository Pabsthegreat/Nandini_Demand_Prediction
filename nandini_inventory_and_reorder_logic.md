# Nandini Inventory and Reorder Logic

Locked source of truth for inventory simulation, batch handling, wastage, purchase orders, and reorder logic.

## 1. Overall system flow

The full project now has three layers:

1. **Synthetic historical data generation**
   - Generate daily sales for each product and date.
2. **ML forecasting**
   - Train the model on historical generated sales.
   - Predict next 7 days sales for each product.
3. **Inventory and reorder logic**
   - Use predicted demand, live stock, batch expiry, and incoming stock to decide what to order.

The inventory side is simulated **day by day**.

---

## 2. Day-by-day inventory simulation flow

For each product on each day:

1. Start with opening stock / live batches
2. Add any receipts arriving today
3. Process sales for the day
4. Update remaining live batches
5. Apply FIFO consumption assumption
6. Estimate usable stock from current live batches
7. Estimate predicted wastage from current live batches
8. Compute reorder need at **end of day**
9. Convert required quantity into crates
10. Place order at end of day
11. That order arrives **next day**

---

## 3. Core tables in the project

### A. products
Master table containing fixed information about each product.

**Columns**
- `product_id`
- `product_name`
- `pack_size`
- `selling_price`
- `cost_price`
- `shelf_life_days`

---

### B. daily_sales
Daily sales table containing one row per product per day.

**Columns**
- `sales_id`
- `date`
- `product_id`
- `units_sold`
- `selling_price`
- `sales_amount`

**Rule**
- `sales_amount = units_sold × selling_price`

---

### C. external_factors
Stores daily external conditions used in demand generation and forecasting.

**Columns**
- `date`
- `day_of_week`
- `temperature`
- `festival_name`

**Locked rules**
- `temperature` = daily **maximum** temperature
- `hot_day = 1` if `temperature >= 30°C`, otherwise `0`
- rainfall is not used in final current logic
- festival windows are fixed for 2025

---

### D. inventory_batches
Batch-level table used to model manufacturing date, expiry date, received quantity, and batch-level inventory aging.

**Columns**
- `batch_id`
- `product_id`
- `mfd_date`
- `expiry_date`
- `received_date`
- `quantity_received`

**Meaning**
- A **crate/carton** is the smallest orderable pack unit.
- A **batch** is the full received lot of a product on a given date.
- One batch can contain **multiple crates**.

**Batch quantity rule**
- `quantity_received = num_crates × crate_size`

---

### E. daily_inventory
Daily inventory movement table containing one row per product per day.

**Columns**
- `inventory_id`
- `date`
- `product_id`
- `opening_stock`
- `stock_received`
- `units_sold`
- `closing_stock`

**Interpretation**
- `opening_stock` = stock available at start of day
- `stock_received` = quantity received that day from prior order
- `units_sold` = same as generated/recorded daily sales
- `closing_stock` = remaining stock after receipts and sales

---

### F. purchase_orders
Simplified order table used to track placed orders.

**Columns**
- `order_id`
- `order_date`
- `product_id`
- `quantity_ordered`

**Locked rule**
- every order placed on day `t` arrives on day `t+1`

---

### G. wastage
Tracks stock that becomes waste due to expiry.

**Columns**
- `wastage_id`
- `date`
- `product_id`
- `batch_id`
- `quantity_wasted`

**Meaning**
- whenever part of a batch expires unsold, that quantity is recorded here

---

### H. forecast_results
Stores predicted demand for future dates.

**Columns**
- `forecast_id`
- `forecast_date`
- `target_date`
- `product_id`
- `predicted_units_sold`

---

## 4. Order pack / crate size table

These are the smallest orderable units.

| Product ID | Product Name | Crate size |
|---|---|---:|
| P001 | Toned Milk | 20 |
| P002 | Slim Milk | 20 |
| P003 | Pure Cow Milk | 20 |
| P004 | Curd | 20 |
| P005 | Ghee | 12 |
| P006 | Paneer | 10 |
| P007 | Butter | 20 |
| P008 | Buttermilk | 24 |
| P009 | Cheese Slices | 10 |
| P010 | Ice Cream Cup | 24 |

---

## 5. Coverage window by product

The reorder horizon depends on shelf life.

| Product ID | Product Name | Shelf life (days) | Coverage window |
|---|---|---:|---:|
| P001 | Toned Milk | 2 | 1 day |
| P002 | Slim Milk | 2 | 1 day |
| P003 | Pure Cow Milk | 2 | 1 day |
| P004 | Curd | 4 | 2 days |
| P005 | Ghee | 270 | 7 days |
| P006 | Paneer | 7 | 2 days |
| P007 | Butter | 180 | 4 days |
| P008 | Buttermilk | 3 | 1 day |
| P009 | Cheese Slices | 90 | 4 days |
| P010 | Ice Cream Cup | 180 | 4 days |

---

## 6. FIFO consumption rule

Inventory consumption follows **FIFO**.

Meaning:
- older / earlier-expiry stock is consumed first
- then newer batches are used

This assumption is used for:
- batch consumption
- usable stock calculation
- predicted wastage calculation

---

## 7. Usable stock logic

### Batch-level usable quantity

For each batch:

`usable_from_batch = min(batch_qty, forecast_demand_until_batch_expiry_remaining_after_older_batches)`

Using:
- FIFO consumption
- forecast demand up to that batch’s expiry
- older batches consumed first

### Total usable stock

`usable_stock = sum(usable_from_batch across all live batches)`

**Interpretation**
- usable stock is not just total non-expired stock
- it is the quantity expected to be sellable before expiry

---

## 8. Predicted wastage logic

### Batch-level predicted wastage

For each batch:

`predicted_wastage_from_batch = batch_qty - usable_from_batch`

### Total predicted wastage

`predicted_wastage = sum(predicted_wastage_from_batch across all live batches)`

**Interpretation**
- predicted wastage is stock expected to remain unsold when the batch expires

---

## 9. Incoming stock rule

Incoming stock uses a fixed 1-day lead time.

**Locked rule**
- every order placed on day `t` arrives on day `t+1`

So:
- stock ordered today is not available today
- it becomes available tomorrow
- `incoming_stock` in reorder logic refers to stock already scheduled to arrive next day

---

## 10. Reorder decision timing

**Locked rule**
- reorder is evaluated at **end of day**

This happens after:
- receipts are added
- sales are processed
- live stock position is known

---

## 11. Reorder evaluation frequency

**Locked rule**
- reorder is checked **every day for every product**
- even if the final order quantity becomes 0

---

## 12. Reorder output fields

For each reorder decision:

- `required_qty`
- `crate_size`
- `num_crates`
- `final_order_qty`

### Meaning
- `required_qty` = theoretical quantity needed
- `crate_size` = fixed orderable unit for that product
- `num_crates = ceil(required_qty / crate_size)`
- `final_order_qty = num_crates × crate_size`

### Example
If:
- `required_qty = 83`
- `crate_size = 20`

Then:
- `num_crates = ceil(83 / 20) = 5`
- `final_order_qty = 5 × 20 = 100`

---

## 13. Reorder formula for required quantity

### Base formula

`required_qty = max(0, forecast demand over coverage window - usable_stock - incoming_stock)`

### Terms
- **forecast demand over coverage window** = sum of predicted demand for the product over its locked coverage window
- **usable_stock** = stock expected to be sellable before expiry
- **incoming_stock** = stock already scheduled to arrive next day

### Final practical ordering rule

1. Compute `required_qty`
2. Convert into crates:
   - `num_crates = ceil(required_qty / crate_size)`
3. Compute actual placed order:
   - `final_order_qty = num_crates × crate_size`

### Safety stock
- no safety stock is used in the current locked version

---

## 14. Clean end-to-end logic

### Demand side
1. Generate historical daily sales
2. Train ML model
3. Predict next 7 days product-wise sales

### Inventory side
1. Track live batches day by day
2. Apply FIFO consumption
3. Estimate usable stock
4. Estimate predicted wastage
5. Check incoming stock
6. Compute reorder need using forecast over product-specific coverage window
7. Round up to crates
8. Place order at end of day
9. Receive that order next day as a new batch

---

## 15. Locked summary

- Inventory is simulated **day by day**
- FIFO is used for batch consumption
- A batch is a received lot that can contain multiple crates
- Crate size is the smallest orderable unit
- Reorder policy is product-sensitive through coverage windows
- Usable stock counts only what can be sold before expiry
- Predicted wastage is leftover stock expected to expire unsold
- Orders are checked every day for every product
- Orders are placed at end of day
- Orders arrive the next day
- No safety stock is used in the current locked version

