import React, { useEffect, useState, useRef } from 'react';
import axios from 'axios';

interface DocumentEditorProps {
  documentId: string;
  isReviewMode: boolean;
}

export const DocumentEditor: React.FC<DocumentEditorProps> = ({ documentId, isReviewMode }) => {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const editorInitialized = useRef(false);
  const docEditorRef = useRef<any>(null);

  useEffect(() => {
    // Prevent double init
    if (editorInitialized.current) return;

    const scriptId = 'onlyoffice-api-script';
    let script = document.getElementById(scriptId) as HTMLScriptElement;

    const initEditor = async () => {
      try {
        setLoading(true);
        // Fetch config from backend
        const { data: config } = await axios.get(`/api/documents/${documentId}/onlyoffice/config`);

        // Adjust config for review mode if needed
        if (config.editorConfig) {
             // If isReviewMode is true, we might want to ensure track changes is on or similar.
             // But usually 'review' permission in config handles availability of review tab.
             // config.document.permissions.review is set in backend.
             // We can enforce mode here if needed.
        }

        if ((window as any).DocsAPI) {
             // Destroy existing if any (though we guard with ref)
             if (docEditorRef.current) {
                 // Clean up not easily possible without destroying iframe, which react does on unmount
             }

             // Initialize editor
             // We use a unique ID for the placeholder to avoid conflicts if multiple editors?
             // But we only show one here.
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
        if (!script) {
            script = document.createElement('script');
            script.id = scriptId;
            script.src = 'http://localhost:8081/web-apps/apps/api/documents/api.js';
            script.async = true;
            script.onload = () => initEditor();
            script.onerror = () => {
                setError("Не удалось загрузить скрипт ONLYOFFICE (http://localhost:8081).");
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
      // Cleanup
      editorInitialized.current = false;
      if (docEditorRef.current) {
          // If the API supports destroy, call it.
          // Otherwise, React removing the div is enough usually.
          docEditorRef.current = null;
      }
    };
  }, [documentId]);

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
