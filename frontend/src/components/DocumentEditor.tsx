import React, { useState, useEffect } from 'react';
import axios from 'axios';

interface DocumentEditorProps {
  documentId: string;
  isReviewMode?: boolean;
}

export const DocumentEditor: React.FC<DocumentEditorProps> = ({ documentId }) => {
  const token = localStorage.getItem('token');
  const [iframeSrc, setIframeSrc] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchIframeUrl = async () => {
      try {
        // Fetch the secure URL (which includes WOPISrc and access_token=UUID)
        const res = await axios.get(`/api/wopi/iframe/${documentId}`);
        setIframeSrc(res.data.url);
      } catch (err) {
        console.error("Failed to fetch WOPI URL", err);
        setError("Ошибка загрузки редактора (WOPI Error). Попробуйте обновить страницу.");
      }
    };

    if (documentId) {
        fetchIframeUrl();
    }
  }, [documentId]);

  if (!token) {
      return <div className="p-8 text-center text-red-600">Нет токена доступа. Пожалуйста, войдите снова.</div>;
  }

  if (error) {
      return <div className="p-8 text-center text-red-600">{error}</div>;
  }

  if (!iframeSrc) {
      return <div className="p-8 text-center text-gray-500">Загрузка редактора...</div>;
  }

  return (
    <div className="flex flex-col h-full w-full border-none overflow-hidden bg-white shadow-sm relative">
      <iframe
        src={iframeSrc}
        width="100%"
        height="100%"
        title="Collabora Editor"
        style={{ border: 'none' }}
        allow="autoplay; camera; microphone; display-capture"
      />
    </div>
  );
};
