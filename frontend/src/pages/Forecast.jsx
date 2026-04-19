import React, { useMemo } from 'react';
import { useDashboardData } from '../context/DashboardContext';
import { groupBy, sum, toNumber, numberFormatter, formatDate } from '../utils/data';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';

export default function Forecast() {
  const { forecast, products, loading, error } = useDashboardData();

  const filteredForecast = useMemo(() => {
    return [...forecast].sort((a, b) => a.target_date.localeCompare(b.target_date));
  }, [forecast]);

  const dates = useMemo(() => {
    return [...new Set(filteredForecast.map(row => row.target_date))].sort();
  }, [filteredForecast]);

  const productTotals = useMemo(() => {
    const grouped = groupBy(filteredForecast, row => row.product_id);
    return Array.from(grouped, ([productId, items]) => {
      const p = products.find(prod => prod.product_id === productId);
      return {
        productId,
        name: p ? p.product_name : productId,
        total: sum(items, item => toNumber(item.predicted_units_sold)),
        rows: items
      };
    }).sort((a, b) => b.total - a.total);
  }, [filteredForecast, products]);

  if (loading) return <div className="loading-state"><div className="spinner"></div><p>Loading forecast details...</p></div>;
  if (error) return <div className="loading-state" style={{color: 'var(--accent-danger)'}}><p>Error: {error}</p></div>;

  return (
    <div className="page-wrapper">
      <div className="page-header">
        <p className="eyebrow">Forecast Details</p>
        <h2>Current forecast by SKU</h2>
      </div>

      <div className="dashboard-grid">
        <div className="panel col-span-8">
          <div className="panel-header">
            <div>
              <p className="eyebrow">Current horizon</p>
              <h4>Forecast total by product</h4>
            </div>
          </div>
          <div className="chart-container" style={{height: '350px'}}>
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={productTotals.slice(0, 10)} margin={{ top: 10, right: 30, left: 0, bottom: 20 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--border-color)" vertical={false} />
                <XAxis dataKey="name" stroke="var(--text-secondary)" tick={{fontSize: 12}} angle={-45} textAnchor="end" height={60}/>
                <YAxis stroke="var(--text-secondary)" tick={{fontSize: 12}} />
                <Tooltip 
                  contentStyle={{backgroundColor: 'var(--bg-tertiary)', border: 'none', borderRadius: '8px'}}
                  cursor={{fill: 'var(--bg-tertiary)'}}
                />
                <Bar dataKey="total" fill="var(--accent-primary)" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="panel col-span-4">
          <div className="panel-header">
            <div>
              <p className="eyebrow">Stock focus</p>
              <h4>High expected demand</h4>
            </div>
          </div>
          <div>
            {productTotals.slice(0, 4).map((item, index) => (
              <div key={item.productId} className="signal-item" style={{borderLeft: `4px solid var(--accent-${index === 0 ? 'primary' : index === 1 ? 'secondary' : index === 2 ? 'warning' : 'purple'})`}}>
                <strong>{item.name}</strong>
                <span>{numberFormatter.format(item.total)} predicted units</span>
              </div>
            ))}
          </div>
        </div>

        <div className="panel col-span-12">
          <div className="panel-header">
            <div>
              <p className="eyebrow">Daily forecast</p>
              <h4>Predicted units sold</h4>
            </div>
          </div>
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Product</th>
                  {dates.map(date => (
                    <th key={date}>{formatDate(date)}</th>
                  ))}
                  <th>Total</th>
                </tr>
              </thead>
              <tbody>
                {productTotals.map(item => (
                  <tr key={item.productId}>
                    <td><strong>{item.name}</strong></td>
                    {dates.map(date => {
                      const dayRow = item.rows.find(r => r.target_date === date);
                      return (
                        <td key={date}>
                          {dayRow ? numberFormatter.format(toNumber(dayRow.predicted_units_sold)) : '-'}
                        </td>
                      );
                    })}
                    <td><strong>{numberFormatter.format(item.total)}</strong></td>
                  </tr>
                ))}
                {productTotals.length === 0 && (
                  <tr>
                    <td colSpan={dates.length + 2} style={{textAlign: 'center'}}>No data available</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}
