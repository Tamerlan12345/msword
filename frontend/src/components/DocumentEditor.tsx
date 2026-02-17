import React, { useState, useEffect } from 'react';
import axios from 'axios';

interface DocumentEditorProps {
  documentId: string;
  isReviewMode?: boolean;
}

export const DocumentEditor: React.FC<DocumentEditorProps> = ({ documentId }) => {
  const token = localStorage.getItem('token');
  const apiUrl = import.meta.env.VITE_API_URL || 'https://dmbp1.up.railway.app';
  const [collaboraUrl, setCollaboraUrl] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchConfig = async () => {
      try {
        const res = await axios.get('/api/config');
        if (res.data.collaboraUrl) {
          setCollaboraUrl(res.data.collaboraUrl);
        } else {
          setError("Администратор не настроил COLLABORA_PUBLIC_URL на сервере");
        }
      } catch (err) {
        console.error("Failed to fetch config", err);
        setError("Ошибка получения конфигурации");
      }
    };
    fetchConfig();
  }, []);

  if (!token) {
      return <div className="p-8 text-center text-red-600">Нет токена доступа. Пожалуйста, войдите снова.</div>;
  }

  if (error) {
      return <div className="p-8 text-center text-red-600">{error}</div>;
  }

  if (!collaboraUrl) {
      return <div className="p-8 text-center text-gray-500">Загрузка настроек редактора...</div>;
  }

  const wopiSrc = `${apiUrl}/api/wopi/files/${documentId}`;
  const iframeSrc = `${collaboraUrl}/browser/dist/cool.html?WOPISrc=${encodeURIComponent(wopiSrc)}&access_token=${encodeURIComponent(token)}`;

  return (
    <div className="flex flex-col h-[800px] w-full border rounded-lg overflow-hidden bg-white shadow-sm relative">
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
