import React, { useEffect } from 'react';
import { BrowserRouter, Routes, Route, Navigate, useNavigate } from 'react-router-dom';
import { Dashboard } from './pages/Dashboard';
import { Login } from './pages/Login';
import { Admin } from './pages/Admin';
import { DocumentDetail } from './pages/DocumentDetail';
import { Profile } from './pages/Profile';
import axios from 'axios';

// Компонент защиты роутов
const ProtectedRoute = ({ children }: { children: React.ReactNode }) => {
  const token = localStorage.getItem('token');
  if (!token) return <Navigate to="/login" replace />;
  return <>{children}</>;
};

const AppContent = () => {
  const navigate = useNavigate();

  useEffect(() => {
    // Axios мы уже настроили в main.tsx, здесь только проверяем наличие токена
    const token = localStorage.getItem('token');

    // Если токена нет и мы не на странице логина - редирект
    if (!token && window.location.pathname !== '/login') {
      navigate('/login');
    }
  }, [navigate]);

  return (
    <Routes>
      <Route path="/login" element={<Login />} />
      <Route path="/" element={<ProtectedRoute><Dashboard /></ProtectedRoute>} />
      <Route path="/profile" element={<ProtectedRoute><Profile /></ProtectedRoute>} />
      <Route path="/documents/:id" element={<ProtectedRoute><DocumentDetail /></ProtectedRoute>} />
      <Route path="/admin" element={<ProtectedRoute><Admin /></ProtectedRoute>} />
    </Routes>
  );
};

export default function App() {
  return (
    <BrowserRouter>
      <AppContent />
    </BrowserRouter>
  );
}
