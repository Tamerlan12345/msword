import React, { useState } from 'react';
import axios from 'axios';
import { useNavigate } from 'react-router-dom';
import { FileText } from 'lucide-react';

export const Login = () => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const navigate = useNavigate();

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      // Отправляем запрос на вход
      const res = await axios.post('/api/auth/login', { email, password });

      // Сохраняем токен и данные пользователя
      localStorage.setItem('token', res.data.token);
      localStorage.setItem('user', JSON.stringify(res.data.user));

      // Настраиваем заголовок по умолчанию для будущих запросов
      axios.defaults.headers.common['Authorization'] = `Bearer ${res.data.token}`;

      navigate('/'); // Переход на главную
    } catch (err) {
      setError('Ошибка входа. Проверьте логин и пароль.');
    }
  };

  return (
    <div className="min-h-screen bg-[#F5F6F8] flex items-center justify-center">
      <div className="bg-white p-8 rounded-lg shadow-md w-full max-w-md">
        <div className="flex items-center gap-2 mb-6 justify-center">
          <FileText className="w-8 h-8 text-primary" />
          <span className="text-xl font-bold text-gray-800">CIC DocFlow</span>
        </div>

        <h2 className="text-2xl font-bold mb-6 text-center">Вход в систему</h2>

        {error && <div className="bg-red-50 text-red-500 p-3 rounded mb-4 text-sm">{error}</div>}

        <form onSubmit={handleLogin} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700">Email</label>
            <input
              type="text"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="mt-1 w-full px-4 py-2 border rounded-md focus:ring-2 focus:ring-primary"
              placeholder="veronik7@admin.com"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700">Пароль</label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="mt-1 w-full px-4 py-2 border rounded-md focus:ring-2 focus:ring-primary"
              placeholder="••••••••"
            />
          </div>
          <button type="submit" className="w-full bg-primary text-white py-2 rounded-md hover:bg-primary-light transition">
            Войти
          </button>
        </form>
      </div>
    </div>
  );
};
