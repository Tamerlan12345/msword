import React from 'react';
import { Bell, Search, FileText, LogOut, Settings } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

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
    <header className="h-16 bg-white border-b border-gray-200 flex items-center justify-between px-6 fixed w-full top-0 z-50">
      <div className="flex items-center gap-2 cursor-pointer" onClick={() => navigate('/')}>
        <FileText className="w-6 h-6 text-primary" />
        <span className="text-lg font-bold text-gray-800">CIC DocFlow</span>
      </div>

      <div className="flex-1 max-w-xl mx-8">
        {/* Поиск пока заглушка */}
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <input
            type="text"
            placeholder="Поиск документов..."
            className="w-full pl-10 pr-4 py-2 border border-gray-200 rounded-md focus:outline-none focus:ring-2 focus:ring-primary/50 text-sm"
          />
        </div>
      </div>

      <div className="flex items-center gap-4">
        {/* Если админ - показываем кнопку админки */}
        {user.role === 'ADMIN' && (
          <button
            onClick={() => navigate('/admin')}
            className="p-2 text-gray-600 hover:text-primary hover:bg-gray-100 rounded-full"
            title="Админ панель"
          >
            <Settings className="w-5 h-5" />
          </button>
        )}

        <div
          className="flex items-center gap-2 p-1 pr-2 cursor-pointer hover:bg-gray-100 rounded transition-colors"
          onClick={() => navigate('/profile')}
          title="Профиль"
        >
          <div className="w-8 h-8 bg-primary/10 rounded-full flex items-center justify-center text-primary font-medium text-sm">
            {user.name.substring(0, 2).toUpperCase()}
          </div>
          <span className="text-sm font-medium text-gray-700">{user.name}</span>
        </div>

        <button
          onClick={handleLogout}
          className="p-2 hover:bg-red-50 text-gray-400 hover:text-red-500 rounded-full transition-colors"
          title="Выйти"
        >
          <LogOut className="w-5 h-5" />
        </button>
      </div>
    </header>
  );
};
