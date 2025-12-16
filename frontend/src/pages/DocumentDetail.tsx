import React, { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import axios from 'axios';
import { Header } from '../components/Header';
import { ArrowLeft, FileText, Download, CheckCircle, XCircle, Send, Edit, Trash2, RotateCcw } from 'lucide-react';
import { clsx } from 'clsx';

export const DocumentDetail = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [doc, setDoc] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [currentUser, setCurrentUser] = useState<any>(null);

  useEffect(() => {
    // Decode user from token or get from localStorage if you stored it there
    // In Login.tsx we store token. We usually store user info too or decode token.
    // The Login response sends { token, user }. Let's assume we might need to fetch user or parse token.
    // For simplicity, let's look at what Login.tsx does.
    // Login.tsx: localStorage.setItem('token', token); localStorage.setItem('user', JSON.stringify(data.user));
    const userStr = localStorage.getItem('user');
    if (userStr) {
      setCurrentUser(JSON.parse(userStr));
    }

    fetchDocument();
  }, [id]);

  const fetchDocument = async () => {
    try {
      const res = await axios.get(`/api/documents/${id}`);
      setDoc(res.data);
    } catch (err) {
      setError('Ошибка загрузки документа');
    } finally {
      setLoading(false);
    }
  };

  const updateStatus = async (newStatus: string) => {
    try {
      const res = await axios.put(`/api/documents/${id}`, { status: newStatus });
      setDoc(res.data);
    } catch (err) {
      alert('Ошибка обновления статуса');
    }
  };

  const deleteDocument = async () => {
    if (!window.confirm('Вы уверены, что хотите удалить этот документ?')) return;
    try {
      await axios.delete(`/api/documents/${id}`);
      navigate('/');
    } catch (err) {
      alert('Ошибка удаления');
    }
  };

  if (loading) return <div className="p-10 text-center">Загрузка...</div>;
  if (error || !doc) return <div className="p-10 text-center text-red-500">{error || 'Документ не найден'}</div>;

  const isAuthor = currentUser?.id === doc.authorId;
  const isAdmin = currentUser?.role === 'ADMIN';

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'DRAFT': return 'bg-gray-100 text-gray-600';
      case 'ON_APPROVAL': return 'bg-blue-50 text-blue-700';
      case 'APPROVED': return 'bg-green-50 text-green-700';
      case 'REJECTED': return 'bg-red-50 text-red-700';
      default: return 'bg-gray-100 text-gray-600';
    }
  };

  const getStatusLabel = (status: string) => {
    switch (status) {
      case 'DRAFT': return 'Черновик';
      case 'ON_APPROVAL': return 'На согласовании';
      case 'APPROVED': return 'Согласован';
      case 'REJECTED': return 'Отклонен';
      default: return status;
    }
  };

  // Logic for buttons based on TS Matrix
  const renderActions = () => {
    // Scenario A: User is Author
    if (isAuthor) {
      if (doc.status === 'DRAFT') {
        return (
          <div className="flex gap-2">
            <button onClick={() => updateStatus('ON_APPROVAL')} className="flex items-center gap-2 bg-primary text-white px-4 py-2 rounded hover:bg-primary-light">
              <Send size={16} /> Отправить на согласование
            </button>
            {/* Edit is complex (upload new file), skipping for MVP or just showing button */}
            <button className="flex items-center gap-2 bg-white border border-gray-300 text-gray-700 px-4 py-2 rounded hover:bg-gray-50" onClick={() => alert('Редактирование пока не реализовано')}>
              <Edit size={16} /> Редактировать
            </button>
            <button onClick={deleteDocument} className="flex items-center gap-2 bg-red-50 text-red-600 px-4 py-2 rounded hover:bg-red-100">
              <Trash2 size={16} /> Удалить
            </button>
          </div>
        );
      }
      if (doc.status === 'REJECTED') {
        return (
          <div className="flex gap-2">
             <button onClick={() => updateStatus('DRAFT')} className="flex items-center gap-2 bg-orange-100 text-orange-700 px-4 py-2 rounded hover:bg-orange-200">
              <RotateCcw size={16} /> Вернуть в черновик
            </button>
          </div>
        )
      }
    }

    // Scenario B: User is Admin (Approver)
    // Note: Admin can see others' docs.
    if (isAdmin) {
      if (doc.status === 'ON_APPROVAL') {
        return (
          <div className="flex gap-2">
            <button onClick={() => updateStatus('APPROVED')} className="flex items-center gap-2 bg-green-600 text-white px-4 py-2 rounded hover:bg-green-700">
              <CheckCircle size={16} /> Согласовать
            </button>
            <button onClick={() => updateStatus('REJECTED')} className="flex items-center gap-2 bg-red-600 text-white px-4 py-2 rounded hover:bg-red-700">
              <XCircle size={16} /> Отклонить
            </button>
          </div>
        );
      }
    }

    return null;
  };

  // Find latest file path
  const latestVersion = doc.versions && doc.versions.length > 0 ? doc.versions[doc.versions.length - 1] : null;
  const downloadUrl = latestVersion ? `/${latestVersion.filePath}` : '#'; // Assuming filePath is relative to static root

  return (
    <div className="min-h-screen bg-[#F5F6F8]">
      <Header />
      <div className="max-w-5xl mx-auto px-6 py-8">
        <button onClick={() => navigate('/')} className="flex items-center gap-2 text-gray-500 hover:text-gray-900 mb-6">
          <ArrowLeft size={20} /> Назад к списку
        </button>

        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-8">
          <div className="flex justify-between items-start mb-6">
            <div>
              <h1 className="text-2xl font-bold text-gray-900 mb-2">{doc.title}</h1>
              <div className="flex items-center gap-4 text-sm text-gray-500">
                <span>Автор: {doc.author?.name}</span>
                <span>•</span>
                <span>{new Date(doc.createdAt).toLocaleDateString()}</span>
              </div>
            </div>
            <span className={clsx("px-3 py-1 rounded-full text-sm font-medium", getStatusColor(doc.status))}>
              {getStatusLabel(doc.status)}
            </span>
          </div>

          <div className="border-t border-b border-gray-100 py-6 mb-6">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-4">
                <div className="p-3 bg-blue-50 rounded-lg text-blue-600">
                  <FileText size={24} />
                </div>
                <div>
                  <p className="font-medium text-gray-900">Файл документа</p>
                  <p className="text-sm text-gray-500">{latestVersion ? `Версия ${latestVersion.version}` : 'Нет файла'}</p>
                </div>
              </div>
              {latestVersion && (
                <a
                  href={downloadUrl}
                  download
                  className="flex items-center gap-2 text-primary hover:text-primary-dark font-medium"
                  target="_blank"
                  rel="noreferrer"
                >
                  <Download size={18} /> Скачать
                </a>
              )}
            </div>
          </div>

          <div className="flex justify-end">
            {renderActions()}
          </div>
        </div>
      </div>
    </div>
  );
};
