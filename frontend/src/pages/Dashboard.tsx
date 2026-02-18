import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Header } from '../components/Header';
import { NewDocumentModal } from '../components/NewDocumentModal';
import { Plus } from 'lucide-react';
import { clsx } from 'clsx';
import axios from 'axios';

const TABS = [
  { id: 'my-tasks', label: 'Мои документы' },
  { id: 'on-approval', label: 'На согласовании' },
  { id: 'archive', label: 'Архив' },
];

export const Dashboard = () => {
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState('my-tasks');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [documents, setDocuments] = useState<any[]>([]);
  const [currentUser, setCurrentUser] = useState<any>(null);

  useEffect(() => {
    const userStr = localStorage.getItem('user');
    if (userStr) {
      setCurrentUser(JSON.parse(userStr));
    }
  }, []);

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

  const filteredDocuments = documents.filter(doc => {
    if (!currentUser) return false;

    const isAuthor = doc.authorId === currentUser.id;
    const isApprover = doc.approvers?.some((a: any) => a.userId === currentUser.id);

    switch (activeTab) {
      case 'my-tasks':
        // "Мои документы" (Author): Все, где authorId == me.
        return isAuthor;

      case 'on-approval':
        // "На согласовании" (Входящие): Документы, где user находится в списке approvers И статус ON_APPROVAL.
        return isApprover && doc.status === 'ON_APPROVAL';

      case 'archive':
        // "Архив": Документы со статусом APPROVED или REJECTED.
        return doc.status === 'APPROVED' || doc.status === 'REJECTED';

      default:
        return true;
    }
  });

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
          {filteredDocuments.map((doc) => {
            const total = doc.approvers?.length || 0;
            const approvedCount = doc.approvers?.filter((a: any) => a.status === 'APPROVED').length || 0;
            const percent = doc.status === 'APPROVED' ? 100 : (total > 0 ? (approvedCount / total) * 100 : 0);

            return (
              <div
                key={doc.id}
                onClick={() => navigate(`/documents/${doc.id}`)}
                className="bg-white rounded-lg p-5 shadow-sm border border-gray-100 hover:shadow-md transition-shadow cursor-pointer"
              >
                <div className="flex justify-between items-start mb-3">
                  <h3 className="font-bold text-gray-800 line-clamp-2">{doc.title}</h3>
                  <span className={clsx(
                    "px-2 py-1 text-xs font-medium rounded-md",
                    doc.status === 'DRAFT' ? "bg-gray-100 text-gray-600" :
                    doc.status === 'ON_APPROVAL' ? "bg-blue-50 text-blue-700" :
                    doc.status === 'APPROVED' ? "bg-green-50 text-green-700" :
                    doc.status === 'REVIEW_REQUIRED' ? "bg-yellow-50 text-yellow-700" :
                    "bg-red-50 text-red-700"
                  )}>
                    {doc.status === 'DRAFT' ? 'Черновик' :
                     doc.status === 'ON_APPROVAL' ? 'На согласовании' :
                     doc.status === 'APPROVED' ? 'Согласован' :
                     doc.status === 'REVIEW_REQUIRED' ? 'Требует доработки' : 'Отклонен'}
                  </span>
                </div>

                <div className="text-sm text-gray-500 mb-4 pb-4 border-b border-gray-100">
                  Автор: {doc.author?.name || 'Unknown'} • {new Date(doc.createdAt).toLocaleDateString()}
                </div>

                <div className="space-y-2">
                  <div className="flex justify-between text-xs text-gray-500 mb-1">
                    <span>Статус</span>
                    <span className="text-primary font-medium">
                       {doc.status}
                    </span>
                  </div>
                  {/* Visual progress bar can be smarter, but for now just show something */}
                  <div className="h-1.5 w-full bg-gray-100 rounded-full overflow-hidden">
                    <div
                      className={clsx("h-full rounded-full transition-all duration-500",
                        doc.status === 'APPROVED' ? "bg-green-500" :
                        doc.status === 'ON_APPROVAL' ? "bg-blue-500" :
                        doc.status === 'REJECTED' ? "bg-red-500" :
                        "bg-gray-300"
                      )}
                      style={{ width: `${percent}%` }}
                    ></div>
                  </div>
                </div>
              </div>
            );
          })}

          {filteredDocuments.length === 0 && (
            <div className="col-span-full text-center py-20 text-gray-400">
              В этой категории нет документов.
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
