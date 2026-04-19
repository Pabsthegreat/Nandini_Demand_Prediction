import React from 'react';
import { NavLink, Link, useNavigate, useLocation } from 'react-router-dom';
import { useDashboardData } from '../context/DashboardContext';

export default function Navbar() {
  const { products } = useDashboardData();
  const navigate = useNavigate();
  const location = useLocation();

  const match = location.pathname.match(/^\/product\/(.+)$/);
  const currentProductId = match ? match[1] : 'default';

  const handleProductSelect = (e) => {
    const value = e.target.value;
    if (value !== 'default') {
      navigate(`/product/${value}`);
    } else {
      navigate('/');
    }
  };

  return (
    <nav className="navbar">
      <div className="nav-brand">
        <div className="brand-mark">N</div>
        <div className="brand-text">
          <p className="eyebrow">Nandini Outlet</p>
          <h1><Link to="/" style={{color: 'inherit', textDecoration: 'none'}}>Demand Desk</Link></h1>
        </div>
      </div>
      
      <div className="nav-links">
        <NavLink to="/" className={({ isActive }) => `nav-link ${isActive ? 'active' : ''}`} end>
          Overview
        </NavLink>
        <NavLink to="/forecast" className={({ isActive }) => `nav-link ${isActive ? 'active' : ''}`}>
          Forecast Details
        </NavLink>
        <NavLink to="/inventory" className={({ isActive }) => `nav-link ${isActive ? 'active' : ''}`}>
          Inventory Planning
        </NavLink>
      </div>

      <div className="controls-area">
        <label htmlFor="global-product-filter" className="eyebrow" style={{marginBottom: 0, marginRight: '0.5rem'}}>View Product:</label>
        <select 
          id="global-product-filter"
          value={currentProductId}
          onChange={handleProductSelect}
        >
          <option value="default" disabled={currentProductId !== 'default'}>Select to view details...</option>
          {products.map(product => (
            <option key={product.product_id} value={product.product_id}>
              {product.product_name}
            </option>
          ))}
        </select>
      </div>
    </nav>
  );
}
