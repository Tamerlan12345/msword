import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Header } from '../components/Header';
import { NewDocumentModal } from '../components/NewDocumentModal';
import { Plus, Clock, AlertCircle } from 'lucide-react';
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

    // Admin sees all in "My Documents" or separate view?
    // Spec: "Для Администратора: Видна отдельная вкладка или переключатель".
    // For MVP, if Admin, 'my-tasks' could show all?
    // Or just strictly follow tabs.
    // Let's assume Admin also uses tabs but has access to everything.
    // But filters still apply based on logic below.
    // If Admin wants to see "All", maybe we need a tab "All"?
    // The current tabs are role-centric.
    // If I am Admin, I am also a User.
    // Let's stick to the Spec Tabs for now.
    // Admin sees "My Documents" (Where he is author).
    // "On Approval" (Where he is approver).
    // But Admin "Видит абсолютно ВСЕ".
    // Maybe Admin should see EVERYTHING in 'my-tasks' or a new tab?
    // Let's add 'all' tab for Admin?
    // Or just let Admin see everything in 'archive' and 'on-approval'?
    // Let's stick to the specific logic for tabs requested:
    // 1. My Documents: author == me.
    // 2. On Approval: approver == me & status == ON_APPROVAL.
    // 3. Archive: status == APPROVED/REJECTED. (And maybe involve me? Spec says "где он участвовал" for reviewer, but Admin sees all).

    // Let's implement strict tab logic for Author/Reviewer first.

    const isAuthor = doc.authorId === currentUser.id;
    const isApprover = doc.approvers?.some((a: any) => a.userId === currentUser.id);

    switch (activeTab) {
      case 'my-tasks':
        // Spec: "Все, где authorId == me"
        return isAuthor;

      case 'on-approval':
        // Spec: "user находится в списке approvers И статус ON_APPROVAL"
        // Also distinguishing My Turn vs Waiting
        return isApprover && doc.status === 'ON_APPROVAL';

      case 'archive':
        // Spec: "APPROVED или REJECTED".
        // Filter "где он участвовал" for regular users?
        // Spec: "APPROVED/ARCHIVED (где он участвовал)" for Reviewer.
        if (currentUser.role === 'ADMIN') return doc.status === 'APPROVED' || doc.status === 'REJECTED';
        return (doc.status === 'APPROVED' || doc.status === 'REJECTED') && (isAuthor || isApprover);

      default:
        return true;
    }
  });

  // Add "All" tab for Admin if needed, or just let them see via these tabs?
  // Spec: "Для Администратора: Видна отдельная вкладка... «Все документы организации»"
  // I will add it if user is admin.

  const finalTabs = currentUser?.role === 'ADMIN'
      ? [{ id: 'all', label: 'Все документы' }, ...TABS]
      : TABS;

  // Re-filter if 'all' is selected
  const displayDocuments = activeTab === 'all' ? documents : filteredDocuments;


  return (
    <div className="min-h-screen pt-16 bg-[#F5F6F8]">
      <Header />

      <div className="max-w-7xl mx-auto px-6 py-6">
        {/* Tabs & Actions */}
        <div className="flex items-center justify-between mb-6 border-b border-gray-200">
          <div className="flex gap-8">
            {finalTabs.map((tab) => (
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
          {displayDocuments.map((doc) => {
             // Logic for visual indicators
             const myApprover = doc.approvers?.find((a: any) => a.userId === currentUser?.id);
             const isMyTurn = myApprover?.isCurrent && doc.status === 'ON_APPROVAL';
             const isWaiting = myApprover && !myApprover.isCurrent && doc.status === 'ON_APPROVAL';

             return (
                <div
                key={doc.id}
                onClick={() => navigate(`/documents/${doc.id}`)}
                className={`bg-white rounded-lg p-5 shadow-sm border hover:shadow-md transition-shadow cursor-pointer relative
                    ${isMyTurn ? 'border-blue-300 ring-1 ring-blue-100' : 'border-gray-100'}
                `}
                >
                {isMyTurn && (
                    <div className="absolute top-0 right-0 bg-blue-600 text-white text-[10px] px-2 py-0.5 rounded-bl-lg rounded-tr-lg font-bold flex items-center gap-1">
                        <Clock className="w-3 h-3" /> ВАШ ХОД
                    </div>
                )}

                <div className="flex justify-between items-start mb-3">
                    <h3 className="font-bold text-gray-800 line-clamp-2">{doc.title}</h3>
                    <span className={clsx(
                    "px-2 py-1 text-xs font-medium rounded-md",
                    doc.status === 'DRAFT' ? "bg-gray-100 text-gray-600" :
                    doc.status === 'ON_APPROVAL' ? "bg-blue-50 text-blue-700" :
                    doc.status === 'APPROVED' ? "bg-green-50 text-green-700" :
                    doc.status === 'REVIEW_REQUIRED' ? "bg-orange-50 text-orange-700" :
                    "bg-red-50 text-red-700"
                    )}>
                    {doc.status === 'DRAFT' ? 'Черновик' :
                    doc.status === 'ON_APPROVAL' ? 'На согласовании' :
                    doc.status === 'APPROVED' ? 'Согласован' :
                    doc.status === 'REVIEW_REQUIRED' ? 'На доработке' :
                    'Отклонен'}
                    </span>
                </div>

                <div className="text-sm text-gray-500 mb-4 pb-4 border-b border-gray-100">
                    Автор: {doc.author?.name || 'Unknown'} • {new Date(doc.createdAt).toLocaleDateString()}
                </div>

                <div className="space-y-2">
                    <div className="flex justify-between text-xs text-gray-500 mb-1">
                    <span>Статус</span>
                    <span className="text-primary font-medium">
                        {isMyTurn ? 'Ждет вашего решения' :
                         isWaiting ? 'В очереди' :
                         doc.status}
                    </span>
                    </div>

                    {/* Progress Bar (Mockup based on approvers count vs passed) */}
                    {doc.approvers?.length > 0 && (
                        <div className="h-1.5 w-full bg-gray-100 rounded-full overflow-hidden">
                            <div
                                className="h-full bg-blue-500 rounded-full transition-all"
                                style={{
                                    width: `${(doc.approvers.filter((a:any) => a.status === 'APPROVED').length / doc.approvers.length) * 100}%`
                                }}
                            ></div>
                        </div>
                    )}
                </div>
                </div>
            );
          })}

          {displayDocuments.length === 0 && (
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
