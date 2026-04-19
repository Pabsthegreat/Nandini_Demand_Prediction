import React, { useMemo } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useDashboardData } from '../context/DashboardContext';
import { 
  groupBy, sum, toNumber, numberFormatter, formatFullDate 
} from '../utils/data';
import { 
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer 
} from 'recharts';
import { ArrowLeft } from 'lucide-react';

export default function ProductDetails() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { 
    dailyInventory, purchaseOrders, wastage, products, 
    loading, error 
  } = useDashboardData();

  const product = useMemo(() => products.find(p => p.product_id === id), [products, id]);

  const specificProductData = useMemo(() => {
    if (!id || dailyInventory.length === 0) return null;

    const inventoryRows = dailyInventory.filter(row => row.product_id === id)
                                        .sort((a, b) => a.date.localeCompare(b.date));
    const orderRows = purchaseOrders.filter(row => row.product_id === id);
    const wastageRows = wastage.filter(row => row.product_id === id);
    
    const orderByDate = groupBy(orderRows, row => row.order_date);
    const wasteByDate = groupBy(wastageRows, row => row.date);

    const snapshot = inventoryRows.map(day => ({
      date: day.date,
      displayDate: formatFullDate(day.date),
      opening: toNumber(day.opening_stock),
      received: toNumber(day.stock_received),
      sold: toNumber(day.units_sold),
      closing: toNumber(day.closing_stock),
      ordered: sum(orderByDate.get(day.date) || [], item => toNumber(item.quantity_ordered)),
      wasted: sum(wasteByDate.get(day.date) || [], item => toNumber(item.quantity_wasted)),
    }));

    return {
      snapshot,
      orderRows: orderRows.sort((a, b) => a.order_date.localeCompare(b.order_date))
    };
  }, [id, dailyInventory, purchaseOrders, wastage]);

  if (loading) return <div className="loading-state"><div className="spinner"></div><p>Loading product details...</p></div>;
  if (error) return <div className="loading-state" style={{color: 'var(--accent-danger)'}}><p>Error: {error}</p></div>;
  if (!product) return <div className="empty-state">Product not found.</div>;

  return (
    <div className="page-wrapper">
      <div className="page-header" style={{display: 'flex', alignItems: 'center', gap: '1rem'}}>
        <button onClick={() => navigate(-1)} style={{background: 'none', border: 'none', color: 'var(--text-secondary)', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '0.5rem'}}>
          <ArrowLeft size={20} /> Back
        </button>
        <div>
          <p className="eyebrow">Product Details</p>
          <h2>{product.product_name}</h2>
        </div>
      </div>

      {specificProductData && (
        <div className="dashboard-grid">
          <div className="panel col-span-8">
            <div className="panel-header">
              <div>
                <p className="eyebrow">Closing stock trend</p>
                <h4>Projected stock over horizon</h4>
              </div>
            </div>
            <div className="chart-container">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={specificProductData.snapshot} margin={{ top: 10, right: 30, left: 0, bottom: 20 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--border-color)" vertical={false} />
                  <XAxis dataKey="displayDate" stroke="var(--text-secondary)" tick={{fontSize: 12}} />
                  <YAxis stroke="var(--text-secondary)" tick={{fontSize: 12}} />
                  <Tooltip 
                    contentStyle={{backgroundColor: 'var(--bg-tertiary)', border: 'none', borderRadius: '8px'}}
                  />
                  <Line type="monotone" dataKey="closing" stroke="var(--accent-primary)" strokeWidth={3} dot={{r: 4, fill: 'var(--accent-primary)'}} activeDot={{r: 8}} />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </div>

          <div className="panel col-span-4">
            <div className="panel-header">
              <div>
                <p className="eyebrow">Reorder actions</p>
                <h4>What to order next</h4>
              </div>
            </div>
            <div>
              {specificProductData.orderRows.length === 0 ? (
                <div className="empty-state" style={{minHeight: '100px'}}>No reorder lines generated.</div>
              ) : (
                specificProductData.orderRows.map((row, i) => (
                  <div key={i} className="signal-item" style={{borderLeft: '4px solid var(--accent-secondary)'}}>
                    <strong>{formatFullDate(row.order_date)}</strong>
                    <span>Order {numberFormatter.format(toNumber(row.quantity_ordered))} units</span>
                  </div>
                ))
              )}
            </div>
          </div>

          <div className="panel col-span-12">
            <div className="panel-header">
              <div>
                <p className="eyebrow">Detailed daily stock</p>
                <h4>Day by day breakdown</h4>
              </div>
            </div>
            <div className="table-wrap">
              <table>
                <thead>
                  <tr>
                    <th>Date</th>
                    <th>Opening</th>
                    <th>Received</th>
                    <th>Sold</th>
                    <th>Closing</th>
                    <th>Ordered</th>
                    <th>Wasted</th>
                  </tr>
                </thead>
                <tbody>
                  {specificProductData.snapshot.map(day => (
                    <tr key={day.date}>
                      <td><strong>{day.displayDate}</strong></td>
                      <td>{numberFormatter.format(day.opening)}</td>
                      <td>{numberFormatter.format(day.received)}</td>
                      <td>{numberFormatter.format(day.sold)}</td>
                      <td>{numberFormatter.format(day.closing)}</td>
                      <td style={{color: day.ordered > 0 ? 'var(--accent-secondary)' : 'inherit'}}>{numberFormatter.format(day.ordered)}</td>
                      <td style={{color: day.wasted > 0 ? 'var(--accent-danger)' : 'inherit'}}>{numberFormatter.format(day.wasted)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
