import React, { useState } from 'react';
import { X, Upload, FileText, GripVertical } from 'lucide-react';
import { clsx } from 'clsx';
import axios from 'axios';

interface NewDocumentModalProps {
  onClose: () => void;
  onSuccess: () => void;
}

export const NewDocumentModal = ({ onClose, onSuccess }: NewDocumentModalProps) => {
  const [step, setStep] = useState(1);
  const [file, setFile] = useState<File | null>(null);
  const [title, setTitle] = useState('');
  const [uploading, setUploading] = useState(false);

  const handleFileDrop = (e: React.DragEvent) => {
    e.preventDefault();
    const droppedFile = e.dataTransfer.files[0];
    if (droppedFile && droppedFile.name.endsWith('.docx')) {
      setFile(droppedFile);
      if (!title) setTitle(droppedFile.name.replace('.docx', ''));
    }
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0];
    if (selectedFile) {
      setFile(selectedFile);
      if (!title) setTitle(selectedFile.name.replace('.docx', ''));
    }
  };

  const handleSubmit = async () => {
    if (!file || !title) return;

    setUploading(true);
    const formData = new FormData();
    formData.append('file', file);
    formData.append('title', title);
    // formData.append('authorId', '...'); // Handled by backend for now

    try {
      await axios.post('/api/documents', formData, {
        headers: { 'Content-Type': 'multipart/form-data' }
      });
      onSuccess();
      onClose();
    } catch (error) {
      console.error('Upload failed', error);
    } finally {
      setUploading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
      <div className="bg-white rounded-lg shadow-xl w-full max-w-2xl overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
          <h2 className="text-lg font-bold text-gray-800">Новый документ</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6">
          {step === 1 && (
            <div className="space-y-6">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Название документа
                </label>
                <input
                  type="text"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  className="w-full px-4 py-2 border border-gray-200 rounded-md focus:outline-none focus:ring-2 focus:ring-primary/50"
                  placeholder="Введите название"
                />
              </div>

              <div
                onDragOver={(e) => e.preventDefault()}
                onDrop={handleFileDrop}
                className={clsx(
                  "border-2 border-dashed rounded-lg p-10 text-center transition-colors",
                  file ? "border-primary bg-primary/5" : "border-gray-200 hover:border-primary/50"
                )}
              >
                <input
                  type="file"
                  accept=".docx"
                  onChange={handleFileSelect}
                  className="hidden"
                  id="file-upload"
                />
                <label htmlFor="file-upload" className="cursor-pointer flex flex-col items-center gap-3">
                  {file ? (
                    <>
                      <FileText className="w-12 h-12 text-primary" />
                      <div>
                        <p className="font-medium text-gray-800">{file.name}</p>
                        <p className="text-sm text-gray-500">{(file.size / 1024 / 1024).toFixed(2)} MB</p>
                      </div>
                    </>
                  ) : (
                    <>
                      <Upload className="w-12 h-12 text-gray-400" />
                      <div>
                        <p className="font-medium text-gray-700">Перетащите файл .docx сюда</p>
                        <p className="text-sm text-gray-400 mt-1">или нажмите, чтобы выбрать</p>
                      </div>
                    </>
                  )}
                </label>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="bg-gray-50 px-6 py-4 flex justify-end gap-3 border-t border-gray-100">
          <button
            onClick={onClose}
            className="px-4 py-2 text-gray-600 hover:bg-gray-100 rounded-md font-medium text-sm"
          >
            Отмена
          </button>
          <button
            onClick={handleSubmit}
            disabled={!file || !title || uploading}
            className="px-4 py-2 bg-primary hover:bg-primary-light text-white rounded-md font-medium text-sm disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {uploading ? 'Загрузка...' : 'Далее'}
          </button>
        </div>
      </div>
    </div>
  );
};
