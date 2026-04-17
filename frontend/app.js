const DATA_PATHS = {
  sales: "/data/daily_sales.csv",
  external: "/data/external_factors.csv",
  forecast: "/data/forecast_results.csv",
  dailyInventory: "/data/daily_inventory.csv",
  purchaseOrders: "/data/purchase_orders.csv",
  wastage: "/data/wastage.csv",
  products: "/data/products.csv",
};

const state = {
  products: [],
  sales: [],
  external: new Map(),
  forecast: [],
  dailyInventory: [],
  purchaseOrders: [],
  wastage: [],
  selectedProduct: "all",
  dateFrom: "",
  dateTo: "",
};

const moneyFormatter = new Intl.NumberFormat("en-IN", {
  style: "currency",
  currency: "INR",
  maximumFractionDigits: 0,
});

const numberFormatter = new Intl.NumberFormat("en-IN");

function parseCsv(text) {
  const rows = [];
  let field = "";
  let row = [];
  let inQuotes = false;

  for (let i = 0; i < text.length; i += 1) {
    const char = text[i];
    const next = text[i + 1];

    if (char === '"' && inQuotes && next === '"') {
      field += '"';
      i += 1;
    } else if (char === '"') {
      inQuotes = !inQuotes;
    } else if (char === "," && !inQuotes) {
      row.push(field);
      field = "";
    } else if ((char === "\n" || char === "\r") && !inQuotes) {
      if (char === "\r" && next === "\n") {
        i += 1;
      }
      row.push(field);
      field = "";
      if (row.some((value) => value !== "")) {
        rows.push(row);
      }
      row = [];
    } else {
      field += char;
    }
  }

  if (field || row.length) {
    row.push(field);
    rows.push(row);
  }

  const headers = rows.shift() || [];
  return rows.map((values) => Object.fromEntries(headers.map((header, index) => [header, values[index] || ""])));
}

async function loadCsv(path, options = {}) {
  const response = await fetch(path);
  if (!response.ok) {
    if (options.optional) {
      return [];
    }
    throw new Error(`Could not load ${path}`);
  }
  return parseCsv(await response.text());
}

function getProductName(productId) {
  return state.products.find((product) => product.product_id === productId)?.product_name || productId;
}

function getProductPrice(productId) {
  return toNumber(state.products.find((product) => product.product_id === productId)?.selling_price);
}

function toNumber(value) {
  return Number(value || 0);
}

function groupBy(items, keyFn) {
  return items.reduce((acc, item) => {
    const key = keyFn(item);
    if (!acc.has(key)) {
      acc.set(key, []);
    }
    acc.get(key).push(item);
    return acc;
  }, new Map());
}

function sum(items, valueFn) {
  return items.reduce((total, item) => total + valueFn(item), 0);
}

function average(values) {
  return values.length ? values.reduce((total, value) => total + value, 0) / values.length : 0;
}

function formatDate(value) {
  const date = new Date(`${value}T00:00:00`);
  return date.toLocaleDateString("en-IN", { day: "numeric", month: "short" });
}

function formatFullDate(value) {
  const date = new Date(`${value}T00:00:00`);
  return date.toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" });
}

function getForecastRows() {
  return state.forecast
    .filter((row) => state.selectedProduct === "all" || row.product_id === state.selectedProduct)
    .sort((a, b) => a.target_date.localeCompare(b.target_date) || a.product_id.localeCompare(b.product_id));
}

function getDailyInventoryRows() {
  return state.dailyInventory
    .filter((row) => state.selectedProduct === "all" || row.product_id === state.selectedProduct)
    .sort((a, b) => a.date.localeCompare(b.date) || a.product_id.localeCompare(b.product_id));
}

function getPurchaseOrderRows() {
  return state.purchaseOrders
    .filter((row) => state.selectedProduct === "all" || row.product_id === state.selectedProduct)
    .sort((a, b) => a.order_date.localeCompare(b.order_date) || toNumber(b.quantity_ordered) - toNumber(a.quantity_ordered));
}

function getWastageRows() {
  return state.wastage
    .filter((row) => state.selectedProduct === "all" || row.product_id === state.selectedProduct)
    .sort((a, b) => a.date.localeCompare(b.date) || a.product_id.localeCompare(b.product_id));
}

function getFilteredSales() {
  return state.sales.filter((row) => {
    const productMatch = state.selectedProduct === "all" || row.product_id === state.selectedProduct;
    const matchesFrom = !state.dateFrom || row.date >= state.dateFrom;
    const matchesTo = !state.dateTo || row.date <= state.dateTo;
    return productMatch && matchesFrom && matchesTo;
  });
}

function getSalesDateBounds() {
  if (!state.sales.length) {
    return { min: "", max: "" };
  }
  const dates = state.sales.map((row) => row.date).sort();
  return {
    min: dates[0],
    max: dates[dates.length - 1],
  };
}

function getForecastDates(rows = getForecastRows()) {
  return [...new Set(rows.map((row) => row.target_date))].sort();
}

function getForecastRangeLabel(rows = getForecastRows()) {
  const dates = getForecastDates(rows);
  if (!dates.length) {
    return "No forecast loaded";
  }
  return `${formatFullDate(dates[0])} to ${formatFullDate(dates[dates.length - 1])}`;
}

function getPredictedRevenue(row) {
  return toNumber(row.predicted_units_sold) * getProductPrice(row.product_id);
}

function aggregateDaily(rows) {
  const grouped = groupBy(rows, (row) => row.date);
  return Array.from(grouped, ([date, items]) => ({
    date,
    units: sum(items, (item) => toNumber(item.units_sold)),
    revenue: sum(items, (item) => toNumber(item.sales_amount)),
  })).sort((a, b) => a.date.localeCompare(b.date));
}

function aggregateProduct(rows) {
  const grouped = groupBy(rows, (row) => row.product_id);
  return Array.from(grouped, ([productId, items]) => ({
    productId,
    name: getProductName(productId),
    units: sum(items, (item) => toNumber(item.units_sold)),
    revenue: sum(items, (item) => toNumber(item.sales_amount)),
  })).sort((a, b) => b.units - a.units);
}

function aggregateForecastDaily(rows) {
  const grouped = groupBy(rows, (row) => row.target_date);
  return Array.from(grouped, ([date, items]) => ({
    date,
    units: sum(items, (item) => toNumber(item.predicted_units_sold)),
    revenue: sum(items, getPredictedRevenue),
  })).sort((a, b) => a.date.localeCompare(b.date));
}

function aggregateForecastProduct(rows) {
  const grouped = groupBy(rows, (row) => row.product_id);
  return Array.from(grouped, ([productId, items]) => ({
    productId,
    name: getProductName(productId),
    units: sum(items, (item) => toNumber(item.predicted_units_sold)),
    revenue: sum(items, getPredictedRevenue),
  })).sort((a, b) => b.units - a.units);
}

function aggregateInventoryDaily(rows) {
  const grouped = groupBy(rows, (row) => row.date);
  return Array.from(grouped, ([date, items]) => ({
    date,
    opening: sum(items, (item) => toNumber(item.opening_stock)),
    received: sum(items, (item) => toNumber(item.stock_received)),
    sold: sum(items, (item) => toNumber(item.units_sold)),
    closing: sum(items, (item) => toNumber(item.closing_stock)),
  })).sort((a, b) => a.date.localeCompare(b.date));
}

function aggregateOrdersByProduct(rows) {
  const grouped = groupBy(rows, (row) => row.product_id);
  return Array.from(grouped, ([productId, items]) => ({
    productId,
    label: getProductName(productId),
    value: sum(items, (item) => toNumber(item.quantity_ordered)),
  })).sort((a, b) => b.value - a.value);
}

function aggregateWastageByProduct(rows) {
  const grouped = groupBy(rows, (row) => row.product_id);
  return Array.from(grouped, ([productId, items]) => ({
    productId,
    label: getProductName(productId),
    value: sum(items, (item) => toNumber(item.quantity_wasted)),
  })).sort((a, b) => b.value - a.value);
}

function aggregateInventoryByProduct(rows, purchaseOrders, wastageRows, forecastRows) {
  const inventoryByProduct = groupBy(rows, (row) => row.product_id);
  const ordersByProduct = groupBy(purchaseOrders, (row) => row.product_id);
  const wastageByProduct = groupBy(wastageRows, (row) => row.product_id);
  const forecastByProduct = groupBy(forecastRows, (row) => row.product_id);

  return Array.from(inventoryByProduct, ([productId, items]) => {
    const sortedInventory = items.slice().sort((a, b) => a.date.localeCompare(b.date));
    const firstDay = sortedInventory[0];
    const lastDay = sortedInventory[sortedInventory.length - 1];
    const productOrders = ordersByProduct.get(productId) || [];
    const productWastage = wastageByProduct.get(productId) || [];
    const productForecast = forecastByProduct.get(productId) || [];

    return {
      productId,
      name: getProductName(productId),
      opening: toNumber(firstDay?.opening_stock),
      closing: toNumber(lastDay?.closing_stock),
      sold: sum(sortedInventory, (item) => toNumber(item.units_sold)),
      received: sum(sortedInventory, (item) => toNumber(item.stock_received)),
      ordered: sum(productOrders, (item) => toNumber(item.quantity_ordered)),
      wasted: sum(productWastage, (item) => toNumber(item.quantity_wasted)),
      forecast: sum(productForecast, (item) => toNumber(item.predicted_units_sold)),
    };
  }).sort((a, b) => b.forecast - a.forecast);
}

function buildInventorySnapshot(rows, purchaseOrders, wastageRows) {
  const orderByDate = groupBy(purchaseOrders, (row) => row.order_date);
  const wasteByDate = groupBy(wastageRows, (row) => row.date);

  return aggregateInventoryDaily(rows).map((day) => ({
    ...day,
    ordered: sum(orderByDate.get(day.date) || [], (item) => toNumber(item.quantity_ordered)),
    wasted: sum(wasteByDate.get(day.date) || [], (item) => toNumber(item.quantity_wasted)),
  }));
}

function addDays(value, amount) {
  const date = new Date(`${value}T00:00:00`);
  date.setDate(date.getDate() + amount);
  return date.toISOString().slice(0, 10);
}

function renderListMessage(targetId, message) {
  document.querySelector(targetId).innerHTML = `<div class="loading">${message}</div>`;
}

function setSelectedProduct(productId) {
  state.selectedProduct = productId;
  const select = document.querySelector("#global-product-filter");
  if (select) {
    select.value = productId;
  }
  renderAll();
}

function renderPlanningWindow() {
  const rangeLabel = getForecastRangeLabel();
  const dates = getForecastDates();
  const forecastDays = dates.length;
  document.querySelector("#planning-window-label").textContent = rangeLabel;
  document.querySelector("#planning-window-copy").textContent = forecastDays ? "Forecast, inventory, and reorder plan" : "Forecast window unavailable";
  document.querySelector("#topbar-title").textContent = forecastDays ? "Demand, inventory, and reorder plan" : "Demand and reorder plan";
  document.querySelector("#overview-title").textContent = forecastDays ? "Current demand plan" : "Current demand plan";
  document.querySelector("#forecast-title").textContent = forecastDays ? "Current forecast by SKU" : "Current forecast by SKU";
}

function renderKpis() {
  const rows = getForecastRows();
  const daily = aggregateForecastDaily(rows);
  const products = aggregateForecastProduct(rows);
  const totalUnits = sum(rows, (row) => toNumber(row.predicted_units_sold));
  const revenue = sum(rows, getPredictedRevenue);
  const avgDaily = Math.round(average(daily.map((day) => day.units)));
  const topProduct = products[0];
  const forecastDate = state.forecast[0]?.forecast_date;
  const forecastDays = getForecastDates(rows).length;

  const cards = [
    ["Forecast units", numberFormatter.format(totalUnits), getForecastRangeLabel(rows), "blue"],
    ["Expected revenue", moneyFormatter.format(revenue), "Using product prices", "green"],
    ["Top forecast SKU", topProduct?.name || "No product", `${numberFormatter.format(topProduct?.units || 0)} predicted units`, "amber"],
    ["Avg daily forecast", numberFormatter.format(avgDaily), "Predicted units per day", "coral"],
    ["Model run", forecastDate ? formatFullDate(forecastDate) : "Pending", `${forecastDays || 0}-day horizon`, "violet"],
  ];

  document.querySelector("#kpi-grid").innerHTML = cards.map(([label, value, hint, tone], index) => `
    <div class="kpi-card kpi-card-${tone}" style="--card-delay: ${index * 70}ms">
      <p class="eyebrow">${label}</p>
      <strong>${value}</strong>
      <span>${hint}</span>
    </div>
  `).join("");
}

function renderLineChart(targetId, points, options = {}) {
  const target = document.querySelector(targetId);
  target.classList.remove("product-summary-grid");
  if (!points.length) {
    target.innerHTML = `<div class="loading">${options.emptyMessage || "No demand data in this period."}</div>`;
    return;
  }

  const width = 860;
  const height = 290;
  const gradientId = `${targetId.replace(/[^a-z0-9]/gi, "")}-gradient`;
  const pad = { top: 18, right: 16, bottom: 32, left: 54 };
  const minY = 0;
  const maxY = Math.max(...points.map((point) => point.units), 1);
  const innerWidth = width - pad.left - pad.right;
  const innerHeight = height - pad.top - pad.bottom;

  const x = (index) => pad.left + (points.length === 1 ? 0 : (index / (points.length - 1)) * innerWidth);
  const y = (value) => pad.top + innerHeight - ((value - minY) / (maxY - minY || 1)) * innerHeight;
  const line = points.map((point, index) => `${x(index)},${y(point.units)}`).join(" ");
  const area = `${pad.left},${height - pad.bottom} ${line} ${pad.left + innerWidth},${height - pad.bottom}`;
  const dots = points
    .filter((point, index) => index === 0 || index === points.length - 1 || index % Math.max(Math.floor(points.length / 8), 1) === 0)
    .map((point, index) => `<circle class="chart-dot" style="--dot-delay: ${index * 90}ms" cx="${x(points.indexOf(point))}" cy="${y(point.units)}" r="4"></circle>`)
    .join("");
  const ticks = [0, 0.25, 0.5, 0.75, 1].map((ratio) => {
    const value = Math.round(maxY * ratio);
    const tickY = y(value);
    return `<g><line class="grid-line" x1="${pad.left}" y1="${tickY}" x2="${pad.left + innerWidth}" y2="${tickY}"></line><text class="axis-label" x="8" y="${tickY + 4}">${numberFormatter.format(value)}</text></g>`;
  }).join("");
  const labels = [0, Math.floor(points.length / 2), points.length - 1]
    .filter((value, index, list) => list.indexOf(value) === index)
    .map((index) => `<text class="axis-label" x="${x(index)}" y="${height - 8}" text-anchor="middle">${formatDate(points[index].date)}</text>`)
    .join("");

  target.innerHTML = `
    <svg class="chart-svg" viewBox="0 0 ${width} ${height}" role="img" aria-label="${options.ariaLabel || "Daily demand chart"}" preserveAspectRatio="none">
      <defs>
        <linearGradient id="${gradientId}" x1="0%" y1="0%" x2="100%" y2="0%">
          <stop offset="0%" stop-color="var(--blue)"></stop>
          <stop offset="52%" stop-color="var(--teal)"></stop>
          <stop offset="100%" stop-color="var(--coral)"></stop>
        </linearGradient>
      </defs>
      ${ticks}
      <polygon class="chart-fill" points="${area}"></polygon>
      <polyline class="chart-line" points="${line}" pathLength="1" stroke="url(#${gradientId})"></polyline>
      ${dots}
      ${labels}
    </svg>
  `;
}

function renderBarList(targetId, items, options = {}) {
  const target = document.querySelector(targetId);
  if (!items.length) {
    target.innerHTML = `<div class="loading">${options.emptyMessage || "No data available."}</div>`;
    return;
  }
  const max = Math.max(...items.map((item) => item.value), 1);
  const color = options.color || "var(--blue)";
  const suffix = options.suffix || "";
  const limit = options.limit || items.length;
  const clickable = Boolean(options.clickable);

  target.innerHTML = items.slice(0, limit).map((item) => `
    <${clickable ? "button" : "div"} class="bar-row${clickable ? " bar-row-button" : ""}" ${clickable ? `type="button" data-product-id="${item.productId || ""}"` : ""}>
      <div class="bar-label">
        <span>${item.label}</span>
        <span>${numberFormatter.format(Math.round(item.value))}${suffix}</span>
      </div>
      <div class="bar-track">
        <div class="bar-fill" style="--bar-width: ${(item.value / max) * 100}%; background: ${color};"></div>
      </div>
    </${clickable ? "button" : "div"}>
  `).join("");

  if (clickable) {
    target.querySelectorAll("[data-product-id]").forEach((node) => {
      node.addEventListener("click", () => {
        if (node.dataset.productId) {
          setSelectedProduct(node.dataset.productId);
        }
      });
    });
  }
}

function renderProductSummaryGrid(targetId, items) {
  const target = document.querySelector(targetId);
  target.classList.add("product-summary-grid");
  target.innerHTML = items.map((item) => `
    <button class="product-summary-card" type="button" data-product-id="${item.productId}">
      <div class="product-summary-head">
        <strong>${item.name}</strong>
        <span>View details</span>
      </div>
      <div class="product-summary-metrics">
        <div>
          <span>Forecast</span>
          <strong>${numberFormatter.format(item.forecast)}</strong>
        </div>
        <div>
          <span>Closing stock</span>
          <strong>${numberFormatter.format(item.closing)}</strong>
        </div>
        <div>
          <span>Reorder</span>
          <strong>${numberFormatter.format(item.ordered)}</strong>
        </div>
        <div>
          <span>Wastage</span>
          <strong>${numberFormatter.format(item.wasted)}</strong>
        </div>
      </div>
    </button>
  `).join("");

  target.querySelectorAll("[data-product-id]").forEach((node) => {
    node.addEventListener("click", () => {
      setSelectedProduct(node.dataset.productId);
    });
  });
}

function renderComparisonBars(targetId, items) {
  const max = Math.max(...items.map((item) => item.value), 1);
  document.querySelector(targetId).innerHTML = items.map((item) => `
    <div class="comparison-item">
      <span>${item.label}</span>
      <div class="bar-track">
        <div class="bar-fill" style="--bar-width: ${(item.value / max) * 100}%; background: ${item.color};"></div>
      </div>
      <strong>${numberFormatter.format(Math.round(item.value))}</strong>
    </div>
  `).join("");
}

function renderSignals() {
  const rows = getForecastRows();
  const daily = aggregateForecastDaily(rows);
  const products = aggregateForecastProduct(rows);
  const dailyWithWeekday = daily.map((day) => {
    const date = new Date(`${day.date}T00:00:00`);
    const weekday = date.toLocaleDateString("en-IN", { weekday: "long" });
    return { ...day, weekday };
  });
  const weekdayUnits = sum(dailyWithWeekday.filter((day) => day.weekday !== "Saturday" && day.weekday !== "Sunday"), (day) => day.units);
  const weekendUnits = sum(dailyWithWeekday.filter((day) => day.weekday === "Saturday" || day.weekday === "Sunday"), (day) => day.units);
  const peakDay = daily.slice().sort((a, b) => b.units - a.units)[0];
  const topProduct = products[0];
  const secondProduct = products[1];

  const signals = [
    ["Weekend allocation", `${numberFormatter.format(weekendUnits)} predicted weekend units`, weekdayUnits > weekendUnits ? "Weekdays carry the larger base volume in this horizon." : "Weekend demand is a planning priority."],
    ["Peak forecast day", peakDay ? `${formatFullDate(peakDay.date)} needs ${numberFormatter.format(peakDay.units)} units` : "No forecast day loaded", "Use this as the high-water mark for short-term replenishment."],
    ["SKU concentration", topProduct ? `${topProduct.name} leads with ${numberFormatter.format(topProduct.units)} units` : "No forecast SKU loaded", secondProduct ? `${secondProduct.name} is the next demand line to watch.` : "Review the forecast before stock planning."],
  ];

  document.querySelector("#signal-list").innerHTML = signals.map(([title, value, note]) => `
    <div class="signal-item">
      <strong>${title}</strong>
      <span>${value}. ${note}</span>
    </div>
  `).join("");
}

function renderSalesAnalytics() {
  const rows = getFilteredSales();
  const daily = aggregateDaily(rows);
  const joined = rows.map((row) => ({ ...row, ext: state.external.get(row.date) }));
  const weekdayRows = joined.filter((row) => row.ext?.day_of_week !== "Saturday" && row.ext?.day_of_week !== "Sunday");
  const weekendRows = joined.filter((row) => row.ext?.day_of_week === "Saturday" || row.ext?.day_of_week === "Sunday");
  const regularRows = joined.filter((row) => row.ext?.festival_name === "None");
  const festivalRows = joined.filter((row) => row.ext?.festival_name !== "None");
  const hotRows = joined.filter((row) => row.ext?.hot_day === "1");

  renderLineChart("#filtered-trend-chart", daily, {
    ariaLabel: "Historical daily units sold chart",
    emptyMessage: "No historical sales in this period.",
  });
  renderComparisonBars("#weekend-chart", [
    { label: "Weekday", value: sum(weekdayRows, (row) => toNumber(row.units_sold)), color: "var(--teal)" },
    { label: "Weekend", value: sum(weekendRows, (row) => toNumber(row.units_sold)), color: "var(--amber)" },
  ]);
  renderComparisonBars("#festival-chart", [
    { label: "Regular", value: sum(regularRows, (row) => toNumber(row.units_sold)), color: "var(--blue)" },
    { label: "Festival", value: sum(festivalRows, (row) => toNumber(row.units_sold)), color: "var(--coral)" },
  ]);
  renderBarList("#hot-products-chart", aggregateProduct(hotRows).map((item) => ({
    label: item.name,
    value: item.units,
  })), { color: "linear-gradient(90deg, var(--amber), var(--coral))", limit: 6 });
}

function renderForecast() {
  const rows = getForecastRows();
  const grouped = groupBy(rows, (row) => row.product_id);
  const totals = Array.from(grouped, ([productId, items]) => ({
    productId,
    label: getProductName(productId),
    value: sum(items, (item) => toNumber(item.predicted_units_sold)),
    rows: items.sort((a, b) => a.target_date.localeCompare(b.target_date)),
  })).sort((a, b) => b.value - a.value);

  renderBarList("#forecast-rank-chart", totals, {
    color: "linear-gradient(90deg, var(--teal), var(--blue))",
    limit: 10,
    clickable: state.selectedProduct === "all",
  });
  document.querySelector("#forecast-priority-list").innerHTML = totals.slice(0, 3).map((item, index) => `
    <div class="priority-item priority-item-${index + 1}" ${state.selectedProduct === "all" ? `data-product-id="${item.productId}" role="button" tabindex="0"` : ""}>
      <strong>${item.label}</strong>
      <span>${numberFormatter.format(item.value)} predicted units in the current horizon</span>
    </div>
  `).join("");
  if (state.selectedProduct === "all") {
    document.querySelectorAll("#forecast-priority-list [data-product-id]").forEach((node) => {
      node.addEventListener("click", () => setSelectedProduct(node.dataset.productId));
      node.addEventListener("keydown", (event) => {
        if (event.key === "Enter" || event.key === " ") {
          event.preventDefault();
          setSelectedProduct(node.dataset.productId);
        }
      });
    });
  }

  const dates = getForecastDates(rows);
  const thead = document.querySelector("#forecast-table thead");
  const tbody = document.querySelector("#forecast-table tbody");

  thead.innerHTML = `
    <tr>
      <th>Product</th>
      ${dates.map((date) => `<th>${formatDate(date)}</th>`).join("")}
      <th>Total</th>
    </tr>
  `;
  tbody.innerHTML = totals.map((item) => `
    <tr>
      <td>${item.label}</td>
      ${dates.map((date) => {
        const row = item.rows.find((entry) => entry.target_date === date);
        return `<td>${row ? numberFormatter.format(toNumber(row.predicted_units_sold)) : "-"}</td>`;
      }).join("")}
      <td>${numberFormatter.format(item.value)}</td>
    </tr>
  `).join("");

  const forecastDate = state.forecast[0]?.forecast_date;
  document.querySelector("#forecast-date-label").textContent = forecastDate ? `Generated ${formatFullDate(forecastDate)}` : "Forecast date";
}

function renderInventory() {
  const inventoryRows = getDailyInventoryRows();
  const purchaseOrders = getPurchaseOrderRows();
  const wastageRows = getWastageRows();
  const forecastRows = getForecastRows();
  const inventoryTitle = document.querySelector("#inventory-primary-title");
  const inventoryTableTitle = document.querySelector("#inventory-table-title");
  const reorderTableTitle = document.querySelector("#reorder-table-title");
  document.querySelector("#inventory-range-label").textContent = getForecastRangeLabel();
  const inventoryHead = document.querySelector("#inventory-table thead");
  const inventoryBody = document.querySelector("#inventory-table tbody");
  const reorderHead = document.querySelector("#reorder-table thead");
  const reorderBody = document.querySelector("#reorder-table tbody");

  if (state.selectedProduct === "all") {
    const productSummaries = aggregateInventoryByProduct(
      state.dailyInventory,
      state.purchaseOrders,
      state.wastage,
      state.forecast,
    );
    const topReorders = productSummaries.filter((item) => item.ordered > 0).slice(0, 6);
    const wastageTotals = aggregateWastageByProduct(state.wastage);
    const weakestCoverage = productSummaries
      .map((item) => ({
        ...item,
        coveragePct: item.forecast ? Math.round((item.sold / item.forecast) * 100) : 0,
      }))
      .sort((a, b) => a.coveragePct - b.coveragePct)[0];

    inventoryTitle.textContent = "Product-wise stock overview";
    inventoryTableTitle.textContent = "Product summary across the current horizon";
    reorderTableTitle.textContent = "Choose a product to inspect its daily reorder lines";
    renderProductSummaryGrid("#inventory-closing-chart", productSummaries);

    if (!topReorders.length) {
      renderListMessage("#reorder-action-list", "Select a product to inspect its detailed reorder plan.");
    } else {
      document.querySelector("#reorder-action-list").innerHTML = topReorders.map((item, index) => `
        <div class="priority-item priority-item-${(index % 3) + 1}" data-product-id="${item.productId}" role="button" tabindex="0">
          <strong>${item.name}</strong>
          <span>${numberFormatter.format(item.ordered)} reorder units with ${numberFormatter.format(item.closing)} units left at the end of the horizon</span>
        </div>
      `).join("");
      document.querySelectorAll("#reorder-action-list [data-product-id]").forEach((node) => {
        node.addEventListener("click", () => setSelectedProduct(node.dataset.productId));
        node.addEventListener("keydown", (event) => {
          if (event.key === "Enter" || event.key === " ") {
            event.preventDefault();
            setSelectedProduct(node.dataset.productId);
          }
        });
      });
    }

    const healthSignals = [
      ["Detailed view", "Click any product card or bar to switch to its daily forecast and stock detail.", "The global product filter stays in sync with what you pick."],
      ["Biggest reorder need", topReorders[0] ? `${topReorders[0].name} needs ${numberFormatter.format(topReorders[0].ordered)} reorder units` : "No reorder is required across the current horizon.", "Use this as the first SKU to inspect."],
      ["Weakest forecast coverage", weakestCoverage ? `${weakestCoverage.name} covers ${weakestCoverage.coveragePct}% of projected demand` : "No product coverage data loaded.", "Lower coverage means the SKU is more constrained against its forecast."],
    ];
    document.querySelector("#inventory-health-list").innerHTML = healthSignals.map(([title, value, note]) => `
      <div class="signal-item">
        <strong>${title}</strong>
        <span>${value}. ${note}</span>
      </div>
    `).join("");

    renderBarList("#reorder-rank-chart", productSummaries.map((item) => ({
      productId: item.productId,
      label: item.name,
      value: item.ordered,
    })).filter((item) => item.value > 0), {
      color: "linear-gradient(90deg, var(--green), var(--teal))",
      limit: 10,
      clickable: true,
      emptyMessage: "No reorder volume to rank for the current horizon.",
    });

    if (!wastageTotals.length) {
      renderListMessage("#wastage-list", "No expiry-driven wastage is projected in this horizon.");
    } else {
      document.querySelector("#wastage-list").innerHTML = wastageTotals.slice(0, 5).map((item) => `
        <div class="signal-item" data-product-id="${item.productId}" role="button" tabindex="0">
          <strong>${item.label}</strong>
          <span>${numberFormatter.format(item.value)} units are projected to expire unsold. Click to inspect the SKU.</span>
        </div>
      `).join("");
      document.querySelectorAll("#wastage-list [data-product-id]").forEach((node) => {
        node.addEventListener("click", () => setSelectedProduct(node.dataset.productId));
        node.addEventListener("keydown", (event) => {
          if (event.key === "Enter" || event.key === " ") {
            event.preventDefault();
            setSelectedProduct(node.dataset.productId);
          }
        });
      });
    }

    inventoryHead.innerHTML = `
      <tr>
        <th>Product</th>
        <th>Forecast</th>
        <th>Sold</th>
        <th>Received</th>
        <th>Closing</th>
        <th>Ordered</th>
        <th>Wasted</th>
      </tr>
    `;
    inventoryBody.innerHTML = productSummaries.map((item) => `
      <tr class="clickable-row" data-product-id="${item.productId}">
        <td>${item.name}</td>
        <td>${numberFormatter.format(item.forecast)}</td>
        <td>${numberFormatter.format(item.sold)}</td>
        <td>${numberFormatter.format(item.received)}</td>
        <td>${numberFormatter.format(item.closing)}</td>
        <td>${numberFormatter.format(item.ordered)}</td>
        <td>${numberFormatter.format(item.wasted)}</td>
      </tr>
    `).join("") || `<tr><td colspan="7">Run the inventory simulation to populate this table.</td></tr>`;
    document.querySelectorAll("#inventory-table tbody .clickable-row").forEach((node) => {
      node.addEventListener("click", () => setSelectedProduct(node.dataset.productId));
    });

    reorderHead.innerHTML = `
      <tr>
        <th>Product</th>
        <th>Forecast</th>
        <th>Closing</th>
        <th>Total reorder</th>
      </tr>
    `;
    reorderBody.innerHTML = productSummaries.filter((item) => item.ordered > 0).map((item) => `
      <tr class="clickable-row" data-product-id="${item.productId}">
        <td>${item.name}</td>
        <td>${numberFormatter.format(item.forecast)}</td>
        <td>${numberFormatter.format(item.closing)}</td>
        <td>${numberFormatter.format(item.ordered)}</td>
      </tr>
    `).join("") || `<tr><td colspan="4">No purchase orders were generated for the current horizon.</td></tr>`;
    document.querySelectorAll("#reorder-table tbody .clickable-row").forEach((node) => {
      node.addEventListener("click", () => setSelectedProduct(node.dataset.productId));
    });
    return;
  }

  const inventorySnapshot = buildInventorySnapshot(inventoryRows, purchaseOrders, wastageRows);
  const closingPoints = inventorySnapshot.map((day) => ({ date: day.date, units: day.closing }));
  const orderTotals = aggregateOrdersByProduct(purchaseOrders);
  const wastageTotals = aggregateWastageByProduct(wastageRows);
  const totalForecastUnits = sum(forecastRows, (row) => toNumber(row.predicted_units_sold));
  const totalSoldUnits = sum(inventoryRows, (row) => toNumber(row.units_sold));
  const serviceLevel = totalForecastUnits ? Math.round((totalSoldUnits / totalForecastUnits) * 100) : 0;
  const lowestClosingDay = inventorySnapshot.slice().sort((a, b) => a.closing - b.closing)[0];
  const largestReceiptDay = inventorySnapshot.slice().sort((a, b) => b.received - a.received)[0];

  inventoryTitle.textContent = "Projected stock after daily sales";
  inventoryTableTitle.textContent = "Opening, received, sold, and closing stock";
  reorderTableTitle.textContent = "Placed reorder lines";
  renderLineChart("#inventory-closing-chart", closingPoints, {
    ariaLabel: "Projected closing stock chart",
    emptyMessage: "Run the inventory simulation to view stock movement.",
  });

  if (!purchaseOrders.length) {
    renderListMessage("#reorder-action-list", "No reorder lines were generated for this horizon.");
  } else {
    document.querySelector("#reorder-action-list").innerHTML = purchaseOrders.slice(0, 6).map((row, index) => `
      <div class="priority-item priority-item-${(index % 3) + 1}">
        <strong>${getProductName(row.product_id)}</strong>
        <span>${numberFormatter.format(toNumber(row.quantity_ordered))} units on ${formatFullDate(row.order_date)} for arrival on ${formatFullDate(addDays(row.order_date, 1))}</span>
      </div>
    `).join("");
  }

  const healthSignals = [
    ["Lowest closing stock", lowestClosingDay ? `${formatFullDate(lowestClosingDay.date)} closes at ${numberFormatter.format(lowestClosingDay.closing)} units` : "No inventory rows loaded", "Use this day as the main stockout watchpoint."],
    ["Largest receipt day", largestReceiptDay ? `${formatFullDate(largestReceiptDay.date)} receives ${numberFormatter.format(largestReceiptDay.received)} units` : "No receipts scheduled", "This is the biggest replenishment landing in the horizon."],
    ["Forecast coverage", totalForecastUnits ? `${serviceLevel}% of forecasted demand is served by projected inventory` : "No forecast baseline", "Values below 100% indicate missed demand after stock constraints."],
  ];
  document.querySelector("#inventory-health-list").innerHTML = healthSignals.map(([title, value, note]) => `
    <div class="signal-item">
      <strong>${title}</strong>
      <span>${value}. ${note}</span>
    </div>
  `).join("");

  if (!orderTotals.length) {
    renderListMessage("#reorder-rank-chart", "No reorder volume to rank for this selection.");
  } else {
    renderBarList("#reorder-rank-chart", orderTotals, {
      color: "linear-gradient(90deg, var(--green), var(--teal))",
      limit: 10,
    });
  }

  if (!wastageTotals.length) {
    renderListMessage("#wastage-list", "No expiry-driven wastage is projected in this horizon.");
  } else {
    document.querySelector("#wastage-list").innerHTML = wastageTotals.slice(0, 5).map((item) => `
      <div class="signal-item">
        <strong>${item.label}</strong>
        <span>${numberFormatter.format(item.value)} units are projected to expire unsold.</span>
      </div>
    `).join("");
  }

  inventoryHead.innerHTML = `
    <tr>
      <th>Date</th>
      <th>Opening</th>
      <th>Received</th>
      <th>Sold</th>
      <th>Closing</th>
      <th>Ordered</th>
      <th>Wasted</th>
    </tr>
  `;
  inventoryBody.innerHTML = inventorySnapshot.map((day) => `
    <tr>
      <td>${formatFullDate(day.date)}</td>
      <td>${numberFormatter.format(day.opening)}</td>
      <td>${numberFormatter.format(day.received)}</td>
      <td>${numberFormatter.format(day.sold)}</td>
      <td>${numberFormatter.format(day.closing)}</td>
      <td>${numberFormatter.format(day.ordered)}</td>
      <td>${numberFormatter.format(day.wasted)}</td>
    </tr>
  `).join("") || `<tr><td colspan="7">Run the inventory simulation to populate this table.</td></tr>`;

  reorderHead.innerHTML = `
    <tr>
      <th>Order date</th>
      <th>Arrival</th>
      <th>Product</th>
      <th>Quantity</th>
    </tr>
  `;
  reorderBody.innerHTML = purchaseOrders.map((row) => `
    <tr>
      <td>${formatFullDate(row.order_date)}</td>
      <td>${formatFullDate(addDays(row.order_date, 1))}</td>
      <td>${getProductName(row.product_id)}</td>
      <td>${numberFormatter.format(toNumber(row.quantity_ordered))}</td>
    </tr>
  `).join("") || `<tr><td colspan="4">No purchase orders were generated for this selection.</td></tr>`;
}

function renderOverview() {
  const rows = getForecastRows();
  const daily = aggregateForecastDaily(rows);
  const productTotals = aggregateForecastProduct(rows);
  const selectedLabel = state.selectedProduct === "all" ? "All products" : getProductName(state.selectedProduct);

  document.querySelector("#overview-product-label").textContent = selectedLabel;
  document.querySelector("#data-range-label").textContent = getForecastRangeLabel(rows);
  renderKpis();
  renderLineChart("#daily-sales-chart", daily, {
    ariaLabel: "Forecasted units chart",
    emptyMessage: "No forecast rows match this product.",
  });
  renderBarList("#product-rank-chart", productTotals.map((item) => ({
    label: item.name,
    value: item.units,
  })), { color: "linear-gradient(90deg, var(--blue), var(--teal))", limit: 6 });
  renderSignals();

  const forecastProduct = productTotals[0];
  const forecastLeaders = productTotals.slice(0, 2).map((item) => item.name).join(" and ");
  document.querySelector("#store-action-title").textContent = forecastProduct ? `${forecastProduct.name} is the lead forecast line` : "Plan the fresh counter";
  document.querySelector("#store-action-copy").textContent = forecastLeaders ? `${forecastLeaders} lead the current demand mix.` : "Review the forecast before stock planning.";
}

function renderAll() {
  renderPlanningWindow();
  renderOverview();
  renderSalesAnalytics();
  renderForecast();
  renderInventory();
}

function populateFilters() {
  const select = document.querySelector("#global-product-filter");
  const dateFromInput = document.querySelector("#date-from");
  const dateToInput = document.querySelector("#date-to");
  const salesDateBounds = getSalesDateBounds();

  select.innerHTML = `<option value="all">All products</option>` + state.products.map((product) => `
    <option value="${product.product_id}">${product.product_name}</option>
  `).join("");

  state.dateFrom = salesDateBounds.min;
  state.dateTo = salesDateBounds.max;
  dateFromInput.min = salesDateBounds.min;
  dateFromInput.max = salesDateBounds.max;
  dateToInput.min = salesDateBounds.min;
  dateToInput.max = salesDateBounds.max;
  dateFromInput.value = state.dateFrom;
  dateToInput.value = state.dateTo;

  select.addEventListener("change", (event) => {
    state.selectedProduct = event.target.value;
    renderAll();
  });

  dateFromInput.addEventListener("change", (event) => {
    state.dateFrom = event.target.value || salesDateBounds.min;
    if (state.dateFrom > state.dateTo) {
      state.dateTo = state.dateFrom;
      dateToInput.value = state.dateTo;
    }
    renderAll();
  });

  dateToInput.addEventListener("change", (event) => {
    state.dateTo = event.target.value || salesDateBounds.max;
    if (state.dateTo < state.dateFrom) {
      state.dateFrom = state.dateTo;
      dateFromInput.value = state.dateFrom;
    }
    renderAll();
  });
}

async function init() {
  try {
    document.querySelector("#kpi-grid").innerHTML = `<div class="loading">Loading store data.</div>`;
    const [products, sales, external, forecast, dailyInventory, purchaseOrders, wastage] = await Promise.all([
      loadCsv(DATA_PATHS.products),
      loadCsv(DATA_PATHS.sales),
      loadCsv(DATA_PATHS.external),
      loadCsv(DATA_PATHS.forecast),
      loadCsv(DATA_PATHS.dailyInventory, { optional: true }),
      loadCsv(DATA_PATHS.purchaseOrders, { optional: true }),
      loadCsv(DATA_PATHS.wastage, { optional: true }),
    ]);

    state.products = products;
    state.sales = sales;
    state.external = new Map(external.map((row) => [row.date, row]));
    state.forecast = forecast;
    state.dailyInventory = dailyInventory;
    state.purchaseOrders = purchaseOrders;
    state.wastage = wastage;
    populateFilters();
    renderAll();
  } catch (error) {
    document.querySelector(".main-content").insertAdjacentHTML("afterbegin", `
      <div class="error">
        Could not load the CSV files. Run <code>./venv/bin/python refresh_dashboard_data.py</code>, then start a local server from the repository root and open <code>/frontend/index.html</code>.
      </div>
    `);
    console.error(error);
  }
}

init();
