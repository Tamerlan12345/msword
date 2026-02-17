import React, { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import axios from 'axios';
import { Header } from '../components/Header';
import { useEditor, EditorContent } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import { ArrowLeft, Save, CheckCircle, XCircle, UserPlus, ChevronLeft, ChevronRight, Menu } from 'lucide-react';
import { DocumentEditor } from '../components/DocumentEditor';

export const DocumentDetail = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [doc, setDoc] = useState<any>(null);
  const [users, setUsers] = useState<any[]>([]);
  const [selectedApprovers, setSelectedApprovers] = useState<string[]>([]);
  const [isEditingApprovers, setIsEditingApprovers] = useState(false);
  const [isReviewMode, setIsReviewMode] = useState(false);
  const [isSidebarOpen, setIsSidebarOpen] = useState(false); // Default closed

  const editor = useEditor({
    extensions: [StarterKit],
    content: '<p>Загрузка...</p>',
  });

  useEffect(() => {
    const fetchData = async () => {
      try {
        const [docRes, usersRes] = await Promise.all([
          axios.get(`/api/documents/${id}`),
          axios.get('/api/users')
        ]);

        setDoc(docRes.data);
        setUsers(usersRes.data);

        if (docRes.data.versions.length === 0) {
            if (editor && docRes.data.content) {
                try {
                    editor.commands.setContent(JSON.parse(docRes.data.content));
                } catch {
                    editor.commands.setContent(docRes.data.content);
                }
            } else if (editor) {
                editor.commands.setContent('<p>Начните писать здесь...</p>');
            }
        }
      } catch (error) {
        console.error(error);
      }
    };
    fetchData();
  }, [id, editor]);

  const handleSaveContent = async () => {
    if (!editor) return;
    const content = JSON.stringify(editor.getJSON());
    try {
      await axios.put(`/api/documents/${id}/content`, { content });
      alert('Документ сохранен');
    } catch (e) {
      alert('Ошибка сохранения');
    }
  };

  const handleSendToApproval = async () => {
    if (selectedApprovers.length === 0) return alert('Выберите хотя бы одного согласующего');

    try {
      if (doc.versions.length === 0) {
          await handleSaveContent();
      }
      await axios.post(`/api/documents/${id}/approvers`, { userIds: selectedApprovers });

      setDoc({ ...doc, status: 'ON_APPROVAL' });
      setIsEditingApprovers(false);
      alert('Отправлено на согласование!');
    } catch (e) {
      alert('Ошибка отправки');
    }
  };

  const handleVote = async (status: 'APPROVED' | 'REJECTED') => {
    const comment = status === 'REJECTED' ? prompt('Укажите причину отказа:') : null;
    if (status === 'REJECTED' && !comment) return;

    try {
      await axios.put(`/api/documents/${id}/approve`, { status, comment });
      alert('Ваш голос учтен');
      navigate('/');
    } catch (e) {
      alert('Ошибка');
    }
  };

  if (!doc) return <div>Загрузка...</div>;

  return (
    <div className="h-screen flex flex-col bg-[#F5F6F8] overflow-hidden">
      <Header />

      {/* Main Container */}
      <div className="flex flex-1 pt-16 overflow-hidden relative">

        {/* Editor Area */}
        <div className={`flex-1 flex flex-col transition-all duration-300 ${isSidebarOpen ? 'mr-80' : 'mr-0'}`}>
            {/* Toolbar / Header for Doc */}
            <div className="bg-white border-b px-4 py-2 flex justify-between items-center h-12 shadow-sm z-10">
                <div className="flex items-center gap-4">
                    <button onClick={() => navigate('/')} className="text-gray-500 hover:text-gray-700">
                        <ArrowLeft className="w-5 h-5" />
                    </button>
                    <h1 className="text-lg font-bold truncate max-w-md">{doc.title}</h1>
                    <span className={`px-2 py-0.5 rounded text-xs font-bold
                        ${doc.status === 'APPROVED' ? 'bg-green-100 text-green-700' :
                        doc.status === 'ON_APPROVAL' ? 'bg-blue-100 text-blue-700' : 'bg-gray-100 text-gray-700'}`}>
                        {doc.status}
                    </span>
                </div>

                <div className="flex gap-2">
                     {doc.versions.length > 0 && doc.status === 'DRAFT' && (
                         <button
                            onClick={() => setIsReviewMode(!isReviewMode)}
                            className={`px-3 py-1 rounded border text-xs flex items-center gap-1 ${isReviewMode ? 'bg-blue-100 border-blue-300 text-blue-700' : 'bg-gray-50 border-gray-300'}`}
                         >
                            {isReviewMode ? 'Рецензирование: ВКЛ' : 'Режим рецензирования'}
                         </button>
                     )}
                     {doc.status === 'DRAFT' && doc.versions.length === 0 && (
                        <button onClick={handleSaveContent} className="flex items-center gap-1 text-primary hover:bg-blue-50 px-3 py-1 rounded text-xs">
                        <Save className="w-4 h-4" /> Сохранить
                        </button>
                     )}
                     <button
                        onClick={() => setIsSidebarOpen(!isSidebarOpen)}
                        className="p-1 hover:bg-gray-100 rounded text-gray-600 ml-2"
                        title={isSidebarOpen ? "Скрыть панель" : "Показать панель"}
                     >
                        <Menu className="w-5 h-5" />
                     </button>
                </div>
            </div>

            {/* Editor Itself */}
            <div className="flex-1 bg-gray-100 overflow-hidden relative">
               {doc.versions.length > 0 ? (
                   /* Pass full height minus header to ensure fit */
                   <div className="h-full w-full">
                       <DocumentEditor documentId={doc.id} isReviewMode={isReviewMode} />
                   </div>
               ) : (
                   <div className="h-full w-full p-4 overflow-y-auto bg-white">
                        <EditorContent editor={editor} className="prose max-w-none outline-none h-full" disabled={doc.status !== 'DRAFT'} />
                   </div>
               )}
            </div>
        </div>

        {/* Sidebar (Right Drawer) */}
        <div className={`absolute top-0 right-0 h-full w-80 bg-white shadow-xl border-l transform transition-transform duration-300 pt-16 z-20 overflow-y-auto
            ${isSidebarOpen ? 'translate-x-0' : 'translate-x-full'}`}>

            <div className="p-4 space-y-6">
                <div className="flex justify-between items-center">
                    <h3 className="font-bold text-gray-700">Управление</h3>
                    <button onClick={() => setIsSidebarOpen(false)} className="text-gray-400 hover:text-gray-600">
                        <ChevronRight className="w-5 h-5" />
                    </button>
                </div>

                {/* Status Block */}
                <div className="bg-gray-50 p-4 rounded-lg">
                    <div className="text-xs text-gray-500 uppercase mb-1">Текущий статус</div>
                    <div className="font-semibold">{doc.status}</div>
                    <div className="text-xs text-gray-400 mt-2">
                        Автор: {doc.author?.name}
                    </div>
                </div>

                {/* Actions for DRAFT */}
                {doc.status === 'DRAFT' && (
                  <div className="border-t pt-4">
                    <h4 className="text-sm font-semibold mb-3">Согласование</h4>
                    {!isEditingApprovers ? (
                        <button
                          onClick={() => setIsEditingApprovers(true)}
                          className="w-full py-2 border border-dashed border-gray-300 rounded text-gray-600 hover:border-primary hover:text-primary flex items-center justify-center gap-2 text-sm"
                        >
                          <UserPlus className="w-4 h-4" /> Назначить
                        </button>
                    ) : (
                        <div className="space-y-3">
                            <p className="text-xs text-gray-500">Выберите сотрудников:</p>
                            <div className="max-h-60 overflow-y-auto border rounded p-2 text-sm">
                               {users.map(u => (
                                   <label key={u.id} className="flex items-center gap-2 p-1 hover:bg-gray-50 cursor-pointer">
                                       <input
                                         type="checkbox"
                                         checked={selectedApprovers.includes(u.id)}
                                         onChange={(e) => {
                                             if(e.target.checked) setSelectedApprovers([...selectedApprovers, u.id]);
                                             else setSelectedApprovers(selectedApprovers.filter(id => id !== u.id));
                                         }}
                                       />
                                       <span>{u.name || u.email}</span>
                                   </label>
                               ))}
                            </div>
                            <div className="grid grid-cols-2 gap-2">
                               <button onClick={handleSendToApproval} className="bg-primary text-white py-1.5 rounded text-xs hover:bg-primary-dark">
                                 Отправить
                               </button>
                               <button onClick={() => setIsEditingApprovers(false)} className="bg-gray-100 text-gray-600 py-1.5 rounded text-xs hover:bg-gray-200">
                                 Отмена
                               </button>
                            </div>
                        </div>
                    )}
                  </div>
                )}

                {/* Actions for APPROVER */}
                {doc.status === 'ON_APPROVAL' && (
                  <div className="border-t pt-4">
                    <h4 className="text-sm font-semibold mb-3">Ваше решение</h4>
                    <div className="flex flex-col gap-2">
                      <button onClick={() => handleVote('APPROVED')} className="w-full bg-green-600 text-white py-2 rounded hover:bg-green-700 flex justify-center items-center gap-2 text-sm">
                        <CheckCircle className="w-4 h-4" /> Принять
                      </button>
                      <button onClick={() => handleVote('REJECTED')} className="w-full bg-red-50 text-red-600 border border-red-200 py-2 rounded hover:bg-red-100 flex justify-center items-center gap-2 text-sm">
                        <XCircle className="w-4 h-4" /> Отказать
                      </button>
                    </div>
                  </div>
                )}
            </div>
        </div>

      </div>
    </div>
  );
};
