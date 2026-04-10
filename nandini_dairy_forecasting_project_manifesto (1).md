# Project Manifesto

## Project Title
**AI-Driven Dairy Demand Forecasting and Expiry-Aware Inventory Planning Dashboard for a Nandini Outlet**

## 1. Project Vision
This project aims to build a realistic decision-support dashboard for a single Nandini outlet that helps the store manager monitor sales, current stock, incoming stock, expiry risk, wastage, and short-term demand forecasts for dairy products. The core objective is to improve forecasting accuracy and inventory planning for perishable dairy items in a way that closely reflects real-life retail operations.

The dashboard is the heart of the project: it should provide clear operational visibility and actionable insights to support better day-to-day decisions. The prediction component is the intelligence layer behind the system: it should help estimate demand for the next 7 days so that the manager can plan stock more effectively, reduce waste, and avoid stockouts.

---

## 2. Problem Context
This project is aligned with **P3 – Forecasting Accuracy** from the course project guidelines, where inaccurate manual forecasts lead to inefficient allocation of resources and negatively affect customer satisfaction.

In a dairy retail setting, inaccurate forecasting can lead to:
- Overstocking of short-shelf-life products, resulting in expiry and wastage
- Understocking of high-demand products, resulting in stockouts and lost sales
- Poor visibility into what is currently available, what is nearing expiry, and what stock is already on order
- Inefficient inventory planning during demand changes caused by weather, weekends, and Indian festivals

Because dairy products have different demand patterns and different shelf lives, the outlet requires a more structured, data-driven way to plan inventory.

---

## 3. Final Project Direction
The project will focus on a **single Nandini outlet** rather than multiple locations. The goal is to keep the system focused, realistic, and manageable while still modeling real-life supply chain and inventory behavior in detail.

The solution will center on a **single dairy product line**, which keeps the project tight in scope while still allowing varied demand patterns across products.

### Product Line in Scope
The current planned products are:
- Fresh milk – toned milk
- Fresh milk – slim milk
- Fresh milk – pure cow milk
- Curd
- Ghee
- Paneer
- Butter
- Buttermilk
- Cheese
- Ice cream

This product set is intentionally chosen because it includes a healthy mix of:
- Stable-demand products
- Weather-sensitive products
- Festival-sensitive products
- Faster-expiry products
- Slower-moving products
- Highly seasonal products

This allows the project to stay focused while still producing realistic and varied demand behavior.

---

## 4. Primary User
The main user of the dashboard is the **store manager** of the Nandini outlet.

This means the dashboard should be designed around practical operational decisions such as:
- What products are selling well or poorly?
- What stock is currently available?
- What stock is nearing expiry?
- What stock has already been ordered and is expected to arrive?
- What is likely to be needed over the next 7 days?
- Which products are at risk of stockout or wastage?

The dashboard should support daily retail inventory and replenishment decisions rather than broad corporate analytics.

---

## 5. Core Objective
The central question the project should answer is:

**How much of each dairy product should this Nandini outlet stock over the next few days while minimizing spoilage and stockouts?**

This makes the project not just a forecasting system, but a practical inventory-planning dashboard for perishable goods.

---

## 6. Project Objectives
The project objectives are:

1. Build a realistic dashboard for a Nandini outlet that gives visibility into dairy sales, inventory, incoming stock, expiry risk, and wastage.
2. Use historical daily sales data over a 12-month period to understand demand behavior across dairy products.
3. Forecast daily demand for each product for the next 7 days.
4. Incorporate real-life factors such as weather and Indian festivals into the demand behavior.
5. Track different shelf lives across dairy products to reflect real retail perishability.
6. Support expiry-aware inventory planning so that the store manager can reduce waste and improve availability.
7. Create a synthetic dataset that behaves as realistically as possible, rather than relying on simple random values.

---

## 7. Scope of the Project
### In Scope
The project will include:
- One Nandini outlet
- One year (12 months) of daily historical data
- Daily demand forecasting for the next 7 days
- Sales monitoring
- Current stock visibility
- Ordered/incoming stock tracking
- Expiry-aware inventory monitoring
- Wastage/spoilage tracking
- Product-wise analysis within the dairy category
- Real-life demand drivers such as weather and Indian festivals
- Different shelf lives for different products

### Out of Scope for Now
The following are intentionally excluded at this stage to keep the project focused:
- Multiple outlets or branches
- Inter-store redistribution of stock
- Route/logistics optimization
- Customer-level behavior analysis
- Complex supplier performance analytics
- Dynamic pricing or markdown recommendation systems
- Full procurement optimization across multiple vendors

These can be considered future expansion possibilities but are not part of the current locked scope.

---

## 8. Dashboard Philosophy
A key principle of this project is:

**The dashboard is the heart of the project, and forecasting is the brain behind it.**

This means the dashboard should not exist only to show predictions. It should serve as the main operational interface for the store manager and should combine multiple views of the outlet’s condition.

The prediction model should strengthen the dashboard by helping the manager look ahead, but the dashboard should still remain useful even as a monitoring and planning tool on its own.

---

## 9. Dashboard Functional Areas
The dashboard should be able to present the following functional views.

### A. Sales View
This section should show how products are performing in terms of sales.
Possible metrics and insights:
- Daily sales trend
- Product-wise sales performance
- Best-selling products
- Slow-moving products
- Category contribution within the dairy line
- Sales patterns over time

### B. Inventory View
This section should show what is currently available and how safe the stock position is.
Possible metrics and insights:
- Current stock by product
- Stock coverage / available inventory
- Products at low stock
- Stockout risk indicators
- Stock remaining versus expected near-term demand

### C. Incoming Stock / Ordered Stock View
This section should show what has been ordered and what is expected to arrive.
Possible metrics and insights:
- Ordered quantity by product
- Pending deliveries
- Expected arrival dates
- Received versus pending stock
- Whether incoming stock is sufficient for the near-term demand outlook

### D. Forecast View
This section should show short-term predictive intelligence.
Possible metrics and insights:
- Forecasted demand for the next 7 days
- Product-wise demand forecast
- Forecast versus actual comparison
- Short-term stock requirement estimate
- Forecast confidence or forecast error summary

### E. Expiry and Wastage View
This section should show perishability-related operational risk.
Possible metrics and insights:
- Near-expiry stock
- Expired stock
- Wastage by product
- Wastage trend over time
- Products with highest spoilage exposure
- Shelf-life-based risk visibility

These sections may ultimately be implemented across multiple dashboard pages if needed.

---

## 10. Data Philosophy
The project will use a **synthetic dataset**, but the dataset must behave realistically.

The objective is not to create random numbers. The objective is to generate data that mimics how a real Nandini outlet might behave over time.

The synthetic data should reflect:
- Different daily demand patterns across products
- Realistic shelf-life differences
- Sales variability across weekdays and weekends
- Seasonal/weather sensitivity for selected products
- Indian festival-driven sales changes for selected products
- Ordered stock and stock arrivals
- Expiry-driven waste

The guiding principle is:

**Rule-based realistic simulation, not flat random generation.**

---

## 11. Time Design Decisions
The following time-related decisions are locked:
- Historical time span: **12 months**
- Time granularity: **daily**
- Forecast horizon: **next 7 days**

This is chosen because:
- Daily data is realistic for supermarket-level retail operations
- 12 months is enough to capture trend and seasonality
- A 7-day forecast is practical for short-term replenishment planning

---

## 12. Real-Life Factors to Include
To make the project as real-life as possible, the demand behavior should include external drivers.

### A. Weather
Weather should be included because it can influence demand for several dairy products, especially:
- Buttermilk
- Curd
- Ice cream
- To some extent, milk

A simple weather layer is sufficient. The project does not need overly complex weather modeling.
Potential weather variables may include:
- Daily temperature
- Rainfall flag
- Hot-day indicator

### B. Indian Festivals
Indian festivals should also be included because they can significantly affect demand for selected dairy products, especially:
- Ghee
- Paneer
- Curd
- Butter
- Milk

Festival periods can drive higher household consumption, food preparation, and special purchases. This makes festival-aware demand generation a useful realism factor.

---

## 13. Product Diversity and Demand Behavior
One reason the dairy-only scope is strong is that the chosen products naturally exhibit different demand types.

Examples of realistic demand behavior categories within the selected product line:

### Stable / High-Frequency Demand
- Toned milk
- Slim milk
- Pure cow milk
- Curd

These products are likely to have relatively consistent everyday demand.

### Moderate Fluctuation
- Buttermilk
- Paneer
- Butter

These may vary more with weekends, weather, or local buying behavior.

### Slower-Moving Products
- Ghee
- Cheese

These may not sell in high daily volume but are still important for inventory visibility.

### High Seasonal / Volatile Demand
- Ice cream

This product is expected to have stronger sensitivity to temperature and season.

This diversity within a single dairy line is one of the main reasons the current project direction remains focused while still being analytically rich.

---

## 14. Shelf-Life Realism
A major project requirement from the discussion is that products must have **different real-life shelf lives**.

The team explicitly wants the project to be as realistic as possible, so shelf life should not be simplified into a single common value.

This is important because it directly affects:
- Expiry risk
- Wastage generation
- Replenishment planning
- Inventory safety decisions
- Product-specific stock behavior

The exact shelf-life mapping can be finalized later, but the principle is already locked:

**Different products will have different realistic shelf lives.**

---

## 15. Key Project Features
The final system should aim to include the following major features:

1. Product-wise sales monitoring
2. Historical sales trend analysis
3. Current stock visibility
4. Ordered stock / inbound stock tracking
5. Expiry-aware inventory monitoring
6. Wastage/spoilage visibility
7. Product-wise shelf-life sensitivity
8. Weather-aware demand behavior
9. Festival-aware demand behavior
10. 7-day demand forecasting
11. Short-term inventory planning support
12. Operational dashboard for the store manager

---

## 16. Strategic Positioning of the Project
This project should be positioned as more than a basic sales dashboard and more than a plain forecasting model.

It is best described as a:

**Realistic perishable-retail decision-support system for dairy inventory planning**

The project is valuable because it integrates:
- Monitoring
- Visibility
- Perishability awareness
- Forecasting
- Practical planning support

This gives it both operational relevance and analytical depth.

---

## 17. Future Expansion Possibilities
While not part of the current scope, the following can be stated as future enhancements:
- Expansion from one outlet to multiple Nandini outlets
- Inter-store stock redistribution
- More advanced supplier and procurement analytics
- Dynamic markdown recommendations for near-expiry products
- Promotion planning
- More sophisticated forecasting models
- Location-wise demand comparison

These future possibilities help show scalability without complicating the current project.

---

## 18. Final Locked Statement
The currently locked version of the project can be summarized as follows:

**This project develops a realistic decision-support dashboard for a single Nandini outlet, focused on monitoring dairy product sales, stock availability, incoming orders, expiry risk, and wastage, while using data-driven forecasting to predict product demand for the next 7 days. The system is designed to mimic real-life retail behavior by incorporating daily sales patterns, different product shelf lives, weather variation, and Indian festival effects, enabling better inventory planning for perishable dairy products.**

---

## 19. Working One-Line Summary
**A realistic dairy retail dashboard for a Nandini outlet that combines sales visibility, inventory tracking, ordered stock monitoring, expiry-aware planning, and 7-day demand forecasting.**

---

## 20. Next Step After This Manifesto
After this manifesto, the next logical step is to define:
1. The exact product-level demand behavior assumptions
2. The data entities/tables required
3. The exact factors that affect each product
4. The synthetic data generation logic
5. The dashboard KPIs and page structure in more detail

This manifesto is intended to serve as the project’s current source of truth before moving into schema and data design.