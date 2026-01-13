import React, { useEffect, useState } from 'react';
import axios from 'axios';

interface DocumentEditorProps {
  documentId: string;
  isReviewMode: boolean;
}

export const DocumentEditor: React.FC<DocumentEditorProps> = ({ documentId, isReviewMode }) => {
  const [googleFileId, setGoogleFileId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [syncing, setSyncing] = useState(false);

  useEffect(() => {
    const initSession = async () => {
      try {
        setLoading(true);
        // Initialize Google Drive session (upload file if needed)
        const res = await axios.post(`/api/documents/${documentId}/google/init`);
        setGoogleFileId(res.data.googleFileId);
      } catch (err) {
        console.error("Google Init Failed", err);
        setError("Не удалось инициализировать Google редактор. Проверьте настройки сервера и ключи доступа.");
      } finally {
        setLoading(false);
      }
    };

    initSession();
  }, [documentId]);

  const handleSync = async (cleanup = false) => {
    try {
      setSyncing(true);
      // Sync from Google Drive to local server
      await axios.post(`/api/documents/${documentId}/google/sync`);

      if (cleanup) {
          // Cleanup from Google Drive
          await axios.post(`/api/documents/${documentId}/google/cleanup`);
          setGoogleFileId(null);
          alert("Документ сохранен и сессия завершена.");
          // Ideally redirect or notify parent
      } else {
          alert("Сохранено на сервер!");
      }
    } catch (err) {
      console.error("Sync failed", err);
      alert("Ошибка синхронизации. Проверьте консоль.");
    } finally {
      setSyncing(false);
    }
  };

  if (loading) return <div className="p-8 text-center text-gray-600">Загрузка Google Docs...</div>;
  if (error) return <div className="p-8 text-center text-red-600">{error}</div>;
  if (!googleFileId) return <div className="p-8 text-center text-gray-600">Сессия редактора не активна.</div>;

  return (
    <div className="flex flex-col h-[800px] w-full border rounded-lg overflow-hidden bg-white shadow-sm">
      <div className="flex justify-between items-center p-3 bg-gray-50 border-b">
        <div className="flex items-center gap-2">
            <span className="font-semibold text-gray-700">Google Docs Editor</span>
            {isReviewMode && <span className="text-xs bg-yellow-100 text-yellow-800 px-2 py-0.5 rounded">Review Mode</span>}
        </div>
        <div className="space-x-2">
            <button
                onClick={() => handleSync(false)}
                disabled={syncing}
                className="px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded hover:bg-blue-700 disabled:opacity-50 transition-colors"
            >
                {syncing ? 'Сохранение...' : 'Сохранить'}
            </button>
            <button
                onClick={() => handleSync(true)}
                disabled={syncing}
                className="px-4 py-2 bg-gray-600 text-white text-sm font-medium rounded hover:bg-gray-700 disabled:opacity-50 transition-colors"
            >
                Сохранить и закрыть
            </button>
        </div>
      </div>
      <iframe
        src={`https://docs.google.com/document/d/${googleFileId}/edit?embedded=true`}
        className="w-full h-full border-none flex-1"
        allow="autoplay"
        title="Google Docs"
      />
    </div>
  );
};
