export interface ResumeData {
  text: string;
  skills: string[];
  fileName: string;
}

export enum MessageType {
  USER = 'USER',
  AI = 'AI',
  SYSTEM = 'SYSTEM'
}

export interface ChatMessage {
  id: string;
  type: MessageType;
  content: string;
  timestamp: number;
  isPartial?: boolean;
}

export interface InterviewSettings {
  mode: 'technical' | 'behavioral' | 'general';
  targetRole: string;
  codingLanguage: 'python' | 'javascript' | 'java' | 'cpp';
}

export interface AudioStreamConfig {
  sampleRate: number;
}