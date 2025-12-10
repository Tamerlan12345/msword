import React, { useState, useEffect } from 'react';
import { Header } from '../components/Header';
import { NewDocumentModal } from '../components/NewDocumentModal';
import { Plus } from 'lucide-react';
import { clsx } from 'clsx';
import axios from 'axios';

const TABS = [
  { id: 'my-tasks', label: 'Мои задачи' },
  { id: 'in-progress', label: 'В работе' },
  { id: 'on-approval', label: 'На согласовании' },
  { id: 'archive', label: 'Архив' },
];

export const Dashboard = () => {
  const [activeTab, setActiveTab] = useState('my-tasks');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [documents, setDocuments] = useState<any[]>([]);

  const fetchDocuments = async () => {
    try {
      const res = await axios.get('/api/documents');
      setDocuments(res.data);
    } catch (error) {
      console.error(error);
    }
  };

  useEffect(() => {
    fetchDocuments();
  }, []);

  return (
    <div className="min-h-screen pt-16 bg-[#F5F6F8]">
      <Header />

      <div className="max-w-7xl mx-auto px-6 py-6">
        {/* Tabs & Actions */}
        <div className="flex items-center justify-between mb-6 border-b border-gray-200">
          <div className="flex gap-8">
            {TABS.map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={clsx(
                  "pb-4 px-1 text-sm font-medium transition-colors relative",
                  activeTab === tab.id
                    ? "text-primary border-b-2 border-primary"
                    : "text-gray-500 hover:text-gray-700"
                )}
              >
                {tab.label}
              </button>
            ))}
          </div>

          <div className="pb-2">
            <button
              onClick={() => setIsModalOpen(true)}
              className="flex items-center gap-2 bg-primary hover:bg-primary-light text-white px-4 py-2 rounded-md text-sm font-medium transition-colors"
            >
              <Plus className="w-4 h-4" />
              Новый документ
            </button>
          </div>
        </div>

        {/* Content Area */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {documents.map((doc) => (
            <div key={doc.id} className="bg-white rounded-lg p-5 shadow-sm border border-gray-100 hover:shadow-md transition-shadow cursor-pointer">
              <div className="flex justify-between items-start mb-3">
                <h3 className="font-bold text-gray-800 line-clamp-2">{doc.title}</h3>
                <span className={clsx(
                  "px-2 py-1 text-xs font-medium rounded-md",
                  doc.status === 'DRAFT' ? "bg-gray-100 text-gray-600" : "bg-blue-50 text-blue-700"
                )}>
                  {doc.status === 'DRAFT' ? 'Черновик' : 'На согласовании'}
                </span>
              </div>

              <div className="text-sm text-gray-500 mb-4 pb-4 border-b border-gray-100">
                Автор: {doc.author?.name || 'Unknown'} • {new Date(doc.createdAt).toLocaleDateString()}
              </div>

              <div className="space-y-2">
                <div className="flex justify-between text-xs text-gray-500 mb-1">
                  <span>Этап 1 из 1</span>
                  <span className="text-primary font-medium">
                     {doc.status === 'DRAFT' ? 'Создание' : 'В процессе'}
                  </span>
                </div>
                <div className="h-1.5 w-full bg-gray-100 rounded-full overflow-hidden">
                  <div className="h-full bg-primary w-0 rounded-full"></div>
                </div>
              </div>
            </div>
          ))}

          {documents.length === 0 && (
            <div className="col-span-full text-center py-20 text-gray-400">
              Нет документов. Создайте первый документ.
            </div>
          )}
        </div>
      </div>

      {isModalOpen && (
        <NewDocumentModal
          onClose={() => setIsModalOpen(false)}
          onSuccess={fetchDocuments}
        />
      )}
    </div>
  );
};
