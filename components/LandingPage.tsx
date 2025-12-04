import React, { useState } from 'react';
import { Hologram } from './Hologram';
import { ArrowRight, Cpu, ShieldCheck, Zap, Lock } from 'lucide-react';

interface LandingPageProps {
  onStart: () => void;
  onAdminLogin: () => void;
}

export const LandingPage: React.FC<LandingPageProps> = ({ onStart, onAdminLogin }) => {
  const [isHovering, setIsHovering] = useState(false);

  return (
    <div className="relative w-full h-screen overflow-hidden bg-dark-900 flex flex-col items-center justify-center text-white">
      {/* 3D Background */}
      <Hologram />
      
      {/* Overlay Content */}
      <div className="relative z-10 flex flex-col items-center text-center px-4 max-w-4xl mx-auto backdrop-blur-sm bg-dark-900/30 p-12 rounded-3xl border border-white/5 shadow-2xl">
        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-primary/10 border border-primary/20 text-primary text-xs font-mono mb-8 animate-pulse">
          <div className="w-2 h-2 rounded-full bg-primary"></div>
          SYSTEM ONLINE // V2.5
        </div>

        <h1 className="text-6xl md:text-8xl font-bold tracking-tighter mb-6 bg-clip-text text-transparent bg-gradient-to-b from-white to-white/50">
          SmartInterview
        </h1>
        
        <p className="text-lg md:text-xl text-gray-400 mb-10 max-w-2xl leading-relaxed">
          The world's most advanced <span className="text-primary font-semibold">Real-time Interview Copilot</span>.
          Powered by Gemini 2.5 Flash. Detects speech, analyzes resume context, and solves coding challenges instantly.
        </p>

        <button
          onClick={onStart}
          onMouseEnter={() => setIsHovering(true)}
          onMouseLeave={() => setIsHovering(false)}
          className="group relative px-8 py-4 bg-white text-dark-900 rounded-full font-bold text-lg overflow-hidden transition-all hover:scale-105 hover:shadow-[0_0_40px_rgba(255,255,255,0.3)]"
        >
          <span className="relative z-10 flex items-center gap-2">
            INITIALIZE SESSION
            <ArrowRight className={`w-5 h-5 transition-transform duration-300 ${isHovering ? 'translate-x-1' : ''}`} />
          </span>
          <div className="absolute inset-0 bg-primary opacity-0 group-hover:opacity-10 transition-opacity duration-300"></div>
        </button>

        {/* Feature Grid */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8 mt-16 w-full">
          <div className="flex flex-col items-center gap-3 p-4 rounded-xl bg-white/5 border border-white/5 hover:bg-white/10 transition-colors">
            <Zap className="w-8 h-8 text-primary" />
            <h3 className="font-semibold">Zero Latency</h3>
            <p className="text-xs text-gray-400">Real-time voice processing via WebSockets.</p>
          </div>
          <div className="flex flex-col items-center gap-3 p-4 rounded-xl bg-white/5 border border-white/5 hover:bg-white/10 transition-colors">
            <Cpu className="w-8 h-8 text-secondary" />
            <h3 className="font-semibold">Context Aware</h3>
            <p className="text-xs text-gray-400">Reads resumes & adapts answers instantly.</p>
          </div>
          <div className="flex flex-col items-center gap-3 p-4 rounded-xl bg-white/5 border border-white/5 hover:bg-white/10 transition-colors">
            <ShieldCheck className="w-8 h-8 text-purple-400" />
            <h3 className="font-semibold">Undetectable</h3>
            <p className="text-xs text-gray-400">Runs as a silent side-panel assistant.</p>
          </div>
        </div>
      </div>

      <div className="absolute bottom-8 w-full px-8 flex justify-between items-center text-xs text-gray-600 font-mono">
        <span>SECURE CONNECTION • ENCRYPTED • GOOGLE GEMINI POWERED</span>
        <button onClick={onAdminLogin} className="flex items-center gap-1 hover:text-gray-400 transition-colors">
            <Lock className="w-3 h-3" /> Admin
        </button>
      </div>
    </div>
  );
};
