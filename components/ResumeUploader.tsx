import React, { useRef, useState } from 'react';
import { Upload, FileText, CheckCircle, AlertCircle } from 'lucide-react';
import { geminiService } from '../services/geminiService';
import { ResumeData } from '../types';
import { Button } from './Button';

interface ResumeUploaderProps {
  onUploadComplete: (data: ResumeData) => void;
}

export const ResumeUploader: React.FC<ResumeUploaderProps> = ({ onUploadComplete }) => {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [fileName, setFileName] = useState<string | null>(null);

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!['application/pdf', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document', 'text/plain'].includes(file.type)) {
      setError("Please upload a PDF, DOCX, or TXT file.");
      return;
    }

    try {
      setIsUploading(true);
      setError(null);
      
      const parsedData = await geminiService.parseResume(file);
      setFileName(file.name);
      onUploadComplete(parsedData);
      
    } catch (err: any) {
      // Display the formatted error from service
      setError(err.message || "Failed to parse resume.");
      console.error(err);
    } finally {
      setIsUploading(false);
    }
  };

  return (
    <div className="bg-dark-800 rounded-xl p-6 border border-dark-700 shadow-lg">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-semibold text-white flex items-center gap-2">
          <FileText className="w-5 h-5 text-secondary" />
          Context Source
        </h3>
        {fileName && <span className="text-xs px-2 py-1 rounded bg-green-500/10 text-green-400 border border-green-500/20">Active</span>}
      </div>

      {!fileName ? (
        <div 
          onClick={() => fileInputRef.current?.click()}
          className="border-2 border-dashed border-dark-600 rounded-lg p-8 text-center cursor-pointer hover:border-primary/50 hover:bg-dark-700/50 transition-all group"
        >
          <Upload className="w-8 h-8 mx-auto text-gray-500 group-hover:text-primary mb-3" />
          <p className="text-sm text-gray-400 group-hover:text-gray-200">
            Click to upload Resume (PDF/DOCX)
          </p>
          <input 
            type="file" 
            ref={fileInputRef} 
            className="hidden" 
            accept=".pdf,.docx,.txt"
            onChange={handleFileChange}
          />
        </div>
      ) : (
        <div className="flex items-center gap-3 p-3 bg-dark-700 rounded-lg border border-dark-600">
          <CheckCircle className="w-5 h-5 text-primary shrink-0" />
          <div className="overflow-hidden">
            <p className="text-sm font-medium text-white truncate">{fileName}</p>
            <p className="text-xs text-gray-400">Context loaded successfully</p>
          </div>
          <Button 
            variant="ghost" 
            size="sm" 
            onClick={() => {
                setFileName(null);
                if(fileInputRef.current) fileInputRef.current.value = '';
            }} 
            className="ml-auto"
          >
            Change
          </Button>
        </div>
      )}

      {isUploading && (
        <div className="mt-4 text-xs text-center text-secondary animate-pulse">
          Analyzing document structure with Gemini...
        </div>
      )}

      {error && (
        <div className="mt-4 p-3 bg-red-500/10 border border-red-500/20 rounded-lg flex items-center gap-2 text-xs text-red-400">
          <AlertCircle className="w-4 h-4 shrink-0" />
          <span>{error}</span>
        </div>
      )}
    </div>
  );
};