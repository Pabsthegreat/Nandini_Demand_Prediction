import React, { useMemo } from 'react';
import { useDashboardData } from '../context/DashboardContext';
import { useNavigate } from 'react-router-dom';
import { 
  groupBy, sum, toNumber, numberFormatter
} from '../utils/data';

export default function Inventory() {
  const { 
    dailyInventory, purchaseOrders, wastage, forecast, products, 
    loading, error 
  } = useDashboardData();
  const navigate = useNavigate();

  const productSummaries = useMemo(() => {
    const inventoryByProduct = groupBy(dailyInventory, row => row.product_id);
    const ordersByProduct = groupBy(purchaseOrders, row => row.product_id);
    const wastageByProduct = groupBy(wastage, row => row.product_id);
    const forecastByProduct = groupBy(forecast, row => row.product_id);

    return Array.from(inventoryByProduct, ([productId, items]) => {
      const sortedInventory = items.slice().sort((a, b) => a.date.localeCompare(b.date));
      const firstDay = sortedInventory[0];
      const lastDay = sortedInventory[sortedInventory.length - 1];
      const productOrders = ordersByProduct.get(productId) || [];
      const productWastage = wastageByProduct.get(productId) || [];
      const productForecast = forecastByProduct.get(productId) || [];
      
      const p = products.find(prod => prod.product_id === productId);

      return {
        productId,
        name: p ? p.product_name : productId,
        opening: toNumber(firstDay?.opening_stock),
        closing: toNumber(lastDay?.closing_stock),
        sold: sum(sortedInventory, item => toNumber(item.units_sold)),
        received: sum(sortedInventory, item => toNumber(item.stock_received)),
        ordered: sum(productOrders, item => toNumber(item.quantity_ordered)),
        wasted: sum(productWastage, item => toNumber(item.quantity_wasted)),
        forecast: sum(productForecast, item => toNumber(item.predicted_units_sold)),
      };
    }).sort((a, b) => b.forecast - a.forecast);
  }, [dailyInventory, purchaseOrders, wastage, forecast, products]);

  if (loading) return <div className="loading-state"><div className="spinner"></div><p>Loading inventory planning...</p></div>;
  if (error) return <div className="loading-state" style={{color: 'var(--accent-danger)'}}><p>Error: {error}</p></div>;

  return (
    <div className="page-wrapper">
      <div className="page-header">
        <p className="eyebrow">Inventory Planning</p>
        <h2>Stock movement and reorder plan</h2>
      </div>

      <div className="dashboard-grid">
        <div className="panel col-span-12">
          <div className="panel-header">
            <div>
              <p className="eyebrow">Closing stock</p>
              <h4>Projected stock after daily sales</h4>
            </div>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(250px, 1fr))', gap: '1rem' }}>
            {productSummaries.map(item => (
              <div 
                key={item.productId} 
                className="kpi-card" 
                style={{cursor: 'pointer'}} 
                onClick={() => navigate(`/product/${item.productId}`)}
              >
                <strong>{item.name}</strong>
                <div style={{display: 'flex', justifyContent: 'space-between', marginTop: '1rem', fontSize: '0.875rem'}}>
                  <div>
                    <span style={{display: 'block', color: 'var(--text-secondary)'}}>Forecast</span>
                    <strong style={{fontSize: '1rem'}}>{numberFormatter.format(item.forecast)}</strong>
                  </div>
                  <div>
                    <span style={{display: 'block', color: 'var(--text-secondary)'}}>Reorder</span>
                    <strong style={{fontSize: '1rem', color: 'var(--accent-secondary)'}}>{numberFormatter.format(item.ordered)}</strong>
                  </div>
                  <div>
                    <span style={{display: 'block', color: 'var(--text-secondary)'}}>Closing</span>
                    <strong style={{fontSize: '1rem', color: 'var(--accent-primary)'}}>{numberFormatter.format(item.closing)}</strong>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="panel col-span-12">
          <div className="panel-header">
            <div>
              <p className="eyebrow">Daily stock table</p>
              <h4>Opening, received, sold, and closing stock</h4>
            </div>
          </div>
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Product</th>
                  <th>Forecast</th>
                  <th>Sold</th>
                  <th>Received</th>
                  <th>Closing</th>
                  <th>Ordered</th>
                  <th>Wasted</th>
                </tr>
              </thead>
              <tbody>
                {productSummaries.map(item => (
                  <tr key={item.productId} style={{cursor: 'pointer'}} onClick={() => navigate(`/product/${item.productId}`)}>
                    <td><strong>{item.name}</strong></td>
                    <td>{numberFormatter.format(item.forecast)}</td>
                    <td>{numberFormatter.format(item.sold)}</td>
                    <td>{numberFormatter.format(item.received)}</td>
                    <td>{numberFormatter.format(item.closing)}</td>
                    <td style={{color: item.ordered > 0 ? 'var(--accent-secondary)' : 'inherit'}}>{numberFormatter.format(item.ordered)}</td>
                    <td style={{color: item.wasted > 0 ? 'var(--accent-danger)' : 'inherit'}}>{numberFormatter.format(item.wasted)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}
