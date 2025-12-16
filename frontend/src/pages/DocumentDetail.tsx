import React, { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import axios from 'axios';
import { Header } from '../components/Header';
import { useEditor, EditorContent } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import { ArrowLeft, Save, CheckCircle, XCircle, UserPlus, Users } from 'lucide-react';
import { DocumentEditor } from '../components/DocumentEditor';

export const DocumentDetail = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [doc, setDoc] = useState<any>(null);
  const [users, setUsers] = useState<any[]>([]); // Все юзеры для выбора
  const [selectedApprovers, setSelectedApprovers] = useState<string[]>([]); // Выбранные ID
  const [isEditingApprovers, setIsEditingApprovers] = useState(false);
  const [isReviewMode, setIsReviewMode] = useState(false);

  // Настройка редактора Tiptap (используется если нет файла)
  const editor = useEditor({
    extensions: [StarterKit],
    content: '<p>Загрузка...</p>',
    onUpdate: ({ editor }) => {
      // Здесь можно реализовать автосохранение
      // const json = editor.getJSON();
    },
  });

  // Загрузка данных
  useEffect(() => {
    const fetchData = async () => {
      try {
        const [docRes, usersRes] = await Promise.all([
          axios.get(`/api/documents/${id}`),
          axios.get('/api/users')
        ]);

        setDoc(docRes.data);
        setUsers(usersRes.data);

        // Установка контента в редактор (только если нет файла)
        if (docRes.data.versions.length === 0) {
            if (editor && docRes.data.content) {
                // Если контент - JSON строка, парсим, иначе HTML
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

  // Сохранение контента (для Tiptap)
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

  // Отправка на согласование с выбором людей
  const handleSendToApproval = async () => {
    if (selectedApprovers.length === 0) return alert('Выберите хотя бы одного согласующего');

    try {
      // Сначала сохраняем текст (если это tiptap)
      if (doc.versions.length === 0) {
          await handleSaveContent();
      }
      // Потом назначаем людей
      await axios.post(`/api/documents/${id}/approvers`, { userIds: selectedApprovers });

      setDoc({ ...doc, status: 'ON_APPROVAL' });
      setIsEditingApprovers(false);
      alert('Отправлено на согласование!');
    } catch (e) {
      alert('Ошибка отправки');
    }
  };

  // Голосование (для согласующего)
  const handleVote = async (status: 'APPROVED' | 'REJECTED') => {
    const comment = status === 'REJECTED' ? prompt('Укажите причину отказа:') : null;
    if (status === 'REJECTED' && !comment) return;

    try {
      await axios.put(`/api/documents/${id}/approve`, { status, comment });
      alert('Ваш голос учтен');
      navigate('/'); // Вернуться на дашборд
    } catch (e) {
      alert('Ошибка');
    }
  };

  if (!doc) return <div>Загрузка...</div>;

  return (
    <div className="min-h-screen bg-[#F5F6F8] pb-20">
      <Header />

      <div className="max-w-5xl mx-auto px-6 py-8">
        <button onClick={() => navigate('/')} className="flex items-center gap-2 text-gray-500 mb-4">
          <ArrowLeft className="w-4 h-4" /> Назад
        </button>

        <div className="grid grid-cols-3 gap-6">

          {/* ЛЕВАЯ КОЛОНКА: Редактор */}
          <div className="col-span-2 bg-white rounded-lg shadow-sm p-6 min-h-[600px]">
            <div className="flex justify-between items-center mb-4 border-b pb-4">
              <h1 className="text-2xl font-bold">{doc.title}</h1>
              <div className="flex gap-2">
                 {doc.versions.length > 0 && doc.status === 'DRAFT' && (
                     <button
                        onClick={() => setIsReviewMode(!isReviewMode)}
                        className={`px-3 py-1 rounded border text-sm ${isReviewMode ? 'bg-blue-100 border-blue-300 text-blue-700' : 'bg-gray-50 border-gray-300'}`}
                     >
                        {isReviewMode ? 'Режим рецензирования ВКЛ' : 'Режим рецензирования'}
                     </button>
                 )}

                 {doc.status === 'DRAFT' && doc.versions.length === 0 && (
                    <button onClick={handleSaveContent} className="flex items-center gap-2 text-primary hover:bg-blue-50 px-3 py-1 rounded">
                    <Save className="w-4 h-4" /> Сохранить
                    </button>
                 )}
              </div>
            </div>

            {/* Область редактора */}
            <div className="prose max-w-none border p-4 rounded min-h-[500px] outline-none w-full">
               {doc.versions.length > 0 ? (
                   <DocumentEditor documentId={doc.id} isReviewMode={isReviewMode} />
               ) : (
                   <EditorContent editor={editor} disabled={doc.status !== 'DRAFT'} />
               )}
            </div>
          </div>

          {/* ПРАВАЯ КОЛОНКА: Управление и Согласование */}
          <div className="col-span-1 space-y-6">

            {/* Блок статуса */}
            <div className="bg-white p-6 rounded-lg shadow-sm">
               <h3 className="text-sm font-semibold text-gray-500 uppercase mb-2">Статус</h3>
               <div className={`inline-flex px-3 py-1 rounded-full text-sm font-bold
                 ${doc.status === 'APPROVED' ? 'bg-green-100 text-green-700' :
                   doc.status === 'ON_APPROVAL' ? 'bg-blue-100 text-blue-700' : 'bg-gray-100 text-gray-700'}`}>
                 {doc.status}
               </div>
            </div>

            {/* Блок действий для АВТОРА (Черновик) */}
            {doc.status === 'DRAFT' && (
              <div className="bg-white p-6 rounded-lg shadow-sm">
                <h3 className="text-sm font-semibold text-gray-500 uppercase mb-4">Маршрут согласования</h3>

                {!isEditingApprovers ? (
                    <button
                      onClick={() => setIsEditingApprovers(true)}
                      className="w-full py-2 border-2 border-dashed border-gray-300 rounded text-gray-500 hover:border-primary hover:text-primary flex items-center justify-center gap-2"
                    >
                      <UserPlus className="w-4 h-4" /> Выбрать согласующих
                    </button>
                ) : (
                    <div className="space-y-3">
                        <p className="text-xs text-gray-500">Выберите сотрудников:</p>
                        <div className="max-h-40 overflow-y-auto border rounded p-2">
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
                                   <span className="text-sm">{u.name || u.email}</span>
                               </label>
                           ))}
                        </div>
                        <div className="flex gap-2">
                           <button onClick={handleSendToApproval} className="w-full bg-primary text-white py-2 rounded text-sm hover:bg-primary-dark">
                             Отправить
                           </button>
                           <button onClick={() => setIsEditingApprovers(false)} className="px-3 py-2 text-gray-500 text-sm">
                             Отмена
                           </button>
                        </div>
                    </div>
                )}
              </div>
            )}

            {/* Блок действий для СОГЛАСУЮЩЕГО */}
            {doc.status === 'ON_APPROVAL' && (
              <div className="bg-white p-6 rounded-lg shadow-sm border-l-4 border-blue-500">
                <h3 className="font-bold mb-4">Требуется ваше решение</h3>
                <div className="flex gap-3">
                  <button onClick={() => handleVote('APPROVED')} className="flex-1 bg-green-600 text-white py-2 rounded hover:bg-green-700 flex justify-center items-center gap-2">
                    <CheckCircle className="w-4 h-4" /> Принять
                  </button>
                  <button onClick={() => handleVote('REJECTED')} className="flex-1 bg-red-50 text-red-600 border border-red-200 py-2 rounded hover:bg-red-100 flex justify-center items-center gap-2">
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
