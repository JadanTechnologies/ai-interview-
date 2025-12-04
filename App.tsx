import React, { useState } from 'react';
import { ResumeUploader } from './components/ResumeUploader';
import { LiveSession } from './components/LiveSession';
import { LandingPage } from './components/LandingPage';
import { AdminPortal } from './components/admin/AdminPortal';
import { ResumeData, InterviewSettings } from './types';
import { Settings, Shield, Code, User, Mic } from 'lucide-react';

type AppState = 'LANDING' | 'APP' | 'ADMIN';

const App: React.FC = () => {
  const [appState, setAppState] = useState<AppState>('LANDING');
  const [resumeData, setResumeData] = useState<ResumeData | null>(null);
  const [settings, setSettings] = useState<InterviewSettings>({
    mode: 'technical',
    targetRole: 'Software Engineer',
    codingLanguage: 'python'
  });
  
  const [showSettings, setShowSettings] = useState(false);

  // Routing Logic
  if (appState === 'ADMIN') {
    return <AdminPortal onLogout={() => setAppState('LANDING')} />;
  }

  if (appState === 'LANDING') {
    return (
      <LandingPage 
        onStart={() => setAppState('APP')} 
        onAdminLogin={() => setAppState('ADMIN')}
      />
    );
  }

  // MAIN APP
  return (
    <div className="min-h-screen bg-dark-900 text-gray-200 font-sans flex overflow-hidden">
      
      {/* Sidebar */}
      <aside className="w-80 bg-dark-800 border-r border-dark-700 flex flex-col hidden md:flex z-20 shadow-2xl">
        <div className="p-6 border-b border-dark-700">
          <h1 className="text-2xl font-bold text-white tracking-tight flex items-center gap-2">
            <span className="text-primary">Smart</span>Interview
          </h1>
          <p className="text-xs text-gray-500 mt-1 font-mono">Real-time AI Copilot v2.5</p>
        </div>

        <div className="flex-1 overflow-y-auto p-6 space-y-8">
          
          {/* Resume Section */}
          <section>
            <h2 className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-4">Context Memory</h2>
            <ResumeUploader onUploadComplete={setResumeData} />
            
            {resumeData && (
              <div className="mt-4 p-4 bg-dark-700/50 rounded-lg border border-dark-600">
                <h4 className="text-sm font-semibold text-gray-300 mb-2">Detected Skills</h4>
                <div className="flex flex-wrap gap-2">
                  {resumeData.skills.slice(0, 8).map((skill, i) => (
                    <span key={i} className="text-[10px] bg-dark-600 text-primary px-2 py-1 rounded-full border border-dark-500">
                      {skill}
                    </span>
                  ))}
                  {resumeData.skills.length > 8 && (
                    <span className="text-[10px] text-gray-500 self-center">+{resumeData.skills.length - 8} more</span>
                  )}
                </div>
              </div>
            )}
          </section>

          {/* Configuration */}
          <section>
            <h2 className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-4">Session Config</h2>
            <div className="space-y-4">
              
              <div>
                <label className="block text-xs text-gray-400 mb-1">Target Role</label>
                <input 
                  type="text" 
                  value={settings.targetRole}
                  onChange={(e) => setSettings({...settings, targetRole: e.target.value})}
                  className="w-full bg-dark-900 border border-dark-600 rounded px-3 py-2 text-sm focus:border-primary focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-xs text-gray-400 mb-1">Language</label>
                <select 
                  value={settings.codingLanguage}
                  onChange={(e) => setSettings({...settings, codingLanguage: e.target.value as any})}
                  className="w-full bg-dark-900 border border-dark-600 rounded px-3 py-2 text-sm focus:border-primary focus:outline-none"
                >
                  <option value="python">Python</option>
                  <option value="javascript">JavaScript</option>
                  <option value="java">Java</option>
                  <option value="cpp">C++</option>
                </select>
              </div>

              <div>
                <label className="block text-xs text-gray-400 mb-1">Mode</label>
                <div className="grid grid-cols-3 gap-2">
                  {(['technical', 'behavioral', 'general'] as const).map((m) => (
                    <button
                      key={m}
                      onClick={() => setSettings({...settings, mode: m})}
                      className={`text-xs py-2 rounded border transition-colors ${
                        settings.mode === m 
                        ? 'bg-primary/20 border-primary text-primary' 
                        : 'bg-dark-700 border-transparent text-gray-400 hover:bg-dark-600'
                      }`}
                    >
                      {m.charAt(0).toUpperCase() + m.slice(1)}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          </section>
        </div>

        <div className="p-4 border-t border-dark-700">
           <div className="flex items-center gap-3 text-xs text-gray-500">
              <Shield className="w-3 h-3" />
              <span>Private & Secure Session</span>
           </div>
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 flex flex-col relative">
        <div className="md:hidden p-4 bg-dark-800 border-b border-dark-700 flex justify-between items-center">
            <h1 className="font-bold text-white">SmartInterview AI</h1>
            <button onClick={() => setShowSettings(!showSettings)} className="text-gray-400">
                <Settings className="w-5 h-5" />
            </button>
        </div>

        {/* Mobile Settings Modal (simplified) */}
        {showSettings && (
            <div className="absolute inset-0 z-50 bg-dark-900 p-6 md:hidden">
                <button onClick={() => setShowSettings(false)} className="mb-4 text-primary">Done</button>
                <ResumeUploader onUploadComplete={setResumeData} />
            </div>
        )}

        <LiveSession resume={resumeData} settings={settings} />
      </main>
    </div>
  );
};

export default App;
