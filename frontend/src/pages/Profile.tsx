import React, { useState, useEffect } from 'react';
import { Header } from '../components/Header';
import axios from 'axios';
import { User, Lock, Save, AlertCircle, Loader2 } from 'lucide-react';
import { clsx } from 'clsx';

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
  const [isSaving, setIsSaving] = useState(false);
  const [isChangingPassword, setIsChangingPassword] = useState(false);

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
    setIsSaving(true);
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
    } finally {
      setIsSaving(false);
    }
  };

  const handlePasswordChange = async (e: React.FormEvent) => {
    e.preventDefault();
    setMessage(null);

    if (passwordData.newPassword !== passwordData.confirmPassword) {
      setMessage({ type: 'error', text: 'Пароли не совпадают' });
      return;
    }

    setIsChangingPassword(true);
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
    } finally {
        setIsChangingPassword(false);
    }
  };

  const inputClass = "w-full px-4 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent transition-shadow disabled:bg-gray-50 disabled:text-gray-500";
  const labelClass = "block text-sm font-medium text-gray-700 mb-1";

  return (
    <div className="min-h-screen bg-[#F5F6F8] pt-20 pb-10">
      <Header />

      <div className="max-w-4xl mx-auto px-6">
        <h1 className="text-2xl font-bold mb-6 text-gray-800">Профиль пользователя</h1>

        {message && (
          <div
            className={clsx(
                "p-4 rounded-md mb-6 flex items-start gap-2 border shadow-sm",
                message.type === 'success' ? 'bg-green-50 border-green-200 text-green-800' : 'bg-red-50 border-red-200 text-red-800'
            )}
            role="alert"
            aria-live="polite"
          >
            <AlertCircle className="w-5 h-5 shrink-0" aria-hidden="true" />
            <span>{message.text}</span>
          </div>
        )}

        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">

          {/* Personal Info */}
          <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-100">
            <div className="flex items-center gap-2 mb-6 pb-2 border-b border-gray-100">
              <User className="w-5 h-5 text-primary" aria-hidden="true" />
              <h2 className="text-lg font-semibold text-gray-900">Личные данные</h2>
            </div>

            <form onSubmit={handleProfileUpdate} className="space-y-4">
              <div>
                <label htmlFor="surname" className={labelClass}>Фамилия</label>
                <input
                  id="surname"
                  type="text"
                  value={formData.surname}
                  onChange={e => setFormData({...formData, surname: e.target.value})}
                  className={inputClass}
                  placeholder="Иванов"
                />
              </div>
              <div>
                <label htmlFor="firstname" className={labelClass}>Имя <span className="text-red-500" aria-hidden="true">*</span></label>
                <input
                  id="firstname"
                  type="text"
                  required
                  value={formData.firstname}
                  onChange={e => setFormData({...formData, firstname: e.target.value})}
                  className={inputClass}
                  placeholder="Иван"
                />
              </div>
              <div>
                <label htmlFor="patronymic" className={labelClass}>Отчество</label>
                <input
                  id="patronymic"
                  type="text"
                  value={formData.patronymic}
                  onChange={e => setFormData({...formData, patronymic: e.target.value})}
                  className={inputClass}
                  placeholder="Иванович"
                />
              </div>
              <div>
                <label htmlFor="department" className={labelClass}>Департамент</label>
                <input
                  id="department"
                  type="text"
                  value={formData.department}
                  onChange={e => setFormData({...formData, department: e.target.value})}
                  className={inputClass}
                  placeholder="IT Отдел"
                />
              </div>

              <div className="pt-4">
                <button
                    type="submit"
                    disabled={isSaving}
                    className="flex items-center justify-center gap-2 bg-primary text-white px-4 py-2 rounded-md hover:bg-primary-dark transition-all duration-200 active:scale-95 motion-reduce:transform-none disabled:opacity-70 disabled:cursor-not-allowed focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary w-full sm:w-auto"
                >
                  {isSaving ? (
                      <>
                        <Loader2 className="w-4 h-4 animate-spin" aria-hidden="true" />
                        <span>Сохранение...</span>
                      </>
                  ) : (
                      <>
                        <Save className="w-4 h-4" aria-hidden="true" />
                        <span>Сохранить изменения</span>
                      </>
                  )}
                </button>
              </div>
            </form>
          </div>

          {/* Password Change */}
          <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-100 h-fit">
             <div className="flex items-center gap-2 mb-6 pb-2 border-b border-gray-100">
              <Lock className="w-5 h-5 text-primary" aria-hidden="true" />
              <h2 className="text-lg font-semibold text-gray-900">Безопасность</h2>
            </div>

            <form onSubmit={handlePasswordChange} className="space-y-4">
               <div>
                <label htmlFor="oldPassword" className={labelClass}>Текущий пароль</label>
                <input
                  id="oldPassword"
                  type="password"
                  required
                  value={passwordData.oldPassword}
                  onChange={e => setPasswordData({...passwordData, oldPassword: e.target.value})}
                  className={inputClass}
                  placeholder="••••••••"
                />
              </div>
              <div>
                <label htmlFor="newPassword" className={labelClass}>Новый пароль</label>
                <input
                  id="newPassword"
                  type="password"
                  required
                  value={passwordData.newPassword}
                  onChange={e => setPasswordData({...passwordData, newPassword: e.target.value})}
                  className={inputClass}
                  placeholder="••••••••"
                />
              </div>
               <div>
                <label htmlFor="confirmPassword" className={labelClass}>Подтверждение пароля</label>
                <input
                  id="confirmPassword"
                  type="password"
                  required
                  value={passwordData.confirmPassword}
                  onChange={e => setPasswordData({...passwordData, confirmPassword: e.target.value})}
                  className={inputClass}
                  placeholder="••••••••"
                />
              </div>

              <div className="pt-4">
                <button
                    type="submit"
                    disabled={isChangingPassword}
                    className="w-full bg-gray-800 text-white px-4 py-2 rounded-md hover:bg-gray-900 transition-all duration-200 active:scale-95 motion-reduce:transform-none disabled:opacity-70 disabled:cursor-not-allowed focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-gray-800 flex justify-center items-center gap-2"
                >
                   {isChangingPassword ? (
                       <>
                           <Loader2 className="w-4 h-4 animate-spin" aria-hidden="true" />
                           <span>Обновление...</span>
                       </>
                   ) : (
                       'Сменить пароль'
                   )}
                </button>
              </div>
            </form>
          </div>

        </div>
      </div>
    </div>
  );
};
