import React, { useState } from 'react';
import axios from 'axios';
import { Header } from '../components/Header';
import { UserPlus, Loader2, AlertCircle, CheckCircle } from 'lucide-react';
import { clsx } from 'clsx';

export const Admin = () => {
  const [formData, setFormData] = useState({ name: '', email: '', password: '', role: 'APPROVER' });
  const [msg, setMsg] = useState<{ type: 'success' | 'error', text: string } | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setMsg(null);
    try {
      await axios.post('/api/users', formData);
      setMsg({ type: 'success', text: 'Пользователь успешно создан!' });
      setFormData({ name: '', email: '', password: '', role: 'APPROVER' });
    } catch (error) {
      setMsg({ type: 'error', text: 'Ошибка при создании пользователя.' });
    } finally {
        setIsLoading(false);
    }
  };

  const inputClass = "w-full px-4 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent transition-shadow disabled:bg-gray-50 disabled:text-gray-500";
  const labelClass = "block text-sm font-medium text-gray-700 mb-1";

  return (
    <div className="min-h-screen pt-16 bg-[#F5F6F8]">
      <Header />
      <div className="max-w-2xl mx-auto px-6 py-8">
        <div className="flex items-center gap-2 mb-6">
            <UserPlus className="w-6 h-6 text-primary" aria-hidden="true" />
            <h1 className="text-2xl font-bold text-gray-900">Создание пользователя</h1>
        </div>

        {msg && (
          <div
            className={clsx(
                "p-4 rounded-md mb-6 flex items-start gap-2 border shadow-sm",
                msg.type === 'success' ? 'bg-green-50 border-green-200 text-green-800' : 'bg-red-50 border-red-200 text-red-800'
            )}
            role="alert"
            aria-live="polite"
          >
            {msg.type === 'success' ? (
                <CheckCircle className="w-5 h-5 shrink-0" aria-hidden="true" />
            ) : (
                <AlertCircle className="w-5 h-5 shrink-0" aria-hidden="true" />
            )}
            <span>{msg.text}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} className="bg-white p-6 rounded-lg shadow-sm border border-gray-100 space-y-4">
          <div>
            <label htmlFor="name" className={labelClass}>Имя</label>
            <input
              id="name"
              type="text"
              value={formData.name}
              onChange={e => setFormData({...formData, name: e.target.value})}
              className={inputClass}
              placeholder="Иван Иванов"
              required
            />
          </div>
          <div>
            <label htmlFor="email" className={labelClass}>Email (Логин)</label>
            <input
              id="email"
              type="email"
              value={formData.email}
              onChange={e => setFormData({...formData, email: e.target.value})}
              className={inputClass}
              placeholder="user@example.com"
              required
            />
          </div>
          <div>
            <label htmlFor="password" className={labelClass}>Пароль</label>
            <input
              id="password"
              type="text"
              value={formData.password}
              onChange={e => setFormData({...formData, password: e.target.value})}
              className={inputClass}
              placeholder="••••••••"
              required
            />
          </div>
          <div>
            <label htmlFor="role" className={labelClass}>Роль</label>
            <div className="relative">
                <select
                id="role"
                value={formData.role}
                onChange={e => setFormData({...formData, role: e.target.value})}
                className={clsx(inputClass, "appearance-none bg-white")}
                >
                <option value="APPROVER">Сотрудник (Approver)</option>
                <option value="ADMIN">Администратор</option>
                </select>
            </div>
          </div>

          <div className="pt-2">
            <button
                className="w-full bg-primary text-white px-4 py-2 rounded-md hover:bg-primary-light transition-all duration-200 active:scale-95 motion-reduce:transform-none disabled:opacity-70 disabled:cursor-not-allowed focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary flex justify-center items-center gap-2"
                disabled={isLoading}
            >
                {isLoading ? (
                    <>
                        <Loader2 className="w-5 h-5 animate-spin" aria-hidden="true" />
                        <span>Создание...</span>
                    </>
                ) : (
                    <>
                        <UserPlus className="w-5 h-5" aria-hidden="true" />
                        <span>Создать</span>
                    </>
                )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
