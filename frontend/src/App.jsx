import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import Login from './pages/Login';
import DashboardStokis from './pages/DashboardStokis';
import DashboardSubstokis from './pages/DashboardSubstokis';
import './index.css';

function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/login" element={<Login />} />

        {/* Protected Dashboard Route for Stokis. Later expanded for other roles */}
        <Route path="/dashboard/stokis" element={<DashboardStokis />} />
        <Route path="/dashboard/substokis" element={<DashboardSubstokis />} />

        {/* Default route redirects to login */}
        <Route path="/" element={<Navigate to="/login" replace />} />

        {/* Catch-all */}
        <Route path="*" element={<Navigate to="/login" replace />} />
      </Routes>
    </BrowserRouter>
  );
}

export default App;
