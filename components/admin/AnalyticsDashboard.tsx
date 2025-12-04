import React from 'react';
import { BarChart, Activity, Users, AlertTriangle } from 'lucide-react';
import { configService } from '../../services/configService';

export const AnalyticsDashboard: React.FC = () => {
  const stats = configService.getAnalytics();
  const logs = configService.getLogs();

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="bg-dark-700 p-4 rounded-xl border border-dark-600">
          <div className="flex items-center gap-3 mb-2">
            <Users className="w-5 h-5 text-blue-400" />
            <span className="text-gray-400 text-sm">Total Users</span>
          </div>
          <div className="text-2xl font-bold text-white">{stats.totalUsers}</div>
        </div>
        
        <div className="bg-dark-700 p-4 rounded-xl border border-dark-600">
          <div className="flex items-center gap-3 mb-2">
            <Activity className="w-5 h-5 text-primary" />
            <span className="text-gray-400 text-sm">Active Sessions</span>
          </div>
          <div className="text-2xl font-bold text-white">{stats.activeSessions}</div>
        </div>

        <div className="bg-dark-700 p-4 rounded-xl border border-dark-600">
          <div className="flex items-center gap-3 mb-2">
            <BarChart className="w-5 h-5 text-purple-400" />
            <span className="text-gray-400 text-sm">API Calls Today</span>
          </div>
          <div className="text-2xl font-bold text-white">{stats.apiCallsToday}</div>
        </div>

        <div className="bg-dark-700 p-4 rounded-xl border border-dark-600">
          <div className="flex items-center gap-3 mb-2">
            <AlertTriangle className="w-5 h-5 text-yellow-400" />
            <span className="text-gray-400 text-sm">Error Rate</span>
          </div>
          <div className="text-2xl font-bold text-white">{stats.errorRate}</div>
        </div>
      </div>

      <div className="bg-dark-700 rounded-xl border border-dark-600 overflow-hidden">
        <div className="px-6 py-4 border-b border-dark-600">
          <h3 className="text-white font-medium">System Logs</h3>
        </div>
        <div className="max-h-[300px] overflow-y-auto">
          <table className="w-full text-sm text-left">
            <thead className="text-xs text-gray-400 uppercase bg-dark-800">
              <tr>
                <th className="px-6 py-3">Timestamp</th>
                <th className="px-6 py-3">Actor</th>
                <th className="px-6 py-3">Action</th>
                <th className="px-6 py-3">Status</th>
              </tr>
            </thead>
            <tbody>
              {logs.map(log => (
                <tr key={log.id} className="border-b border-dark-600 hover:bg-dark-600/50">
                  <td className="px-6 py-4 text-gray-400">{new Date(log.timestamp).toLocaleTimeString()}</td>
                  <td className="px-6 py-4 text-white">{log.action}</td>
                  <td className="px-6 py-4 text-gray-300">{log.details}</td>
                  <td className="px-6 py-4">
                    <span className={`px-2 py-1 rounded-full text-[10px] ${
                      log.status === 'success' ? 'bg-green-500/10 text-green-400' : 'bg-red-500/10 text-red-400'
                    }`}>
                      {log.status.toUpperCase()}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
