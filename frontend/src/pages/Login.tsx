import React, { useState } from 'react';
import axios from 'axios';
import { useNavigate } from 'react-router-dom';
import { FileText, Loader2 } from 'lucide-react';

export const Login = () => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const navigate = useNavigate();

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setError('');

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
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#F5F6F8] flex items-center justify-center p-4">
      <div className="bg-white p-8 rounded-lg shadow-md w-full max-w-md border border-gray-100">
        <div className="flex items-center gap-2 mb-6 justify-center">
          <FileText className="w-8 h-8 text-primary" aria-hidden="true" />
          <span className="text-xl font-bold text-gray-800">CIC DocFlow</span>
        </div>

        <h2 className="text-2xl font-bold mb-6 text-center text-gray-900">Вход в систему</h2>

        {error && (
          <div
            className="bg-red-50 border border-red-100 text-red-600 p-3 rounded mb-4 text-sm flex items-start gap-2"
            role="alert"
            aria-live="assertive"
          >
            <span>{error}</span>
          </div>
        )}

        <form onSubmit={handleLogin} className="space-y-4">
          <div>
            <label htmlFor="email" className="block text-sm font-medium text-gray-700 mb-1">
              Email
            </label>
            <input
              id="email"
              type="text" // Changed from email to text based on original file, but ideally should be email. Keeping text to avoid breaking validation if username is allowed.
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full px-4 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent transition-shadow"
              placeholder="name@company.com"
              required
              autoComplete="email"
            />
          </div>
          <div>
            <label htmlFor="password" className="block text-sm font-medium text-gray-700 mb-1">
              Пароль
            </label>
            <input
              id="password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full px-4 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent transition-shadow"
              placeholder="••••••••"
              required
              autoComplete="current-password"
            />
          </div>
          <button
            type="submit"
            className="w-full bg-primary text-white py-2 rounded-md hover:bg-primary-light transition-colors flex justify-center items-center gap-2 disabled:opacity-70 disabled:cursor-not-allowed focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary"
            disabled={isLoading}
            aria-busy={isLoading}
          >
            {isLoading ? (
              <>
                <Loader2 className="w-5 h-5 animate-spin" aria-hidden="true" />
                <span>Вход...</span>
              </>
            ) : (
              'Войти'
            )}
          </button>
        </form>
      </div>
    </div>
  );
};
