import React, { useState } from 'react';
import { LayoutDashboard, Users, Server, Settings, LogOut } from 'lucide-react';
import { AnalyticsDashboard } from './AnalyticsDashboard';
import { ProviderManager } from './ProviderManager';
import { configService } from '../../services/configService';

interface AdminPortalProps {
  onLogout: () => void;
}

export const AdminPortal: React.FC<AdminPortalProps> = ({ onLogout }) => {
  const [activeTab, setActiveTab] = useState<'dashboard' | 'users' | 'providers' | 'settings'>('dashboard');

  return (
    <div className="flex h-screen bg-dark-900 text-gray-200">
      {/* Sidebar */}
      <div className="w-64 bg-dark-800 border-r border-dark-700 flex flex-col">
        <div className="p-6 border-b border-dark-700">
          <h1 className="text-xl font-bold text-white tracking-tight">
            <span className="text-red-500">Super</span>Admin
          </h1>
        </div>
        
        <nav className="flex-1 p-4 space-y-2">
          <button 
            onClick={() => setActiveTab('dashboard')}
            className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg text-sm transition-colors ${activeTab === 'dashboard' ? 'bg-primary/10 text-primary' : 'hover:bg-dark-700 text-gray-400'}`}
          >
            <LayoutDashboard className="w-4 h-4" /> Dashboard
          </button>
          
          <button 
            onClick={() => setActiveTab('users')}
            className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg text-sm transition-colors ${activeTab === 'users' ? 'bg-primary/10 text-primary' : 'hover:bg-dark-700 text-gray-400'}`}
          >
            <Users className="w-4 h-4" /> User Management
          </button>
          
          <button 
            onClick={() => setActiveTab('providers')}
            className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg text-sm transition-colors ${activeTab === 'providers' ? 'bg-primary/10 text-primary' : 'hover:bg-dark-700 text-gray-400'}`}
          >
            <Server className="w-4 h-4" /> Service Providers
          </button>

          <button 
             onClick={() => setActiveTab('settings')}
             className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg text-sm transition-colors ${activeTab === 'settings' ? 'bg-primary/10 text-primary' : 'hover:bg-dark-700 text-gray-400'}`}
          >
             <Settings className="w-4 h-4" /> System Settings
          </button>
        </nav>

        <div className="p-4 border-t border-dark-700">
          <button onClick={onLogout} className="flex items-center gap-2 text-sm text-gray-400 hover:text-white transition-colors">
            <LogOut className="w-4 h-4" /> Exit Admin
          </button>
        </div>
      </div>

      {/* Main Content */}
      <div className="flex-1 overflow-auto bg-dark-900 p-8">
        <header className="mb-8">
          <h2 className="text-2xl font-bold text-white capitalize">{activeTab}</h2>
          <p className="text-gray-500 text-sm">Overview and management</p>
        </header>

        {activeTab === 'dashboard' && <AnalyticsDashboard />}
        {activeTab === 'providers' && <ProviderManager />}
        
        {activeTab === 'users' && (
           <div className="bg-dark-700 rounded-xl border border-dark-600 overflow-hidden">
             <table className="w-full text-sm text-left">
               <thead className="bg-dark-800 text-gray-400 uppercase text-xs">
                 <tr>
                    <th className="px-6 py-3">Name</th>
                    <th className="px-6 py-3">Status</th>
                    <th className="px-6 py-3">Credits</th>
                    <th className="px-6 py-3">Action</th>
                 </tr>
               </thead>
               <tbody>
                  {configService.getUsers().map(user => (
                    <tr key={user.id} className="border-b border-dark-600">
                       <td className="px-6 py-4 text-white">
                          {user.name} <br/> <span className="text-gray-500 text-xs">{user.email}</span>
                       </td>
                       <td className="px-6 py-4">
                          <span className={`px-2 py-1 rounded text-xs ${user.status === 'active' ? 'bg-green-500/10 text-green-400' : 'bg-red-500/10 text-red-400'}`}>
                             {user.status}
                          </span>
                       </td>
                       <td className="px-6 py-4 text-gray-300">{user.credits}</td>
                       <td className="px-6 py-4">
                          <button 
                             onClick={() => { configService.toggleUserStatus(user.id); }}
                             className="text-primary hover:underline"
                          >
                             Toggle Status
                          </button>
                       </td>
                    </tr>
                  ))}
               </tbody>
             </table>
           </div>
        )}

        {activeTab === 'settings' && (
            <div className="p-4 bg-yellow-500/10 border border-yellow-500/20 text-yellow-500 rounded-lg">
                Global Rate Limits and Logging configurations are managed via environment variables in production.
            </div>
        )}
      </div>
    </div>
  );
};
