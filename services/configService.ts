import { InterviewSettings } from "../types";

export interface AIProvider {
  id: string;
  name: string;
  provider: 'google' | 'openai' | 'anthropic'; // focusing on google for now
  apiKey: string;
  modelId: string;
  isActive: boolean;
  priority: number; // Lower is higher priority
  dailyLimit: number;
  usageCount: number;
}

export interface User {
  id: string;
  name: string;
  email: string;
  status: 'active' | 'suspended';
  lastActive: number;
  credits: number;
}

export interface SystemLog {
  id: string;
  timestamp: number;
  action: string;
  details: string;
  status: 'success' | 'error';
}

// Safely retrieve API key or default to empty string
const getEnvApiKey = () => {
  try {
    // Check if process is defined (Node.js/simulated env) before accessing env
    if (typeof process !== 'undefined' && process.env && process.env.API_KEY) {
      return process.env.API_KEY;
    }
    return '';
  } catch (e) {
    return '';
  }
};

// Default provider configuration
const DEFAULT_PROVIDERS: AIProvider[] = [
  {
    id: 'default-gemini',
    name: 'Gemini 2.5 Flash (Primary)',
    provider: 'google',
    apiKey: getEnvApiKey(),
    modelId: 'gemini-2.5-flash-native-audio-preview-09-2025',
    isActive: true,
    priority: 1,
    dailyLimit: 1000,
    usageCount: 0
  }
];

const MOCK_USERS: User[] = [
  { id: 'u1', name: 'Alice Dev', email: 'alice@tech.com', status: 'active', lastActive: Date.now() - 3600000, credits: 150 },
  { id: 'u2', name: 'Bob Coder', email: 'bob@code.com', status: 'suspended', lastActive: Date.now() - 86400000, credits: 0 },
  { id: 'u3', name: 'Charlie', email: 'charlie@web.com', status: 'active', lastActive: Date.now() - 120000, credits: 500 },
];

class ConfigService {
  private providers: AIProvider[];
  private users: User[];
  private logs: SystemLog[];

  constructor() {
    let storedProviders = null;
    try {
        storedProviders = localStorage.getItem('si_providers');
    } catch(e) {
        console.warn("LocalStorage access failed");
    }

    this.providers = storedProviders ? JSON.parse(storedProviders) : DEFAULT_PROVIDERS;
    this.users = MOCK_USERS; // Mock for demo
    this.logs = [];
    this.logAction('System', 'ConfigService initialized');
  }

  // --- Provider Management ---
  getProviders() {
    return this.providers.sort((a, b) => a.priority - b.priority);
  }

  getActiveProviders() {
    return this.getProviders().filter(p => p.isActive);
  }

  saveProvider(provider: AIProvider) {
    const index = this.providers.findIndex(p => p.id === provider.id);
    if (index >= 0) {
      this.providers[index] = provider;
    } else {
      this.providers.push(provider);
    }
    this.persist();
    this.logAction('Admin', `Saved provider ${provider.name}`);
  }

  deleteProvider(id: string) {
    this.providers = this.providers.filter(p => p.id !== id);
    this.persist();
    this.logAction('Admin', `Deleted provider ${id}`);
  }

  // --- User Management ---
  getUsers() {
    return this.users;
  }

  toggleUserStatus(id: string) {
    const user = this.users.find(u => u.id === id);
    if (user) {
      user.status = user.status === 'active' ? 'suspended' : 'active';
      this.logAction('Admin', `Changed user status for ${user.email} to ${user.status}`);
      // In real app, persist users
    }
  }

  // --- Analytics & Logs ---
  getLogs() {
    return this.logs;
  }

  logAction(actor: string, details: string, status: 'success' | 'error' = 'success') {
    const log: SystemLog = {
      id: Date.now().toString() + Math.random(),
      timestamp: Date.now(),
      action: actor,
      details,
      status
    };
    this.logs.unshift(log);
    if (this.logs.length > 100) this.logs.pop(); // Keep last 100
  }

  getAnalytics() {
    return {
      totalUsers: this.users.length,
      activeSessions: Math.floor(Math.random() * 50) + 10, // Mock
      apiCallsToday: this.providers.reduce((acc, p) => acc + p.usageCount, 0),
      errorRate: '0.4%'
    };
  }

  private persist() {
    try {
        localStorage.setItem('si_providers', JSON.stringify(this.providers));
    } catch (e) {
        console.warn("Failed to save to localStorage");
    }
  }
}

export const configService = new ConfigService();