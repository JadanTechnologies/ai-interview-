import React, { useState } from 'react';
import { Plus, Trash2, Edit2, Save, X, Server } from 'lucide-react';
import { configService, AIProvider } from '../../services/configService';
import { Button } from '../Button';

export const ProviderManager: React.FC = () => {
  const [providers, setProviders] = useState(configService.getProviders());
  const [editingId, setEditingId] = useState<string | null>(null);
  const [formData, setFormData] = useState<Partial<AIProvider>>({});

  const refresh = () => setProviders([...configService.getProviders()]);

  const handleEdit = (p: AIProvider) => {
    setEditingId(p.id);
    setFormData(p);
  };

  const handleAddNew = () => {
    const newId = 'prov_' + Date.now();
    setFormData({
      id: newId,
      name: 'New Provider',
      provider: 'google',
      apiKey: '',
      modelId: 'gemini-2.5-flash',
      isActive: true,
      priority: providers.length + 1,
      dailyLimit: 1000,
      usageCount: 0
    });
    setEditingId(newId);
  };

  const handleSave = () => {
    if (editingId && formData.name && formData.apiKey) {
      configService.saveProvider(formData as AIProvider);
      setEditingId(null);
      setFormData({});
      refresh();
    }
  };

  const handleDelete = (id: string) => {
    if (confirm('Are you sure you want to delete this provider?')) {
      configService.deleteProvider(id);
      refresh();
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h2 className="text-xl font-bold text-white flex items-center gap-2">
          <Server className="text-primary" /> Service Providers
        </h2>
        <Button onClick={handleAddNew} size="sm">
          <Plus className="w-4 h-4 mr-2" /> Add Provider
        </Button>
      </div>

      <div className="grid gap-4">
        {editingId && (
           <div className="bg-dark-700 p-4 rounded-xl border border-primary/50 animate-in fade-in slide-in-from-top-2">
             <h3 className="text-white font-bold mb-4">
               {providers.some(p => p.id === editingId) ? 'Edit Provider' : 'New Provider'}
             </h3>
             <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                   <label className="text-xs text-gray-400">Provider Name</label>
                   <input 
                      className="w-full bg-dark-800 border border-dark-600 rounded p-2 text-white" 
                      value={formData.name}
                      onChange={e => setFormData({...formData, name: e.target.value})}
                   />
                </div>
                <div>
                   <label className="text-xs text-gray-400">Model ID</label>
                   <input 
                      className="w-full bg-dark-800 border border-dark-600 rounded p-2 text-white" 
                      value={formData.modelId}
                      onChange={e => setFormData({...formData, modelId: e.target.value})}
                   />
                </div>
                <div className="md:col-span-2">
                   <label className="text-xs text-gray-400">API Key</label>
                   <input 
                      className="w-full bg-dark-800 border border-dark-600 rounded p-2 text-white font-mono" 
                      value={formData.apiKey}
                      type="password"
                      placeholder="sk-..."
                      onChange={e => setFormData({...formData, apiKey: e.target.value})}
                   />
                </div>
                <div>
                   <label className="text-xs text-gray-400">Priority (1 = Highest)</label>
                   <input 
                      className="w-full bg-dark-800 border border-dark-600 rounded p-2 text-white" 
                      type="number"
                      value={formData.priority}
                      onChange={e => setFormData({...formData, priority: parseInt(e.target.value)})}
                   />
                </div>
                <div className="flex items-center gap-2 pt-6">
                    <input 
                      type="checkbox"
                      checked={formData.isActive}
                      onChange={e => setFormData({...formData, isActive: e.target.checked})}
                    />
                    <span className="text-white text-sm">Active</span>
                </div>
             </div>
             <div className="flex gap-2 mt-4 justify-end">
                <Button variant="ghost" onClick={() => setEditingId(null)}>Cancel</Button>
                <Button onClick={handleSave}><Save className="w-4 h-4 mr-2" /> Save Config</Button>
             </div>
           </div>
        )}

        {providers.map(p => (
          <div key={p.id} className={`bg-dark-700 p-4 rounded-xl border transition-all ${p.isActive ? 'border-dark-600 hover:border-dark-500' : 'border-red-900/30 opacity-75'}`}>
            <div className="flex justify-between items-start">
               <div>
                  <div className="flex items-center gap-2">
                     <h3 className="font-bold text-white">{p.name}</h3>
                     <span className={`text-[10px] px-2 py-0.5 rounded-full ${p.isActive ? 'bg-green-500/20 text-green-400' : 'bg-red-500/20 text-red-400'}`}>
                        {p.isActive ? 'ACTIVE' : 'INACTIVE'}
                     </span>
                     <span className="text-[10px] bg-blue-500/20 text-blue-400 px-2 py-0.5 rounded-full">
                        Priority: {p.priority}
                     </span>
                  </div>
                  <div className="text-xs text-gray-400 mt-1 font-mono">
                     {p.modelId} • {p.provider.toUpperCase()}
                  </div>
                  <div className="text-xs text-gray-500 mt-1">
                     Usage: {p.usageCount} calls
                  </div>
               </div>
               <div className="flex gap-2">
                  <button onClick={() => handleEdit(p)} className="p-2 hover:bg-dark-600 rounded text-blue-400">
                     <Edit2 className="w-4 h-4" />
                  </button>
                  <button onClick={() => handleDelete(p.id)} className="p-2 hover:bg-dark-600 rounded text-red-400">
                     <Trash2 className="w-4 h-4" />
                  </button>
               </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};
