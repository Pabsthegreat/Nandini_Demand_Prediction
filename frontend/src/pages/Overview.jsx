import React, { useMemo } from 'react';
import { useDashboardData } from '../context/DashboardContext';
import { 
  toNumber, 
  groupBy, 
  sum, 
  average, 
  formatDate, 
  formatFullDate,
  moneyFormatter,
  numberFormatter
} from '../utils/data';
import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  BarChart, Bar
} from 'recharts';
import { TrendingUp, Package, Calendar, DollarSign, Activity } from 'lucide-react';

export default function Overview() {
  const { forecast, products, loading, error } = useDashboardData();

  const filteredForecast = useMemo(() => {
    return [...forecast].sort((a, b) => a.target_date.localeCompare(b.target_date));
  }, [forecast]);

  const kpis = useMemo(() => {
    if (!filteredForecast.length) return null;

    const totalUnits = sum(filteredForecast, row => toNumber(row.predicted_units_sold));
    
    // Revenue
    const revenue = sum(filteredForecast, row => {
      const p = products.find(p => p.product_id === row.product_id);
      const price = toNumber(p?.selling_price);
      return toNumber(row.predicted_units_sold) * price;
    });

    // Daily Avg
    const groupedByDate = groupBy(filteredForecast, row => row.target_date);
    const dailyTotals = Array.from(groupedByDate, ([date, items]) => ({
      date,
      units: sum(items, item => toNumber(item.predicted_units_sold))
    }));
    const avgDaily = Math.round(average(dailyTotals.map(d => d.units)));

    // Top Product
    const groupedByProduct = groupBy(filteredForecast, row => row.product_id);
    const productTotals = Array.from(groupedByProduct, ([productId, items]) => {
      const p = products.find(prod => prod.product_id === productId);
      return {
        name: p ? p.product_name : productId,
        units: sum(items, item => toNumber(item.predicted_units_sold))
      };
    }).sort((a, b) => b.units - a.units);
    
    const dates = Array.from(groupedByDate.keys()).sort();
    const rangeLabel = dates.length ? `${formatFullDate(dates[0])} to ${formatFullDate(dates[dates.length - 1])}` : 'N/A';
    const forecastDate = forecast[0]?.forecast_date;

    return {
      totalUnits,
      revenue,
      avgDaily,
      topProduct: productTotals[0],
      rangeLabel,
      runDate: forecastDate ? formatFullDate(forecastDate) : 'Pending'
    };
  }, [filteredForecast, products, forecast]);

  const dailyChartData = useMemo(() => {
    const grouped = groupBy(filteredForecast, row => row.target_date);
    return Array.from(grouped, ([date, items]) => ({
      date,
      displayDate: formatDate(date),
      units: sum(items, item => toNumber(item.predicted_units_sold))
    })).sort((a, b) => a.date.localeCompare(b.date));
  }, [filteredForecast]);

  const productRankData = useMemo(() => {
    const grouped = groupBy(filteredForecast, row => row.product_id);
    return Array.from(grouped, ([productId, items]) => {
      const p = products.find(prod => prod.product_id === productId);
      return {
        name: p ? p.product_name : productId,
        units: sum(items, item => toNumber(item.predicted_units_sold))
      };
    }).sort((a, b) => b.units - a.units).slice(0, 5);
  }, [filteredForecast, products]);

  if (loading) return <div className="loading-state"><div className="spinner"></div><p>Loading overview data...</p></div>;
  if (error) return <div className="loading-state" style={{color: 'var(--accent-danger)'}}><p>Error: {error}</p></div>;

  return (
    <div className="page-wrapper">
      <div className="page-header">
        <p className="eyebrow">Forecast Overview</p>
        <h2>Current demand plan</h2>
      </div>

      {kpis ? (
        <div className="kpi-grid">
          <div className="kpi-card" style={{'--card-color': 'var(--accent-primary)'}}>
            <Package size={20} color="var(--accent-primary)" style={{marginBottom: '0.5rem'}}/>
            <p className="eyebrow">Forecast units</p>
            <strong>{numberFormatter.format(kpis.totalUnits)}</strong>
            <span>{kpis.rangeLabel}</span>
          </div>
          <div className="kpi-card" style={{'--card-color': 'var(--accent-secondary)'}}>
            <DollarSign size={20} color="var(--accent-secondary)" style={{marginBottom: '0.5rem'}}/>
            <p className="eyebrow">Expected revenue</p>
            <strong>{moneyFormatter.format(kpis.revenue)}</strong>
            <span>Using product prices</span>
          </div>
          <div className="kpi-card" style={{'--card-color': 'var(--accent-warning)'}}>
            <TrendingUp size={20} color="var(--accent-warning)" style={{marginBottom: '0.5rem'}}/>
            <p className="eyebrow">Top forecast SKU</p>
            <strong>{kpis.topProduct?.name || 'N/A'}</strong>
            <span>{numberFormatter.format(kpis.topProduct?.units || 0)} predicted units</span>
          </div>
          <div className="kpi-card" style={{'--card-color': 'var(--accent-danger)'}}>
            <Activity size={20} color="var(--accent-danger)" style={{marginBottom: '0.5rem'}}/>
            <p className="eyebrow">Avg daily forecast</p>
            <strong>{numberFormatter.format(kpis.avgDaily)}</strong>
            <span>Predicted units per day</span>
          </div>
          <div className="kpi-card" style={{'--card-color': 'var(--accent-purple)'}}>
            <Calendar size={20} color="var(--accent-purple)" style={{marginBottom: '0.5rem'}}/>
            <p className="eyebrow">Model run</p>
            <strong>{kpis.runDate}</strong>
            <span>Active horizon</span>
          </div>
        </div>
      ) : (
        <div className="empty-state">No forecast data available.</div>
      )}

      <div className="dashboard-grid">
        <div className="panel col-span-8">
          <div className="panel-header">
            <div>
              <p className="eyebrow">Forecast source</p>
              <h4>Forecasted daily units</h4>
            </div>
          </div>
          <div className="chart-container">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={dailyChartData} margin={{ top: 10, right: 30, left: 0, bottom: 0 }}>
                <defs>
                  <linearGradient id="colorUnits" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="var(--accent-primary)" stopOpacity={0.8}/>
                    <stop offset="95%" stopColor="var(--accent-primary)" stopOpacity={0}/>
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--border-color)" vertical={false} />
                <XAxis dataKey="displayDate" stroke="var(--text-secondary)" tick={{fontSize: 12}} dy={10} />
                <YAxis stroke="var(--text-secondary)" tick={{fontSize: 12}} dx={-10} />
                <Tooltip 
                  contentStyle={{backgroundColor: 'var(--bg-tertiary)', border: 'none', borderRadius: '8px', color: '#fff'}}
                  itemStyle={{color: 'var(--accent-primary)'}}
                />
                <Area type="monotone" dataKey="units" stroke="var(--accent-primary)" fillOpacity={1} fill="url(#colorUnits)" strokeWidth={3} />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="panel col-span-4">
          <div className="panel-header">
            <div>
              <p className="eyebrow">Forecast rank</p>
              <h4>Top predicted demand</h4>
            </div>
          </div>
          <div className="chart-container">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={productRankData} layout="vertical" margin={{ top: 0, right: 0, left: 0, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--border-color)" horizontal={true} vertical={false}/>
                <XAxis type="number" stroke="var(--text-secondary)" tick={{fontSize: 12}} />
                <YAxis dataKey="name" type="category" stroke="var(--text-secondary)" tick={{fontSize: 12}} width={100} />
                <Tooltip 
                  contentStyle={{backgroundColor: 'var(--bg-tertiary)', border: 'none', borderRadius: '8px'}}
                  cursor={{fill: 'var(--bg-tertiary)'}}
                />
                <Bar dataKey="units" fill="var(--accent-secondary)" radius={[0, 4, 4, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>
    </div>
  );
}
