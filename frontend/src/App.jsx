import React from 'react';
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { DashboardProvider } from './context/DashboardContext';
import Layout from './components/Layout';
import Overview from './pages/Overview';
import Forecast from './pages/Forecast';
import Inventory from './pages/Inventory';
import ProductDetails from './pages/ProductDetails';
import Cursor from './components/Cursor';

function App() {
  return (
    <DashboardProvider>
      <BrowserRouter>
        <Cursor />
        <Routes>
          <Route path="/" element={<Layout />}>
            <Route index element={<Overview />} />
            <Route path="forecast" element={<Forecast />} />
            <Route path="inventory" element={<Inventory />} />
            <Route path="product/:id" element={<ProductDetails />} />
          </Route>
        </Routes>
      </BrowserRouter>
    </DashboardProvider>
  );
}

export default App;
