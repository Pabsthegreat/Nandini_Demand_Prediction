# Database Schema

## 1. `products`
Master table containing fixed information about each product.

### Columns
- `product_id`
- `product_name`
- `pack_size`
- `selling_price`
- `cost_price`
- `shelf_life_days`

---

## 2. `daily_sales`
Daily sales table containing one row per product per day.

### Columns
- `sales_id`
- `date`
- `product_id`
- `units_sold`
- `selling_price`
- `sales_amount`

---

## 3. `inventory_batches`
Batch-level table used to model manufacturing date, expiry date, and received stock for each product batch.

### Columns
- `batch_id`
- `product_id`
- `mfd_date`
- `expiry_date`
- `received_date`
- `quantity_received`

---

## 4. `daily_inventory`
Daily inventory summary table containing product-level stock movement for each day.

### Columns
- `inventory_id`
- `date`
- `product_id`
- `opening_stock`
- `stock_received`
- `units_sold`
- `closing_stock`

---

## 5. `purchase_orders`
Simplified order table mainly used for dashboard display and order visibility.

### Columns
- `order_id`
- `order_date`
- `product_id`
- `quantity_ordered`

---

## 6. `wastage`
Tracks stock that becomes waste due to expiry.

### Columns
- `wastage_id`
- `date`
- `product_id`
- `batch_id`
- `quantity_wasted`

---

## 7. `external_factors`
Stores daily external conditions that may influence demand.

### Columns
- `date`
- `day_of_week`
- `temperature`
- `hot_day`
- `festival_name`
- `source`

---

## 8. `forecast_results`
Stores forecast outputs for future dates, generated from historical data.

### Columns
- `forecast_id`
- `forecast_date`
- `target_date`
- `product_id`
- `predicted_units_sold`

---

## Final Notes
This schema is designed for:
- one Nandini outlet
- daily granularity
- 12 months of historical data
- 7-day demand forecasting
- expiry-aware inventory planning for dairy products

The schema intentionally keeps the project focused and realistic while avoiding unnecessary complexity such as multiple stores, supplier analytics, and logistics layers.
