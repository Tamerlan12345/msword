import React from 'react';

interface DocumentEditorProps {
  documentId: string;
  isReviewMode?: boolean;
}

export const DocumentEditor: React.FC<DocumentEditorProps> = ({ documentId }) => {
  const token = localStorage.getItem('token');
  const apiUrl = import.meta.env.VITE_API_URL || 'https://dmbp.up.railway.app';
  const collaboraUrl = import.meta.env.VITE_COLLABORA_URL;

  if (!token) {
      return <div className="p-8 text-center text-red-600">Нет токена доступа. Пожалуйста, войдите снова.</div>;
  }

  if (!collaboraUrl) {
      return <div className="p-8 text-center text-red-600">Не настроен URL Collabora (VITE_COLLABORA_URL).</div>;
  }

  const wopiSrc = `${apiUrl}/wopi/files/${documentId}`;
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
