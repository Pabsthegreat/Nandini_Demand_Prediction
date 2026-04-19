import React, { createContext, useContext, useState, useEffect, useMemo } from 'react';

const DashboardContext = createContext();

export function useDashboardData() {
  return useContext(DashboardContext);
}

export function DashboardProvider({ children }) {
  const [data, setData] = useState({
    products: [],
    forecast: [],
    dailyInventory: [],
    purchaseOrders: [],
    wastage: []
  });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    async function fetchData() {
      try {
        setLoading(true);
        const response = await fetch('/data.json');
        if (!response.ok) {
          throw new Error('Network response was not ok');
        }
        const json = await response.json();
        setData({
          products: json.products || [],
          forecast: json.forecast || [],
          dailyInventory: json.dailyInventory || [],
          purchaseOrders: json.purchaseOrders || [],
          wastage: json.wastage || []
        });
      } catch (err) {
        setError(err.message || "Failed to fetch data.");
      } finally {
        setLoading(false);
      }
    }
    fetchData();
  }, []);

  const value = {
    ...data,
    loading,
    error
  };

  return (
    <DashboardContext.Provider value={value}>
      {children}
    </DashboardContext.Provider>
  );
}
