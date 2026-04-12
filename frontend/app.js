const DATA_PATHS = {
  sales: "/data/daily_sales.csv",
  external: "/data/external_factors.csv",
  forecast: "/data/forecast_results.csv",
  products: "/data/products.csv",
};

const state = {
  products: [],
  sales: [],
  external: new Map(),
  forecast: [],
  selectedProduct: "all",
  dateFrom: "2025-01-01",
  dateTo: "2025-12-31",
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

async function loadCsv(path) {
  const response = await fetch(path);
  if (!response.ok) {
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

function getFilteredSales() {
  return state.sales.filter((row) => {
    const productMatch = state.selectedProduct === "all" || row.product_id === state.selectedProduct;
    return productMatch && row.date >= state.dateFrom && row.date <= state.dateTo;
  });
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
  const max = Math.max(...items.map((item) => item.value), 1);
  const color = options.color || "var(--blue)";
  const suffix = options.suffix || "";
  const limit = options.limit || items.length;

  target.innerHTML = items.slice(0, limit).map((item) => `
    <div class="bar-row">
      <div class="bar-label">
        <span>${item.label}</span>
        <span>${numberFormatter.format(Math.round(item.value))}${suffix}</span>
      </div>
      <div class="bar-track">
        <div class="bar-fill" style="--bar-width: ${(item.value / max) * 100}%; background: ${color};"></div>
      </div>
    </div>
  `).join("");
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

  renderBarList("#forecast-rank-chart", totals, { color: "linear-gradient(90deg, var(--teal), var(--blue))", limit: 10 });
  document.querySelector("#forecast-priority-list").innerHTML = totals.slice(0, 3).map((item, index) => `
    <div class="priority-item priority-item-${index + 1}">
      <strong>${item.label}</strong>
      <span>${numberFormatter.format(item.value)} predicted units across 7 days</span>
    </div>
  `).join("");

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

function renderOverview() {
  const rows = getForecastRows();
  const daily = aggregateForecastDaily(rows);
  const productTotals = aggregateForecastProduct(rows);
  const selectedLabel = state.selectedProduct === "all" ? "All products" : getProductName(state.selectedProduct);

  document.querySelector("#overview-product-label").textContent = selectedLabel;
  document.querySelector("#data-range-label").textContent = getForecastRangeLabel(rows);
  renderKpis();
  renderLineChart("#daily-sales-chart", daily, {
    ariaLabel: "7-day forecasted units chart",
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
  document.querySelector("#store-action-copy").textContent = forecastLeaders ? `${forecastLeaders} lead the next 7-day demand mix.` : "Review the forecast before stock planning.";
}

function renderAll() {
  renderOverview();
  renderSalesAnalytics();
  renderForecast();
}

function populateFilters() {
  const select = document.querySelector("#global-product-filter");
  select.innerHTML = `<option value="all">All products</option>` + state.products.map((product) => `
    <option value="${product.product_id}">${product.product_name}</option>
  `).join("");

  select.addEventListener("change", (event) => {
    state.selectedProduct = event.target.value;
    renderAll();
  });

  document.querySelector("#date-from").addEventListener("change", (event) => {
    state.dateFrom = event.target.value || "2025-01-01";
    if (state.dateFrom > state.dateTo) {
      state.dateTo = state.dateFrom;
      document.querySelector("#date-to").value = state.dateTo;
    }
    renderAll();
  });

  document.querySelector("#date-to").addEventListener("change", (event) => {
    state.dateTo = event.target.value || "2025-12-31";
    if (state.dateTo < state.dateFrom) {
      state.dateFrom = state.dateTo;
      document.querySelector("#date-from").value = state.dateFrom;
    }
    renderAll();
  });
}

async function init() {
  try {
    document.querySelector("#kpi-grid").innerHTML = `<div class="loading">Loading store data.</div>`;
    const [products, sales, external, forecast] = await Promise.all([
      loadCsv(DATA_PATHS.products),
      loadCsv(DATA_PATHS.sales),
      loadCsv(DATA_PATHS.external),
      loadCsv(DATA_PATHS.forecast),
    ]);

    state.products = products;
    state.sales = sales;
    state.external = new Map(external.map((row) => [row.date, row]));
    state.forecast = forecast;
    populateFilters();
    renderAll();
  } catch (error) {
    document.querySelector(".main-content").insertAdjacentHTML("afterbegin", `
      <div class="error">
        Could not load the CSV files. Start a local server from the repository root and open /frontend/index.html.
      </div>
    `);
    console.error(error);
  }
}

init();
