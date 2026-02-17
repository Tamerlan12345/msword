import React, { useEffect, useState } from 'react';
import axios from 'axios';

interface CollaboraEditorProps {
  documentId: string;
  token: string;
}

export const CollaboraEditor: React.FC<CollaboraEditorProps> = ({ documentId, token }) => {
  const [iframeSrc, setIframeSrc] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchUrl = async () => {
      try {
        // We use /api/wopi/iframe which returns the full src (including WOPISrc and token)
        // This endpoint logic is in backend/src/routes/wopiRoutes.ts
        const { data } = await axios.get(`/api/wopi/iframe/${documentId}`, {
            headers: { Authorization: `Bearer ${token}` }
        });
        setIframeSrc(data.url);
      } catch (err) {
        console.error("Failed to get WOPI URL", err);
        setError("Не удалось загрузить редактор (WOPI Discovery Error).");
      }
    };
    fetchUrl();
  }, [documentId, token]);

  useEffect(() => {
    const handleMessage = (event: MessageEvent) => {
      // Listen to PostMessage events from Collabora
      // useful for UI_SaveAs, App_LoadingStatus etc.
      if (event.data) {
        console.log('Collabora Message:', event.data);
      }
    };

    window.addEventListener('message', handleMessage);
    return () => window.removeEventListener('message', handleMessage);
  }, []);

  if (error) return <div className="p-8 text-center text-red-600">{error}</div>;
  if (!iframeSrc) return <div className="p-8 text-center text-gray-500">Загрузка редактора...</div>;

  return (
    <div className="flex flex-col h-[calc(100vh-4rem)] w-full border rounded-lg overflow-hidden bg-white shadow-sm relative">
      <iframe
        src={iframeSrc}
        title="Collabora Online Editor"
        style={{ width: '100%', height: '100%', border: 'none' }}
        allow="autoplay; camera; microphone; display-capture"
      />
    </div>
  );
};
