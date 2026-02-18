import React, { useEffect, useState, useRef } from 'react';
import axios from 'axios';

interface CollaboraEditorProps {
  documentId: string;
  token: string;
}

export const CollaboraEditor: React.FC<CollaboraEditorProps> = ({ documentId, token }) => {
  const [iframeSrc, setIframeSrc] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const iframeRef = useRef<HTMLIFrameElement>(null);

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

  // Zoom fix: Listen for document load and force 100% zoom
  useEffect(() => {
    const handleMessage = (event: MessageEvent) => {
      if (!event.data) return;

      try {
        const msg = typeof event.data === 'string' ? JSON.parse(event.data) : event.data;

        // Listen for document loaded status
        if (msg.MessageId === 'App_LoadingStatus' && msg.Values?.Status === 'Document_Loaded') {
           // Send Zoom 100% command using UNO dispatch via PostMessage
           const zoomCmd = {
             "MessageId": "ClickedButton",
             "Values": {
               "Id": ".uno:Zoom100Percent"
             }
           };

           if (iframeRef.current && iframeRef.current.contentWindow) {
             iframeRef.current.contentWindow.postMessage(JSON.stringify(zoomCmd), '*');
           }
        }
      } catch (e) {
        // Ignore non-JSON messages
      }
    };

    window.addEventListener('message', handleMessage);
    return () => window.removeEventListener('message', handleMessage);
  }, []);

  if (error) return <div className="p-8 text-center text-red-600">{error}</div>;
  if (!iframeSrc) return <div className="p-8 text-center text-gray-500">Загрузка редактора...</div>;

  return (
    <div className="flex flex-col h-[800px] w-full border rounded-lg overflow-hidden bg-white shadow-sm relative">
      <iframe
        ref={iframeRef}
        src={iframeSrc}
        title="Collabora Online Editor"
        style={{ width: '100%', height: '100%', border: 'none' }}
        allow="autoplay; camera; microphone; display-capture"
      />
    </div>
  );
};
