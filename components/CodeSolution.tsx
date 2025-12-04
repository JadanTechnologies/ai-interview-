import React, { useState } from 'react';
import Editor from '@monaco-editor/react';
import { Copy, Check } from 'lucide-react';

interface CodeSolutionProps {
  code: string;
  language: string;
}

export const CodeSolution: React.FC<CodeSolutionProps> = ({ code, language }) => {
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(code);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.error("Failed to copy code to clipboard", err);
    }
  };

  return (
    <div className="my-4 rounded-lg overflow-hidden border border-dark-600 shadow-2xl bg-[#1e1e1e]">
      <div className="flex items-center justify-between px-4 py-2 bg-[#252526] border-b border-dark-700">
        <span className="text-xs text-gray-400 font-mono uppercase">{language} Solution</span>
        <button 
          onClick={handleCopy}
          className={`flex items-center gap-1.5 text-xs transition-colors px-2 py-1 rounded ${
            copied 
              ? 'text-green-400 bg-green-500/10' 
              : 'text-gray-400 hover:text-white hover:bg-white/5'
          }`}
          title="Copy to clipboard"
        >
          {copied ? <Check className="w-3 h-3" /> : <Copy className="w-3 h-3" />}
          {copied ? 'Copied' : 'Copy Code'}
        </button>
      </div>
      <div className="h-[300px]">
        <Editor
          height="100%"
          defaultLanguage={language}
          value={code}
          theme="vs-dark"
          options={{
            readOnly: true,
            minimap: { enabled: false },
            fontSize: 14,
            scrollBeyondLastLine: false,
            padding: { top: 16, bottom: 16 },
            fontFamily: "'JetBrains Mono', monospace",
            lineNumbers: 'on',
            renderLineHighlight: 'none',
          }}
        />
      </div>
    </div>
  );
};