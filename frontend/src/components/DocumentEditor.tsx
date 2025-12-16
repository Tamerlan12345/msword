import React, { useEffect, useState } from 'react';
import { DocumentEditor as OnlyOfficeEditor } from "@onlyoffice/document-editor-react";
import axios from 'axios';

interface DocumentEditorProps {
  documentId: string;
  isReviewMode: boolean;
}

export const DocumentEditor: React.FC<DocumentEditorProps> = ({ documentId, isReviewMode }) => {
  const [config, setConfig] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchConfig = async () => {
      setLoading(true);
      try {
        const response = await axios.get(`/api/documents/${documentId}/onlyoffice-config`, {
            params: { review: isReviewMode }
        });
        setConfig(response.data);
      } catch (err) {
        console.error("Failed to load editor config", err);
        setError("Не удалось загрузить редактор");
      } finally {
        setLoading(false);
      }
    };

    fetchConfig();
  }, [documentId, isReviewMode]);

  if (loading) return <div>Загрузка редактора...</div>;
  if (error) return <div className="text-red-500">{error}</div>;
  if (!config) return <div>Ошибка конфигурации</div>;

  return (
    <div className="h-[800px] w-full">
      <OnlyOfficeEditor
        id="docxEditor"
        documentServerUrl="http://localhost:8080" // External URL for the browser
        config={config}
        events_onDocumentReady={() => console.log("Document Ready")}
      />
    </div>
  );
};
