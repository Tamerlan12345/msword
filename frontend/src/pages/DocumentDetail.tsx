import React, { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import axios from 'axios';
import { Header } from '../components/Header';
import { useEditor, EditorContent } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import { ArrowLeft, Save, CheckCircle, XCircle, UserPlus, ChevronLeft, ChevronRight, Menu, ArrowUp, ArrowDown, Trash, Send, RotateCcw } from 'lucide-react';
import { DocumentEditor } from '../components/DocumentEditor';
import { clsx } from 'clsx';

export const DocumentDetail = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [doc, setDoc] = useState<any>(null);
  const [users, setUsers] = useState<any[]>([]);
  const [selectedApprovers, setSelectedApprovers] = useState<string[]>([]); // List of User IDs in order
  const [isEditingApprovers, setIsEditingApprovers] = useState(false);
  const [isReviewMode, setIsReviewMode] = useState(false);
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);
  const [currentUser, setCurrentUser] = useState<any>(null);
  const [comment, setComment] = useState('');

  const editor = useEditor({
    extensions: [StarterKit],
    content: '<p>Загрузка...</p>',
  });

  useEffect(() => {
    const u = localStorage.getItem('user');
    if (u) setCurrentUser(JSON.parse(u));
  }, []);

  const fetchDoc = async () => {
    try {
        const docRes = await axios.get(`/api/documents/${id}`);
        setDoc(docRes.data);

        // Update editor content if needed
        if (docRes.data.versions.length === 0 && editor) {
             if (docRes.data.content) {
                try {
                    editor.commands.setContent(JSON.parse(docRes.data.content));
                } catch {
                    editor.commands.setContent(docRes.data.content);
                }
            } else {
                editor.commands.setContent('<p>Начните писать здесь...</p>');
            }
        }
    } catch (e) {
        console.error(e);
    }
  };

  useEffect(() => {
    const init = async () => {
        await fetchDoc();
        const usersRes = await axios.get('/api/users');
        setUsers(usersRes.data);
    };
    init();
  }, [id]);

  // Sync editor content when doc loads initially is handled above in fetchDoc slightly logic
  // But editor instance dependency...
  useEffect(() => {
      if (editor && doc && doc.versions.length === 0 && !editor.getText()) {
         // Set content logic if empty
      }
  }, [doc, editor]);

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
      // Send ordered list
      await axios.post(`/api/documents/${id}/approvers`, { userIds: selectedApprovers });

      setIsEditingApprovers(false);
      fetchDoc();
      alert('Отправлено на согласование!');
    } catch (e) {
      alert('Ошибка отправки');
    }
  };

  const handleForward = async () => {
      try {
          await axios.put(`/api/documents/${id}/forward`, { comment });
          alert('Документ передан дальше');
          setComment('');
          fetchDoc();
      } catch (e) {
          alert('Ошибка передачи');
      }
  };

  const handleFinalize = async (action: 'APPROVE' | 'RESTART') => {
      try {
          if (action === 'APPROVE') {
              await axios.put(`/api/documents/${id}`, { status: 'APPROVED' });
              alert('Документ утвержден и отправлен в архив');
          } else {
              // Restart means going back to Draft
              await axios.put(`/api/documents/${id}`, { status: 'DRAFT' });
              alert('Документ возвращен в черновики');
          }
          fetchDoc();
      } catch (e) {
          alert('Ошибка действия');
      }
  };

  // Approver Selection Helpers
  const addApprover = (userId: string) => {
      if (!selectedApprovers.includes(userId)) {
          setSelectedApprovers([...selectedApprovers, userId]);
      }
  };
  const removeApprover = (index: number) => {
      const newL = [...selectedApprovers];
      newL.splice(index, 1);
      setSelectedApprovers(newL);
  };
  const moveApprover = (index: number, direction: -1 | 1) => {
      if (index + direction < 0 || index + direction >= selectedApprovers.length) return;
      const newL = [...selectedApprovers];
      [newL[index], newL[index + direction]] = [newL[index + direction], newL[index]];
      setSelectedApprovers(newL);
  };

  if (!doc) return <div>Загрузка...</div>;

  const isAuthor = currentUser && doc.authorId === currentUser.id;
  const myApprover = doc.approvers?.find((a: any) => a.userId === currentUser?.id);
  const isCurrentApprover = myApprover?.isCurrent && doc.status === 'ON_APPROVAL';

  // Sort approvers by serialNumber for display
  const sortedApprovers = doc.approvers?.sort((a: any, b: any) => a.serialNumber - b.serialNumber) || [];

  return (
    <div className="h-screen flex flex-col bg-[#F5F6F8] overflow-hidden">
      <Header />

      <div className="flex flex-1 pt-16 overflow-hidden relative">

        {/* Center Content */}
        <div className={`flex-1 flex flex-col transition-all duration-300 ${isSidebarOpen ? 'mr-96' : 'mr-0'}`}>
            {/* Toolbar */}
            <div className="bg-white border-b px-4 py-2 flex justify-between items-center h-14 shadow-sm z-10">
                <div className="flex items-center gap-4">
                    <button onClick={() => navigate('/')} className="text-gray-500 hover:text-gray-700">
                        <ArrowLeft className="w-5 h-5" />
                    </button>
                    <div>
                        <h1 className="text-lg font-bold truncate max-w-md leading-tight">{doc.title}</h1>
                        <div className="flex items-center gap-2 text-xs">
                             <span className={clsx(
                                "px-1.5 py-0.5 rounded font-medium",
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
                              {doc.status === 'ON_APPROVAL' && (
                                  <span className="text-gray-500">
                                      {/* Show current step info */}
                                      {(() => {
                                          const current = sortedApprovers.find((a: any) => a.isCurrent);
                                          if (!current) return '';
                                          const total = sortedApprovers.length;
                                          const step = current.serialNumber + 1;
                                          return `Шаг ${step} из ${total}: У ${current.user?.name || 'пользователя'}`;
                                      })()}
                                  </span>
                              )}
                        </div>
                    </div>
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

            {/* Editor */}
            <div className="flex-1 bg-gray-100 overflow-hidden relative">
               {doc.versions.length > 0 ? (
                   <div className="h-full w-full">
                       <DocumentEditor documentId={doc.id} isReviewMode={isReviewMode} />
                   </div>
               ) : (
                   <div className="h-full w-full p-4 overflow-y-auto bg-white">
                        <EditorContent editor={editor} className="prose max-w-none outline-none h-full" disabled={doc.status !== 'DRAFT' && !isCurrentApprover && !(doc.status === 'REVIEW_REQUIRED' && isAuthor)} />
                   </div>
               )}
            </div>
        </div>

        {/* Sidebar */}
        <div className={`absolute top-0 right-0 h-full w-96 bg-white shadow-xl border-l transform transition-transform duration-300 pt-16 z-20 overflow-y-auto
            ${isSidebarOpen ? 'translate-x-0' : 'translate-x-full'}`}>

            <div className="p-5 space-y-6">
                <div className="flex justify-between items-center">
                    <h3 className="font-bold text-gray-800">Информация</h3>
                    <button onClick={() => setIsSidebarOpen(false)} className="text-gray-400 hover:text-gray-600">
                        <ChevronRight className="w-5 h-5" />
                    </button>
                </div>

                {/* Workflow Status */}
                {doc.approvers?.length > 0 && (
                    <div className="space-y-3">
                        <h4 className="text-sm font-semibold text-gray-700">Маршрут согласования</h4>
                        <div className="space-y-2">
                            {sortedApprovers.map((app: any, idx: number) => (
                                <div key={app.id} className={clsx("p-3 rounded-lg border text-sm relative",
                                    app.isCurrent ? "border-blue-500 bg-blue-50" :
                                    app.status === 'APPROVED' ? "border-green-200 bg-green-50" : "border-gray-200 bg-gray-50"
                                )}>
                                    <div className="flex justify-between items-start">
                                        <span className="font-medium text-gray-900">
                                            {idx + 1}. {app.user?.name || 'User'}
                                        </span>
                                        {app.status === 'APPROVED' && <CheckCircle className="w-4 h-4 text-green-600" />}
                                        {app.isCurrent && <span className="text-xs bg-blue-200 text-blue-800 px-1.5 rounded">Текущий</span>}
                                    </div>
                                    <div className="text-gray-500 text-xs mt-1">
                                        {app.user?.department}
                                    </div>
                                    {app.comment && (
                                        <div className="mt-2 text-xs text-gray-600 bg-white p-2 rounded border border-gray-100 italic">
                                            "{app.comment}"
                                        </div>
                                    )}
                                    {app.actionDate && (
                                        <div className="text-[10px] text-gray-400 mt-1 text-right">
                                            {new Date(app.actionDate).toLocaleString()}
                                        </div>
                                    )}
                                </div>
                            ))}
                        </div>
                    </div>
                )}

                {/* Current Action Block */}
                <div className="border-t pt-4">
                    <h4 className="text-sm font-semibold mb-3">Действия</h4>

                    {/* DRAFT: Author Setup */}
                    {doc.status === 'DRAFT' && isAuthor && (
                         !isEditingApprovers ? (
                            <button
                                onClick={() => setIsEditingApprovers(true)}
                                className="w-full py-2 border border-dashed border-gray-300 rounded text-gray-600 hover:border-primary hover:text-primary flex items-center justify-center gap-2 text-sm"
                            >
                                <UserPlus className="w-4 h-4" /> Настроить маршрут
                            </button>
                         ) : (
                             <div className="bg-gray-50 p-3 rounded-lg border border-gray-200">
                                 <div className="mb-3">
                                     <label className="text-xs font-medium text-gray-500 mb-1 block">Добавить участника:</label>
                                     <select
                                        className="w-full text-sm border rounded p-1.5"
                                        onChange={(e) => {
                                            if (e.target.value) {
                                                addApprover(e.target.value);
                                                e.target.value = '';
                                            }
                                        }}
                                     >
                                         <option value="">Выберите...</option>
                                         {users.filter(u => u.id !== currentUser?.id && !selectedApprovers.includes(u.id)).map(u => (
                                             <option key={u.id} value={u.id}>{u.name} ({u.department || 'Employee'})</option>
                                         ))}
                                     </select>
                                 </div>

                                 <div className="space-y-1 mb-3">
                                     {selectedApprovers.map((uid, idx) => {
                                         const u = users.find(x => x.id === uid);
                                         return (
                                             <div key={uid} className="flex items-center justify-between bg-white p-2 rounded border text-sm">
                                                 <span className="truncate flex-1 text-xs">{idx + 1}. {u?.name}</span>
                                                 <div className="flex gap-1">
                                                     <button onClick={() => moveApprover(idx, -1)} disabled={idx === 0} className="p-0.5 hover:bg-gray-100 disabled:opacity-30"><ArrowUp className="w-3 h-3" /></button>
                                                     <button onClick={() => moveApprover(idx, 1)} disabled={idx === selectedApprovers.length - 1} className="p-0.5 hover:bg-gray-100 disabled:opacity-30"><ArrowDown className="w-3 h-3" /></button>
                                                     <button onClick={() => removeApprover(idx)} className="p-0.5 hover:bg-red-50 text-red-500"><Trash className="w-3 h-3" /></button>
                                                 </div>
                                             </div>
                                         )
                                     })}
                                     {selectedApprovers.length === 0 && <p className="text-xs text-gray-400 text-center italic">Список пуст</p>}
                                 </div>

                                 <div className="grid grid-cols-2 gap-2">
                                     <button onClick={handleSendToApproval} disabled={selectedApprovers.length === 0} className="bg-primary text-white py-1.5 rounded text-xs hover:bg-primary-dark disabled:opacity-50">
                                         Запустить
                                     </button>
                                     <button onClick={() => setIsEditingApprovers(false)} className="bg-white border text-gray-600 py-1.5 rounded text-xs hover:bg-gray-50">
                                         Отмена
                                     </button>
                                 </div>
                             </div>
                         )
                    )}

                    {/* ON_APPROVAL: Current Approver Action */}
                    {doc.status === 'ON_APPROVAL' && isCurrentApprover && (
                        <div className="bg-blue-50 p-4 rounded-lg border border-blue-100">
                            <p className="text-sm font-medium text-blue-900 mb-2">Ваша очередь!</p>
                            <textarea
                                className="w-full text-sm p-2 border rounded mb-3 focus:outline-none focus:border-blue-500"
                                rows={3}
                                placeholder="Напишите комментарий (обязательно или опционально)..."
                                value={comment}
                                onChange={(e) => setComment(e.target.value)}
                            />
                            <button
                                onClick={handleForward}
                                className="w-full bg-blue-600 text-white py-2 rounded flex justify-center items-center gap-2 hover:bg-blue-700 transition-colors"
                            >
                                <Send className="w-4 h-4" /> Передать дальше
                            </button>
                        </div>
                    )}

                    {/* ON_APPROVAL: Others */}
                    {doc.status === 'ON_APPROVAL' && !isCurrentApprover && (
                         <div className="p-3 bg-gray-50 rounded text-center text-sm text-gray-500 italic">
                             Ожидание действий от {sortedApprovers.find((a: any) => a.isCurrent)?.user?.name || 'текущего согласующего'}
                         </div>
                    )}

                    {/* REVIEW_REQUIRED: Author Action */}
                    {doc.status === 'REVIEW_REQUIRED' && isAuthor && (
                        <div className="bg-yellow-50 p-4 rounded-lg border border-yellow-100">
                            <p className="text-sm font-medium text-yellow-900 mb-2">Согласование завершено. Проверьте правки.</p>
                            <div className="grid grid-cols-1 gap-2">
                                <button
                                    onClick={() => handleFinalize('APPROVE')}
                                    className="w-full bg-green-600 text-white py-2 rounded flex justify-center items-center gap-2 hover:bg-green-700"
                                >
                                    <CheckCircle className="w-4 h-4" /> Утвердить и в Архив
                                </button>
                                <button
                                    onClick={() => handleFinalize('RESTART')}
                                    className="w-full bg-white border border-gray-300 text-gray-700 py-2 rounded flex justify-center items-center gap-2 hover:bg-gray-50"
                                >
                                    <RotateCcw className="w-4 h-4" /> Вернуть на доработку
                                </button>
                            </div>
                        </div>
                    )}

                    {/* FINAL STATES */}
                    {(doc.status === 'APPROVED' || doc.status === 'REJECTED') && (
                         <div className="p-3 bg-gray-100 rounded text-center text-sm text-gray-600">
                             Документ в архиве ({doc.status})
                         </div>
                    )}
                </div>

            </div>
        </div>

      </div>
    </div>
  );
};
