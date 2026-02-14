import React, { useEffect, useState, useRef } from 'react';
import axios from 'axios';
import { CollaboraEditor } from './CollaboraEditor';

interface DocumentEditorProps {
  documentId: string;
  isReviewMode: boolean;
}

export const DocumentEditor: React.FC<DocumentEditorProps> = ({ documentId, isReviewMode }) => {
  const useCollabora = true; // Enable Collabora by default for migration
  const token = localStorage.getItem('token');

  if (useCollabora && token) {
      return <CollaboraEditor documentId={documentId} token={token} />;
  }

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const editorInitialized = useRef(false);
  const docEditorRef = useRef<any>(null);

  // Получаем URL API OnlyOffice. 
  // При локальной разработке это обычно http://localhost:8081
  // В продакшене это должен быть публичный URL
  const onlyOfficeUrl = import.meta.env.VITE_ONLYOFFICE_URL || 'http://localhost:8081';

  useEffect(() => {
    if (useCollabora) return; // Skip ONLYOFFICE init if using Collabora

    // Prevent double init
    if (editorInitialized.current) return;

    const scriptId = 'onlyoffice-api-script';
    let script = document.getElementById(scriptId) as HTMLScriptElement;

    const initEditor = async () => {
      try {
        setLoading(true);
        // Fetch config from backend
        const { data: config } = await axios.get(`/api/documents/${documentId}/onlyoffice/config`);

        if ((window as any).DocsAPI) {
             if (docEditorRef.current) {
                 // Clean up logic if needed
             }

             // Инициализация редактора
             docEditorRef.current = new (window as any).DocsAPI.DocEditor("onlyoffice-editor-placeholder", config);
             editorInitialized.current = true;
        } else {
             throw new Error("DocsAPI not found");
        }
      } catch (err) {
        console.error("Editor Init Error:", err);
        setError("Не удалось инициализировать редактор ONLYOFFICE. Проверьте настройки сервера.");
      } finally {
        setLoading(false);
      }
    };

    const loadScript = () => {
        // Проверяем, загружен ли уже скрипт
        if (!script) {
            script = document.createElement('script');
            script.id = scriptId;
            // ИСПОЛЬЗУЕМ ПЕРЕМЕННУЮ ВМЕСТО ХАРДКОДА
            script.src = `${onlyOfficeUrl}/web-apps/apps/api/documents/api.js`;
            script.async = true;
            script.onload = () => initEditor();
            script.onerror = () => {
                setError(`Не удалось загрузить скрипт ONLYOFFICE (${onlyOfficeUrl}). Убедитесь, что сервер запущен и доступен.`);
                setLoading(false);
            };
            document.body.appendChild(script);
        } else {
            if ((window as any).DocsAPI) {
                initEditor();
            } else {
                script.addEventListener('load', () => initEditor());
            }
        }
    };

    loadScript();

    return () => {
      editorInitialized.current = false;
      if (docEditorRef.current) {
          docEditorRef.current = null;
      }
    };
  }, [documentId, onlyOfficeUrl]);

  if (error) return <div className="p-8 text-center text-red-600">{error}</div>;

  return (
    <div className="flex flex-col h-[800px] w-full border rounded-lg overflow-hidden bg-white shadow-sm relative">
       {loading && (
        <div className="absolute inset-0 flex items-center justify-center bg-gray-50 z-10 text-gray-500">
            Загрузка редактора...
        </div>
       )}
      <div id="onlyoffice-editor-placeholder" className="w-full h-full" />
    </div>
  );
};
