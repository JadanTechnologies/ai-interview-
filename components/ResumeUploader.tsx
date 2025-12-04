import React, { useRef, useState } from 'react';
import { Upload, FileText, CheckCircle, AlertCircle, RefreshCw } from 'lucide-react';
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

    // Reset previous states
    setError(null);
    setFileName(null);
    if (fileInputRef.current) fileInputRef.current.value = '';

    if (!['application/pdf', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document', 'text/plain'].includes(file.type)) {
      setError("Invalid file type. Please upload a PDF, DOCX, or TXT file.");
      return;
    }

    try {
      setIsUploading(true);
      
      const parsedData = await geminiService.parseResume(file);
      setFileName(file.name);
      onUploadComplete(parsedData);
      
    } catch (err: any) {
      // Display the robust error message from service
      setError(err.message || "Failed to parse resume. Please try again.");
      console.error(err);
    } finally {
      setIsUploading(false);
    }
  };

  const handleRetry = () => {
    setError(null);
    fileInputRef.current?.click();
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
          onClick={() => !isUploading && fileInputRef.current?.click()}
          className={`border-2 border-dashed border-dark-600 rounded-lg p-8 text-center cursor-pointer transition-all group ${isUploading ? 'opacity-50 cursor-wait' : 'hover:border-primary/50 hover:bg-dark-700/50'}`}
        >
            {isUploading ? (
                <div className="flex flex-col items-center">
                    <RefreshCw className="w-8 h-8 text-primary animate-spin mb-3" />
                    <p className="text-sm text-gray-400">Analyzing document structure...</p>
                </div>
            ) : (
                <>
                    <Upload className="w-8 h-8 mx-auto text-gray-500 group-hover:text-primary mb-3" />
                    <p className="text-sm text-gray-400 group-hover:text-gray-200">
                        Click to upload Resume (PDF/DOCX)
                    </p>
                </>
            )}
          <input 
            type="file" 
            ref={fileInputRef} 
            className="hidden" 
            accept=".pdf,.docx,.txt"
            onChange={handleFileChange}
            disabled={isUploading}
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
                onUploadComplete({ text: '', skills: [], fileName: '' }); // Reset context
            }} 
            className="ml-auto"
          >
            Change
          </Button>
        </div>
      )}

      {error && (
        <div className="mt-4 p-3 bg-red-500/10 border border-red-500/20 rounded-lg flex flex-col gap-2 text-xs text-red-400 animate-in slide-in-from-top-2">
          <div className="flex items-start gap-2">
            <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
            <span className="flex-1 leading-relaxed">{error}</span>
          </div>
          <button onClick={handleRetry} className="text-left text-xs underline hover:text-red-300 ml-6">
            Try again
          </button>
        </div>
      )}
    </div>
  );
};