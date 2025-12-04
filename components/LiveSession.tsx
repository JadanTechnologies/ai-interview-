import React, { useEffect, useState, useRef } from 'react';
import { Mic, Square, Monitor, AlertTriangle } from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import { geminiService } from '../services/geminiService';
import { ResumeData, InterviewSettings, MessageType, ChatMessage } from '../types';
import { Button } from './Button';
import { PCM_SAMPLE_RATE } from '../services/audioUtils';
import { CodeSolution } from './CodeSolution';

interface LiveSessionProps {
  resume: ResumeData | null;
  settings: InterviewSettings;
}

export const LiveSession: React.FC<LiveSessionProps> = ({ resume, settings }) => {
  const [isActive, setIsActive] = useState(false);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [error, setError] = useState<string | null>(null);
  
  // Audio Refs
  const audioContextRef = useRef<AudioContext | null>(null);
  const inputSourceRef = useRef<MediaStreamAudioSourceNode | null>(null);
  const processorRef = useRef<ScriptProcessorNode | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const outputAudioCtxRef = useRef<AudioContext | null>(null);
  const nextStartTimeRef = useRef<number>(0);
  
  // Service Refs
  const sendAudioRef = useRef<((data: Float32Array) => void) | null>(null);
  const disconnectRef = useRef<(() => void) | null>(null);

  // Auto-scroll
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const addMessage = (content: string, type: MessageType, isPartial = false) => {
    setMessages(prev => {
        // If the last message is partial and from the same type, update it
        if (prev.length > 0 && prev[prev.length - 1].isPartial && prev[prev.length - 1].type === type) {
            const newHistory = [...prev];
            newHistory[newHistory.length - 1] = {
                ...newHistory[newHistory.length - 1],
                content: prev[prev.length - 1].content + content,
                isPartial: isPartial
            };
            return newHistory;
        }
        
        return [...prev, {
            id: Date.now().toString() + Math.random(),
            type,
            content,
            timestamp: Date.now(),
            isPartial
        }];
    });
  };

  const playAudioChunk = async (base64Data: string) => {
    if (!outputAudioCtxRef.current) {
         // Fallback if not initialized in startSession (e.g. if message arrives late)
        outputAudioCtxRef.current = new (window.AudioContext || (window as any).webkitAudioContext)({ sampleRate: 24000 });
    }
    const ctx = outputAudioCtxRef.current;

    try {
        const binaryString = atob(base64Data);
        const len = binaryString.length;
        const bytes = new Uint8Array(len);
        for (let i = 0; i < len; i++) {
            bytes[i] = binaryString.charCodeAt(i);
        }
        
        const int16 = new Int16Array(bytes.buffer);
        const float32 = new Float32Array(int16.length);
        for (let i = 0; i < int16.length; i++) {
             float32[i] = int16[i] / 32768.0;
        }

        const buffer = ctx.createBuffer(1, float32.length, 24000);
        buffer.getChannelData(0).set(float32);

        const source = ctx.createBufferSource();
        source.buffer = buffer;
        source.connect(ctx.destination);
        
        const startTime = Math.max(ctx.currentTime, nextStartTimeRef.current);
        source.start(startTime);
        nextStartTimeRef.current = startTime + buffer.duration;

    } catch (e) {
        console.error("Audio playback error", e);
    }
  };

  const startSession = async () => {
    try {
      setError(null);

      if (!navigator.onLine) {
        throw new Error("You appear to be offline. Please check your internet connection.");
      }
      
      // Initialize output audio context immediately on user interaction to unlock autoplay
      const outputCtx = new (window.AudioContext || (window as any).webkitAudioContext)({ sampleRate: 24000 });
      outputAudioCtxRef.current = outputCtx;
      // Resume immediately in case it was suspended (Chrome policy)
      if (outputCtx.state === 'suspended') {
        await outputCtx.resume();
      }

      const stream = await navigator.mediaDevices.getUserMedia({ audio: {
        echoCancellation: true,
        noiseSuppression: true,
        autoGainControl: true
      }});
      streamRef.current = stream;

      const audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)({ sampleRate: PCM_SAMPLE_RATE });
      audioContextRef.current = audioCtx;
      
      const source = audioCtx.createMediaStreamSource(stream);
      inputSourceRef.current = source;
      
      const processor = audioCtx.createScriptProcessor(4096, 1, 1);
      processorRef.current = processor;

      const connection = await geminiService.connectLive(
        {
          onOpen: () => {
            setIsActive(true);
            addMessage("Session connected. Listening...", MessageType.SYSTEM);
          },
          onMessage: (text, isUser, isComplete) => {
             if(text) addMessage(text, isUser ? MessageType.USER : MessageType.AI, !isComplete);
          },
          onAudioData: (base64) => {
             playAudioChunk(base64);
          },
          onError: (err) => {
            setError(err.message);
            stopSession();
          },
          onClose: () => {
            setIsActive(false);
            addMessage("Session ended.", MessageType.SYSTEM);
          }
        },
        resume,
        settings
      );
      
      sendAudioRef.current = connection.sendAudio;
      disconnectRef.current = connection.disconnect;

      processor.onaudioprocess = (e) => {
        const inputData = e.inputBuffer.getChannelData(0);
        if (sendAudioRef.current) {
            sendAudioRef.current(inputData);
        }
      };

      source.connect(processor);
      processor.connect(audioCtx.destination);

    } catch (err: any) {
      console.error(err);
      
      let msg = err.message;
      // Handle microphone permission errors specifically
      if (err.name === 'NotAllowedError' || err.name === 'PermissionDeniedError') {
          msg = "Microphone access denied. Please allow microphone access in your browser settings.";
      } else if (err.name === 'NotFoundError') {
          msg = "No microphone found on this device.";
      } else if (err.name === 'NotReadableError') {
          msg = "Microphone is busy or not readable. Close other apps using it.";
      }
      
      setError(msg);
      stopSession(); // Ensure cleanup happens
    }
  };

  const stopSession = () => {
    if (disconnectRef.current) disconnectRef.current();
    
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => track.stop());
    }
    if (audioContextRef.current) {
      audioContextRef.current.close();
    }
    if (outputAudioCtxRef.current) {
      outputAudioCtxRef.current.close();
      outputAudioCtxRef.current = null;
    }
    
    setIsActive(false);
    sendAudioRef.current = null;
    processorRef.current = null;
  };

  const [manualInput, setManualInput] = useState('');
  const [isGeneratingText, setIsGeneratingText] = useState(false);

  const handleManualAsk = async () => {
    if (!manualInput.trim()) return;
    const q = manualInput;
    setManualInput('');
    addMessage(q, MessageType.USER);
    
    if (resume) {
        setIsGeneratingText(true);
        try {
            const ans = await geminiService.generateContextualAnswer(q, resume, settings);
            addMessage(ans, MessageType.AI);
        } catch(e: any) {
            addMessage(`System: ${e.message}`, MessageType.SYSTEM);
            setError(e.message);
        } finally {
            setIsGeneratingText(false);
        }
    } else {
        addMessage("Please upload a resume first for contextual answers.", MessageType.SYSTEM);
    }
  };

  return (
    <div className="flex flex-col h-full bg-dark-900">
      {/* Header / HUD */}
      <div className="flex items-center justify-between p-4 border-b border-dark-700 bg-dark-800/50 backdrop-blur-sm sticky top-0 z-10">
        <div className="flex items-center gap-4">
          <div className={`w-3 h-3 rounded-full ${isActive ? 'bg-red-500 animate-pulse' : 'bg-gray-600'}`} />
          <span className="font-mono text-sm text-gray-400">
            {isActive ? 'LIVE LISTENING' : 'STANDBY'}
          </span>
        </div>
        
        <div className="flex items-center gap-2">
           {!isActive ? (
             <Button onClick={startSession} className="flex gap-2">
               <Mic className="w-4 h-4" /> Start Interview Mode
             </Button>
           ) : (
             <Button onClick={stopSession} variant="danger" className="flex gap-2">
               <Square className="w-4 h-4" /> Stop Session
             </Button>
           )}
        </div>
      </div>

      {/* Main Chat / Transcription Area */}
      <div className="flex-1 overflow-y-auto p-6 space-y-6">
        {messages.length === 0 && (
          <div className="h-full flex flex-col items-center justify-center text-gray-500 opacity-50">
            <Monitor className="w-16 h-16 mb-4" />
            <p className="text-lg">Ready to capture audio...</p>
            <p className="text-sm">Ensure your microphone can hear the interviewer (speakers).</p>
          </div>
        )}
        
        {messages.map((msg) => (
          <div key={msg.id} className={`flex flex-col ${msg.type === MessageType.USER ? 'items-end' : 'items-start'}`}>
            <div className={`max-w-4xl w-full rounded-2xl p-5 ${
              msg.type === MessageType.USER 
                ? 'bg-dark-700 text-gray-200 rounded-tr-none' 
                : msg.type === MessageType.SYSTEM 
                  ? 'bg-blue-900/20 text-blue-400 border border-blue-900/50 text-xs text-center'
                  : 'bg-gradient-to-br from-dark-800 to-dark-700 border border-dark-600 shadow-xl rounded-tl-none'
            }`}>
              {msg.type === MessageType.AI ? (
                 <div className="prose prose-invert prose-p:text-sm prose-pre:bg-transparent prose-pre:p-0 prose-pre:m-0 max-w-none">
                    <ReactMarkdown
                      components={{
                        code({node, inline, className, children, ...props}: any) {
                          const match = /language-(\w+)/.exec(className || '')
                          return !inline && match ? (
                            <CodeSolution
                              language={match[1]}
                              code={String(children).replace(/\n$/, '')}
                            />
                          ) : (
                            <code className={`${className} bg-dark-900/50 px-1 py-0.5 rounded text-primary font-mono text-xs`} {...props}>
                              {children}
                            </code>
                          )
                        }
                      }}
                    >
                      {msg.content}
                    </ReactMarkdown>
                 </div>
              ) : (
                 <p className="text-sm whitespace-pre-wrap">{msg.content}</p>
              )}
            </div>
            <span className="text-[10px] text-gray-600 mt-2 font-mono px-1">
                {msg.type} • {new Date(msg.timestamp).toLocaleTimeString()}
            </span>
          </div>
        ))}
        {isGeneratingText && (
             <div className="flex items-start">
                 <div className="bg-dark-800 p-4 rounded-xl border border-dark-700 animate-pulse">
                     <div className="h-2 w-24 bg-dark-600 rounded mb-2"></div>
                     <div className="h-2 w-48 bg-dark-600 rounded"></div>
                 </div>
             </div>
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Error Display */}
      {error && (
        <div className="bg-red-500/10 border-t border-red-500/20 p-3 flex items-center justify-center gap-2 text-red-400 text-sm animate-in slide-in-from-bottom-2">
          <AlertTriangle className="w-4 h-4" />
          {error}
        </div>
      )}

      {/* Manual Input */}
      <div className="p-4 bg-dark-800 border-t border-dark-700">
        <div className="flex gap-2 max-w-4xl mx-auto">
            <input 
              type="text"
              value={manualInput}
              onChange={(e) => setManualInput(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleManualAsk()}
              placeholder="Type a technical question manually if audio misses..."
              className="flex-1 bg-dark-900 border border-dark-600 rounded-lg px-4 py-2 text-sm text-gray-200 focus:outline-none focus:border-primary"
            />
            <Button onClick={handleManualAsk} disabled={!manualInput.trim() || isGeneratingText} variant="secondary">
                Ask AI
            </Button>
        </div>
      </div>
    </div>
  );
};