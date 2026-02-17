import React, { useState, useEffect } from 'react';
import { Header } from '../components/Header';
import axios from 'axios';
import { User, Lock, Save, AlertCircle } from 'lucide-react';

export const Profile = () => {
  const [user, setUser] = useState<any>(null);
  const [formData, setFormData] = useState({
    surname: '',
    firstname: '',
    patronymic: '',
    department: ''
  });
  const [passwordData, setPasswordData] = useState({
    oldPassword: '',
    newPassword: '',
    confirmPassword: ''
  });
  const [message, setMessage] = useState<{ type: 'success' | 'error', text: string } | null>(null);

  useEffect(() => {
    fetchProfile();
  }, []);

  const fetchProfile = async () => {
    try {
      const res = await axios.get('/api/users/me');
      setUser(res.data);
      setFormData({
        surname: res.data.surname || '',
        firstname: res.data.firstname || res.data.name || '', // Fallback to name if firstname empty
        patronymic: res.data.patronymic || '',
        department: res.data.department || ''
      });
    } catch (error) {
      console.error('Failed to fetch profile', error);
    }
  };

  const handleProfileUpdate = async (e: React.FormEvent) => {
    e.preventDefault();
    setMessage(null);
    try {
      const res = await axios.put('/api/users/profile', formData);
      setUser(res.data);
      // Update local storage user name
      const lsUser = JSON.parse(localStorage.getItem('user') || '{}');
      lsUser.name = res.data.name; // Backend updates name too
      localStorage.setItem('user', JSON.stringify(lsUser));

      setMessage({ type: 'success', text: 'Профиль обновлен' });
    } catch (error) {
      setMessage({ type: 'error', text: 'Ошибка обновления профиля' });
    }
  };

  const handlePasswordChange = async (e: React.FormEvent) => {
    e.preventDefault();
    setMessage(null);

    if (passwordData.newPassword !== passwordData.confirmPassword) {
      setMessage({ type: 'error', text: 'Пароли не совпадают' });
      return;
    }

    try {
      await axios.put('/api/users/password', {
        oldPassword: passwordData.oldPassword,
        newPassword: passwordData.newPassword
      });
      setMessage({ type: 'success', text: 'Пароль успешно изменен' });
      setPasswordData({ oldPassword: '', newPassword: '', confirmPassword: '' });
    } catch (error: any) {
        const errText = error.response?.data?.error || 'Ошибка смены пароля';
        setMessage({ type: 'error', text: errText });
    }
  };

  return (
    <div className="min-h-screen bg-[#F5F6F8] pt-20 pb-10">
      <Header />

      <div className="max-w-4xl mx-auto px-6">
        <h1 className="text-2xl font-bold mb-6 text-gray-800">Профиль пользователя</h1>

        {message && (
          <div className={`p-4 rounded mb-6 flex items-center gap-2 ${message.type === 'success' ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>
            <AlertCircle className="w-5 h-5" />
            {message.text}
          </div>
        )}

        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">

          {/* Personal Info */}
          <div className="bg-white p-6 rounded-lg shadow-sm">
            <div className="flex items-center gap-2 mb-6 pb-2 border-b">
              <User className="w-5 h-5 text-primary" />
              <h2 className="text-lg font-semibold">Личные данные</h2>
            </div>

            <form onSubmit={handleProfileUpdate} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Фамилия</label>
                <input
                  type="text"
                  value={formData.surname}
                  onChange={e => setFormData({...formData, surname: e.target.value})}
                  className="w-full p-2 border rounded focus:ring-2 focus:ring-primary/50 outline-none"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Имя <span className="text-red-500">*</span></label>
                <input
                  type="text"
                  required
                  value={formData.firstname}
                  onChange={e => setFormData({...formData, firstname: e.target.value})}
                  className="w-full p-2 border rounded focus:ring-2 focus:ring-primary/50 outline-none"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Отчество</label>
                <input
                  type="text"
                  value={formData.patronymic}
                  onChange={e => setFormData({...formData, patronymic: e.target.value})}
                  className="w-full p-2 border rounded focus:ring-2 focus:ring-primary/50 outline-none"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Департамент</label>
                <input
                  type="text"
                  value={formData.department}
                  onChange={e => setFormData({...formData, department: e.target.value})}
                  className="w-full p-2 border rounded focus:ring-2 focus:ring-primary/50 outline-none"
                />
              </div>

              <div className="pt-4">
                <button type="submit" className="flex items-center gap-2 bg-primary text-white px-4 py-2 rounded hover:bg-primary-dark transition-colors">
                  <Save className="w-4 h-4" /> Сохранить изменения
                </button>
              </div>
            </form>
          </div>

          {/* Password Change */}
          <div className="bg-white p-6 rounded-lg shadow-sm h-fit">
             <div className="flex items-center gap-2 mb-6 pb-2 border-b">
              <Lock className="w-5 h-5 text-primary" />
              <h2 className="text-lg font-semibold">Безопасность</h2>
            </div>

            <form onSubmit={handlePasswordChange} className="space-y-4">
               <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Текущий пароль</label>
                <input
                  type="password"
                  required
                  value={passwordData.oldPassword}
                  onChange={e => setPasswordData({...passwordData, oldPassword: e.target.value})}
                  className="w-full p-2 border rounded focus:ring-2 focus:ring-primary/50 outline-none"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Новый пароль</label>
                <input
                  type="password"
                  required
                  value={passwordData.newPassword}
                  onChange={e => setPasswordData({...passwordData, newPassword: e.target.value})}
                  className="w-full p-2 border rounded focus:ring-2 focus:ring-primary/50 outline-none"
                />
              </div>
               <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Подтверждение пароля</label>
                <input
                  type="password"
                  required
                  value={passwordData.confirmPassword}
                  onChange={e => setPasswordData({...passwordData, confirmPassword: e.target.value})}
                  className="w-full p-2 border rounded focus:ring-2 focus:ring-primary/50 outline-none"
                />
              </div>

              <div className="pt-4">
                <button type="submit" className="w-full bg-gray-800 text-white px-4 py-2 rounded hover:bg-gray-900 transition-colors">
                   Сменить пароль
                </button>
              </div>
            </form>
          </div>

        </div>
      </div>
    </div>
  );
};
