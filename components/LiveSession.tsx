import React, { useEffect, useState, useRef } from 'react';
import { Mic, Square, Monitor, AlertTriangle, WifiOff, XCircle, Play, Pause, User, Bot, Clock } from 'lucide-react';
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
  const [isPaused, setIsPaused] = useState(false);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [isCriticalError, setIsCriticalError] = useState(false);
  
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
  const isPausedRef = useRef(false);

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

  const finalizeLastMessage = (type: MessageType) => {
      setMessages(prev => {
          if (prev.length > 0 && prev[prev.length - 1].type === type) {
              const newHistory = [...prev];
              newHistory[newHistory.length - 1] = {
                  ...newHistory[newHistory.length - 1],
                  isPartial: false
              };
              return newHistory;
          }
          return prev;
      });
  };

  const playAudioChunk = async (base64Data: string) => {
    try {
        if (!outputAudioCtxRef.current) {
             const AudioCtxClass = (window.AudioContext || (window as any).webkitAudioContext);
             if (!AudioCtxClass) throw new Error("AudioContext not supported");
             outputAudioCtxRef.current = new AudioCtxClass({ sampleRate: 24000 });
        }
        const ctx = outputAudioCtxRef.current;
        if (ctx.state === 'suspended') {
            await ctx.resume();
        }

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

  const togglePause = () => {
    const newState = !isPaused;
    setIsPaused(newState);
    isPausedRef.current = newState;
    addMessage(newState ? "Microphone paused." : "Microphone resumed.", MessageType.SYSTEM);
  };

  const startSession = async () => {
    try {
      setError(null);
      setIsCriticalError(false);
      setIsPaused(false);
      isPausedRef.current = false;

      if (!navigator.onLine) {
        throw new Error("NETWORK_OFFLINE");
      }
      
      const AudioCtxClass = (window.AudioContext || (window as any).webkitAudioContext);
      if (!AudioCtxClass) {
        throw new Error("BROWSER_UNSUPPORTED");
      }

      // Initialize output audio context immediately on user interaction to unlock autoplay
      const outputCtx = new AudioCtxClass({ sampleRate: 24000 });
      outputAudioCtxRef.current = outputCtx;
      
      if (outputCtx.state === 'suspended') {
        await outputCtx.resume();
      }

      if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        throw new Error("BROWSER_UNSUPPORTED");
      }

      let stream;
      try {
        stream = await navigator.mediaDevices.getUserMedia({ audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true
        }});
      } catch (e: any) {
        if (e.name === 'NotAllowedError' || e.name === 'PermissionDeniedError') {
           throw new Error("MIC_PERMISSION_DENIED");
        }
        if (e.name === 'NotFoundError') {
           throw new Error("MIC_NOT_FOUND");
        }
        throw e;
      }
      
      streamRef.current = stream;

      const audioCtx = new AudioCtxClass({ sampleRate: PCM_SAMPLE_RATE });
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
             if (text) {
                 addMessage(text, isUser ? MessageType.USER : MessageType.AI, !isComplete);
             } else if (isComplete) {
                 finalizeLastMessage(MessageType.AI);
             }
          },
          onAudioData: (base64) => {
             playAudioChunk(base64);
          },
          onError: (err) => {
            setIsCriticalError(true);
            setError(err.message); // This message comes from GeminiService formatError
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
        // Check if paused before processing
        if (isPausedRef.current) return;

        const inputData = e.inputBuffer.getChannelData(0);
        if (sendAudioRef.current) {
            sendAudioRef.current(inputData);
        }
      };

      source.connect(processor);
      processor.connect(audioCtx.destination);

    } catch (err: any) {
      console.error(err);
      
      let msg = err.message || "Failed to start session.";
      let critical = true;

      // Map internal error codes to user-friendly UI messages
      if (msg === "NETWORK_OFFLINE") {
          msg = "You are offline. Please check your internet connection.";
          critical = false;
      } else if (msg === "BROWSER_UNSUPPORTED") {
          msg = "Your browser does not support required features. Please use Chrome, Edge, or Firefox.";
      } else if (msg === "MIC_PERMISSION_DENIED") {
          msg = "Microphone access was denied. Please allow microphone access in your browser settings (look for the lock icon in the address bar).";
      } else if (msg === "MIC_NOT_FOUND") {
          msg = "No microphone detected. Please connect a microphone and try again.";
      }
      
      setIsCriticalError(critical);
      setError(msg);
      stopSession();
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
    setIsPaused(false);
    isPausedRef.current = false;
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
    setError(null);
    
    if (resume) {
        setIsGeneratingText(true);
        try {
            const ans = await geminiService.generateContextualAnswer(q, resume, settings);
            addMessage(ans, MessageType.AI);
        } catch(e: any) {
            setError(e.message);
        } finally {
            setIsGeneratingText(false);
        }
    } else {
        addMessage("Please upload a resume first for contextual answers.", MessageType.SYSTEM);
    }
  };

  return (
    <div className="flex flex-col h-full bg-dark-900 relative">
      {/* Header / HUD */}
      <div className="flex items-center justify-between p-4 border-b border-dark-700 bg-dark-800/50 backdrop-blur-sm sticky top-0 z-10">
        <div className="flex items-center gap-4">
          <div className={`w-3 h-3 rounded-full ${isActive ? (isPaused ? 'bg-yellow-500' : 'bg-red-500 animate-pulse') : 'bg-gray-600'}`} />
          <span className="font-mono text-sm text-gray-400">
            {isActive ? (isPaused ? 'SESSION PAUSED' : 'LIVE LISTENING') : 'STANDBY'}
          </span>
        </div>
        
        <div className="flex items-center gap-2">
           {!isActive ? (
             <Button onClick={startSession} className="flex gap-2">
               <Mic className="w-4 h-4" /> Start Interview Mode
             </Button>
           ) : (
             <div className="flex items-center gap-2">
                <Button 
                    onClick={togglePause} 
                    variant="secondary" 
                    className={`flex gap-2 ${isPaused ? 'text-yellow-400 border-yellow-500/30 bg-yellow-500/10' : ''}`}
                >
                    {isPaused ? <Play className="w-4 h-4" /> : <Pause className="w-4 h-4" />}
                    {isPaused ? "Resume" : "Pause"}
                </Button>
                <Button onClick={stopSession} variant="danger" className="flex gap-2">
                    <Square className="w-4 h-4" /> Stop
                </Button>
             </div>
           )}
        </div>
      </div>

      {/* Main Chat / Transcription Area */}
      <div className="flex-1 overflow-y-auto p-6 space-y-8 scroll-smooth">
        {messages.length === 0 && (
          <div className="h-full flex flex-col items-center justify-center text-gray-500 opacity-50">
            <Monitor className="w-16 h-16 mb-4" />
            <p className="text-lg">Ready to capture audio...</p>
            <p className="text-sm">Ensure your microphone can hear the interviewer (speakers).</p>
          </div>
        )}
        
        {messages.map((msg) => (
          <div key={msg.id} className={`flex flex-col ${msg.type === MessageType.USER ? 'items-end' : 'items-start'} animate-in fade-in slide-in-from-bottom-2`}>
            
            {/* Message Metadata Header */}
            {msg.type !== MessageType.SYSTEM && (
                <div className={`flex items-center gap-2 mb-2 opacity-70 ${msg.type === MessageType.USER ? 'flex-row-reverse' : 'flex-row'}`}>
                    {msg.type === MessageType.USER ? <User className="w-3 h-3 text-gray-400" /> : <Bot className="w-3 h-3 text-primary" />}
                    <span className="text-[10px] font-mono text-gray-400 uppercase tracking-wider">{msg.type === MessageType.USER ? 'Candidate' : 'SmartInterview AI'}</span>
                    <span className="text-[10px] text-dark-600">•</span>
                    <span className="flex items-center gap-1 text-[10px] text-gray-500">
                        <Clock className="w-3 h-3" />
                        {new Date(msg.timestamp).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit', second:'2-digit'})}
                    </span>
                </div>
            )}

            {/* Message Bubble */}
            <div className={`max-w-4xl w-full rounded-2xl p-5 transition-all ${
              msg.type === MessageType.USER 
                ? 'bg-dark-700 text-gray-200 rounded-tr-none border border-dark-600' 
                : msg.type === MessageType.SYSTEM 
                  ? 'bg-blue-900/10 text-blue-400 border border-blue-900/30 text-xs text-center self-center py-2 px-4 rounded-full max-w-lg'
                  : 'bg-gradient-to-br from-dark-800 to-dark-750 border border-dark-600 shadow-xl rounded-tl-none'
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
                    {msg.isPartial && <span className="inline-block w-2 h-4 bg-primary ml-1 animate-pulse align-middle" />}
                 </div>
              ) : (
                 <p className="text-sm whitespace-pre-wrap leading-relaxed">{msg.content}</p>
              )}
            </div>
          </div>
        ))}
        {isGeneratingText && (
             <div className="flex flex-col items-start gap-2">
                 <div className="flex items-center gap-2 opacity-70">
                    <Bot className="w-3 h-3 text-primary" />
                    <span className="text-[10px] font-mono text-gray-400 uppercase">AI THINKING</span>
                 </div>
                 <div className="bg-dark-800 p-4 rounded-xl border border-dark-700 animate-pulse rounded-tl-none w-64">
                     <div className="h-2 w-24 bg-dark-600 rounded mb-2"></div>
                     <div className="h-2 w-48 bg-dark-600 rounded"></div>
                 </div>
             </div>
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Robust Error Display */}
      {error && (
        <div className={`absolute bottom-20 left-4 right-4 md:left-auto md:right-6 md:w-96 p-4 flex items-start gap-3 text-sm animate-in slide-in-from-bottom-5 shadow-2xl rounded-xl border z-20 ${
            isCriticalError ? 'bg-dark-800/95 border-red-500/50 text-red-300' : 'bg-dark-800/95 border-yellow-500/50 text-yellow-300'
        }`}>
          {isCriticalError ? <XCircle className="w-5 h-5 shrink-0 mt-0.5 text-red-500" /> : <AlertTriangle className="w-5 h-5 shrink-0 mt-0.5 text-yellow-500" />}
          <div className="flex-1">
            <span className="font-bold block mb-1 text-white">{isCriticalError ? 'Error' : 'Warning'}</span>
            <span className="leading-relaxed">{error}</span>
          </div>
          <button onClick={() => setError(null)} className="ml-auto text-xs bg-white/5 px-2 py-1 rounded hover:bg-white/10 transition-colors">
            Dismiss
          </button>
        </div>
      )}

      {/* Manual Input */}
      <div className="p-4 bg-dark-800 border-t border-dark-700 shadow-[0_-5px_20px_rgba(0,0,0,0.2)]">
        <div className="flex gap-2 max-w-4xl mx-auto">
            <input 
              type="text"
              value={manualInput}
              onChange={(e) => setManualInput(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleManualAsk()}
              placeholder="Type a technical question manually if audio misses..."
              className="flex-1 bg-dark-900 border border-dark-600 rounded-lg px-4 py-3 text-sm text-gray-200 focus:outline-none focus:border-primary transition-colors placeholder:text-gray-600"
            />
            <Button onClick={handleManualAsk} disabled={!manualInput.trim() || isGeneratingText} variant="secondary">
                Ask AI
            </Button>
        </div>
      </div>
    </div>
  );
};