import React, { useState } from 'react';
import axios from 'axios';
import { Header } from '../components/Header';

export const Admin = () => {
  const [formData, setFormData] = useState({ name: '', email: '', password: '', role: 'APPROVER' });
  const [msg, setMsg] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await axios.post('/api/users', formData);
      setMsg('Пользователь успешно создан!');
      setFormData({ name: '', email: '', password: '', role: 'APPROVER' });
    } catch (error) {
      setMsg('Ошибка при создании пользователя.');
    }
  };

  return (
    <div className="min-h-screen pt-16 bg-[#F5F6F8]">
      <Header />
      <div className="max-w-2xl mx-auto px-6 py-8">
        <h1 className="text-2xl font-bold mb-6">Создание пользователя</h1>

        {msg && <div className="bg-blue-50 text-blue-700 p-3 rounded mb-4">{msg}</div>}

        <form onSubmit={handleSubmit} className="bg-white p-6 rounded-lg shadow-sm space-y-4">
          <div>
            <label className="block text-sm font-medium">Имя</label>
            <input
              type="text"
              value={formData.name}
              onChange={e => setFormData({...formData, name: e.target.value})}
              className="w-full border p-2 rounded"
              required
            />
          </div>
          <div>
            <label className="block text-sm font-medium">Email (Логин)</label>
            <input
              type="email"
              value={formData.email}
              onChange={e => setFormData({...formData, email: e.target.value})}
              className="w-full border p-2 rounded"
              required
            />
          </div>
          <div>
            <label className="block text-sm font-medium">Пароль</label>
            <input
              type="text"
              value={formData.password}
              onChange={e => setFormData({...formData, password: e.target.value})}
              className="w-full border p-2 rounded"
              required
            />
          </div>
          <div>
            <label className="block text-sm font-medium">Роль</label>
            <select
              value={formData.role}
              onChange={e => setFormData({...formData, role: e.target.value})}
              className="w-full border p-2 rounded"
            >
              <option value="APPROVER">Сотрудник (Approver)</option>
              <option value="ADMIN">Администратор</option>
            </select>
          </div>
          <button className="bg-primary text-white px-4 py-2 rounded">Создать</button>
        </form>
      </div>
    </div>
  );
};
