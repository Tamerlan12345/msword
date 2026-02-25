import React from 'react';
import { Bell, FileText, LogOut, Settings, BarChart } from 'lucide-react';
import { useNavigate, Link } from 'react-router-dom';

export const Header = () => {
  const navigate = useNavigate();
  // Читаем пользователя из локального хранилища
  const userString = localStorage.getItem('user');
  const user = userString ? JSON.parse(userString) : { name: 'User' };

  const handleLogout = () => {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    window.location.href = '/login';
  };

  return (
    <header className="h-16 bg-white border-b border-gray-200 flex items-center justify-between px-4 sm:px-6 fixed w-full top-0 z-50 transition-all">
      <Link
        to="/"
        className="flex items-center gap-2 outline-none rounded-md focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2"
        aria-label="На главную"
      >
        <FileText className="w-6 h-6 text-primary" aria-hidden="true" />
        <span className="text-lg font-bold text-gray-800 truncate max-w-[150px] sm:max-w-none">CIC DocFlow</span>
      </Link>

      <div className="flex items-center gap-2 sm:gap-4">
        {/* Если админ - показываем кнопку админки и метрик */}
        {user.role === 'ADMIN' && (
          <>
            <button
              onClick={() => navigate('/metrics')}
              className="p-2 text-gray-600 hover:text-primary hover:bg-gray-100 rounded-full focus-visible:ring-2 focus-visible:ring-primary outline-none transition-colors"
              title="Метрики"
              aria-label="Перейти к метрикам"
            >
              <BarChart className="w-5 h-5" aria-hidden="true" />
            </button>
            <button
              onClick={() => navigate('/admin')}
              className="p-2 text-gray-600 hover:text-primary hover:bg-gray-100 rounded-full focus-visible:ring-2 focus-visible:ring-primary outline-none transition-colors"
              title="Админ панель"
              aria-label="Перейти в панель администратора"
            >
              <Settings className="w-5 h-5" aria-hidden="true" />
            </button>
          </>
        )}

        <Link
          to="/profile"
          className="flex items-center gap-2 p-1 pr-2 hover:bg-gray-100 rounded transition-colors focus-visible:ring-2 focus-visible:ring-primary outline-none"
          title="Профиль"
          aria-label={`Профиль пользователя ${user.name}`}
        >
          <div className="w-8 h-8 bg-primary/10 rounded-full flex items-center justify-center text-primary font-medium text-sm shrink-0" aria-hidden="true">
            {user.name.substring(0, 2).toUpperCase()}
          </div>
          <span className="text-sm font-medium text-gray-700 hidden sm:inline-block max-w-[100px] truncate">{user.name}</span>
        </Link>

        <button
          onClick={handleLogout}
          className="p-2 hover:bg-red-50 text-gray-400 hover:text-red-500 rounded-full transition-colors focus-visible:ring-2 focus-visible:ring-red-500 outline-none"
          title="Выйти"
          aria-label="Выйти из системы"
        >
          <LogOut className="w-5 h-5" aria-hidden="true" />
        </button>
      </div>
    </header>
  );
};
