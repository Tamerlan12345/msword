import React, { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { Header } from '../components/Header';
import { NewDocumentModal } from '../components/NewDocumentModal';
import { Plus, FileText, CheckCircle, Archive, Loader2, AlertTriangle, RefreshCcw } from 'lucide-react';
import { clsx } from 'clsx';
import axios from 'axios';

const TABS = [
  { id: 'my-tasks', label: 'Мои документы' },
  { id: 'on-approval', label: 'На согласовании' },
  { id: 'archive', label: 'Архив' },
];

const getStatusText = (status: string) => {
  switch (status) {
    case 'DRAFT': return 'Черновик';
    case 'ON_APPROVAL': return 'На согласовании';
    case 'APPROVED': return 'Согласован';
    case 'REVIEW_REQUIRED': return 'Требует доработки';
    case 'REJECTED': return 'Отклонен';
    default: return status;
  }
};

export const Dashboard = () => {
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState('my-tasks');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [documents, setDocuments] = useState<any[]>([]);
  const [currentUser, setCurrentUser] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const userStr = localStorage.getItem('user');
    if (userStr) {
      setCurrentUser(JSON.parse(userStr));
    }
  }, []);

  const fetchDocuments = async () => {
    setIsLoading(true);
    setError(null);
    try {
      const res = await axios.get('/api/documents');
      setDocuments(res.data);
    } catch (error) {
      console.error(error);
      setError('Не удалось загрузить документы. Пожалуйста, попробуйте позже.');
    } finally {
      setIsLoading(false);
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
          <div className="flex gap-8" role="tablist">
            {TABS.map((tab) => (
              <button
                key={tab.id}
                role="tab"
                aria-selected={activeTab === tab.id}
                aria-controls="document-list"
                onClick={() => setActiveTab(tab.id)}
                className={clsx(
                  "pb-4 px-1 text-sm font-medium transition-colors relative outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 rounded-sm",
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
              className="flex items-center gap-2 bg-primary hover:bg-primary-light text-white px-4 py-2 rounded-md text-sm font-medium transition-all duration-200 active:scale-95 motion-reduce:transform-none"
            >
              <Plus className="w-4 h-4" />
              Новый документ
            </button>
          </div>
        </div>

        {/* Content Area */}
        <div id="document-list" role="tabpanel" className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {isLoading && (
            <div className="col-span-full flex flex-col items-center justify-center py-20 text-center">
              <Loader2 className="w-10 h-10 text-primary animate-spin mb-4" />
              <p className="text-gray-500 font-medium">Загрузка документов...</p>
            </div>
          )}

          {error && !isLoading && (
            <div className="col-span-full flex flex-col items-center justify-center py-20 text-center">
              <div className="bg-red-50 p-4 rounded-full mb-4">
                <AlertTriangle className="w-8 h-8 text-red-500" />
              </div>
              <h3 className="text-lg font-semibold text-gray-900 mb-1">Ошибка загрузки</h3>
              <p className="text-gray-500 max-w-sm mb-6">{error}</p>
              <button
                onClick={fetchDocuments}
                className="flex items-center gap-2 bg-white border border-gray-300 hover:bg-gray-50 text-gray-700 px-4 py-2 rounded-md text-sm font-medium transition-colors"
              >
                <RefreshCcw className="w-4 h-4" />
                Повторить
              </button>
            </div>
          )}

          {!isLoading && !error && filteredDocuments.map((doc) => {
            const total = doc.approvers?.length || 0;
            const approvedCount = doc.approvers?.filter((a: any) => a.status === 'APPROVED').length || 0;
            const percent = doc.status === 'APPROVED' ? 100 : (total > 0 ? (approvedCount / total) * 100 : 0);

            return (
              <Link
                key={doc.id}
                to={`/documents/${doc.id}`}
                className="block bg-white rounded-lg p-5 shadow-sm border border-gray-100 hover:shadow-lg hover:-translate-y-1 hover:border-primary/30 transition-all duration-300 ease-out motion-reduce:transform-none focus:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2"
                aria-label={`Документ: ${doc.title}, Статус: ${getStatusText(doc.status)}`}
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
                    {getStatusText(doc.status)}
                  </span>
                </div>

                <div className="text-sm text-gray-500 mb-4 pb-4 border-b border-gray-100">
                  Автор: {doc.author?.name || 'Unknown'} • {new Date(doc.createdAt).toLocaleDateString()}
                </div>

                <div className="space-y-2">
                  <div className="flex justify-between text-xs text-gray-500 mb-1">
                    <span>Статус</span>
                    <span className="text-primary font-medium">
                       {getStatusText(doc.status)}
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
              </Link>
            );
          })}

          {!isLoading && !error && filteredDocuments.length === 0 && (
            <div className="col-span-full flex flex-col items-center justify-center py-16 text-center" role="status">
              <div className="bg-gray-100 p-4 rounded-full mb-4">
                {activeTab === 'my-tasks' && <FileText className="w-8 h-8 text-gray-400" />}
                {activeTab === 'on-approval' && <CheckCircle className="w-8 h-8 text-green-600" />}
                {activeTab === 'archive' && <Archive className="w-8 h-8 text-gray-400" />}
              </div>
              <h3 className="text-lg font-semibold text-gray-900 mb-1">
                {activeTab === 'my-tasks' && 'У вас пока нет документов'}
                {activeTab === 'on-approval' && 'Все согласовано!'}
                {activeTab === 'archive' && 'Архив пуст'}
              </h3>
              <p className="text-gray-500 max-w-sm mb-6">
                {activeTab === 'my-tasks' && 'Создайте новый документ, чтобы начать работу с системой согласования.'}
                {activeTab === 'on-approval' && 'На данный момент нет документов, требующих вашего внимания. Отличная работа!'}
                {activeTab === 'archive' && 'Здесь будут храниться завершенные и отклоненные документы.'}
              </p>
              {activeTab === 'my-tasks' && (
                <button
                  onClick={() => setIsModalOpen(true)}
                  className="flex items-center gap-2 bg-primary hover:bg-primary-light text-white px-4 py-2 rounded-md text-sm font-medium transition-colors"
                >
                  <Plus className="w-4 h-4" />
                  Создать документ
                </button>
              )}
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
