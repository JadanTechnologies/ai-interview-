import { GoogleGenAI, LiveServerMessage, Modality, GenerateContentResponse } from "@google/genai";
import { ResumeData, InterviewSettings } from "../types";
import { createPcmBlob, fileToBase64 } from "./audioUtils";
import { configService } from "./configService";

export class GeminiService {
  private textModelId = 'gemini-2.5-flash';

  // Robust error formatting for UI
  private formatError(error: any): string {
    let msg = "An unexpected error occurred.";
    let status = error.status || error.response?.status;

    if (typeof error === 'string') {
        msg = error;
    } else if (error instanceof Error) {
        msg = error.message;
    } else if (error && typeof error === 'object') {
        msg = error.message || error.statusText || JSON.stringify(error);
    }

    const lowerMsg = msg.toLowerCase();

    // 1. Rate Limiting (429)
    if (status === 429 || lowerMsg.includes('429') || lowerMsg.includes('quota') || lowerMsg.includes('resource exhausted')) {
      return "⚠️ API Rate Limit Exceeded. The system is busy. Please wait a moment before trying again.";
    }
    
    // 2. Authentication (401/403)
    if (status === 401 || status === 403 || lowerMsg.includes('401') || lowerMsg.includes('403') || lowerMsg.includes('api key') || lowerMsg.includes('permission denied')) {
      return "⚠️ Authentication Failed. Please check that your API Key is valid and has access to the Gemini API.";
    }
    
    // 3. Server Errors (5xx)
    if (status >= 500 || lowerMsg.includes('500') || lowerMsg.includes('503') || lowerMsg.includes('internal error') || lowerMsg.includes('overloaded')) {
      return "⚠️ AI Service Unavailable. Google's servers are temporarily overloaded. Retrying might work.";
    }
    
    // 4. Network / Offline
    if (lowerMsg.includes('fetch failed') || lowerMsg.includes('network') || lowerMsg.includes('failed to fetch') || lowerMsg.includes('offline') || lowerMsg.includes('load failed')) {
      return "⚠️ Network Connection Error. Please check your internet connection and try again.";
    }

    // 5. Safety / Blocked Content
    if (lowerMsg.includes('safety') || lowerMsg.includes('blocked') || lowerMsg.includes('finishreason')) {
      return "⚠️ Content Blocked. The AI refused to answer due to safety settings. Please rephrase your request.";
    }

    // 6. Browser Compatibility
    if (lowerMsg.includes('audiocontext') || lowerMsg.includes('mediadevices') || lowerMsg.includes('notallowederror')) {
        return "⚠️ Hardware Access Error. Please ensure microphone permissions are granted and you are using a modern browser.";
    }

    // 7. Generic Cleanup
    return `⚠️ ${msg.replace(/\[.*?\]/g, '').trim().slice(0, 150)}`;
  }

  // Retry wrapper for robust API calls (Exponential Backoff)
  private async withRetry<T>(operation: () => Promise<T>, retries = 3): Promise<T> {
    let lastError: any;
    for (let i = 0; i < retries; i++) {
      try {
        return await operation();
      } catch (error: any) {
        lastError = error;
        const status = error.status || error.response?.status;
        const msg = error.message?.toLowerCase() || '';
        
        // Retry only on transient errors (Network, 503, 429)
        const isTransient = 
            status === 503 || 
            status === 429 || 
            msg.includes('network') || 
            msg.includes('fetch failed') || 
            msg.includes('overloaded');

        if (!isTransient || i === retries - 1) {
            throw error;
        }

        // Backoff: 1s, 2s, 4s...
        const delay = 1000 * Math.pow(2, i);
        console.warn(`Attempt ${i + 1} failed. Retrying in ${delay}ms...`);
        await new Promise(resolve => setTimeout(resolve, delay));
      }
    }
    throw lastError;
  }

  // Helper to get a working client with failover
  private async getClient(): Promise<{ client: GoogleGenAI, modelId: string }> {
    const providers = configService.getActiveProviders();
    
    if (!providers || providers.length === 0) {
      throw new Error("No active AI providers configured. Please go to Admin > Providers and add a valid API Key.");
    }

    const primary = providers[0];
    
    if (!primary.apiKey || primary.apiKey.trim() === '') {
        throw new Error("The active provider has no API Key. Please check your configuration.");
    }
    
    // Log usage
    primary.usageCount++;
    configService.saveProvider(primary);

    return {
      client: new GoogleGenAI({ apiKey: primary.apiKey }),
      modelId: primary.modelId
    };
  }

  async parseResume(file: File): Promise<ResumeData> {
    try {
        const { client } = await this.getClient();
        const base64Data = await fileToBase64(file);
        const mimeType = file.type;

        const prompt = `
          Analyze the provided resume document.
          Extract the following information in strict JSON format:
          1. Full text summary of the resume.
          2. A list of key technical skills.
          
          Output format:
          {
            "text": "Full summary text...",
            "skills": ["Skill 1", "Skill 2"]
          }
        `;

        // Wrapped in retry logic
        const response = await this.withRetry<GenerateContentResponse>(() => client.models.generateContent({
            model: this.textModelId,
            contents: {
            parts: [
                { inlineData: { mimeType, data: base64Data } },
                { text: prompt }
            ]
            },
            config: {
            responseMimeType: 'application/json'
            }
        }));

        let text = response.text;
        if (!text) throw new Error("Received empty response from Gemini");
        
        // Sanitize markdown code blocks if present
        text = text.replace(/```json/g, '').replace(/```/g, '');

        let parsed;
        try {
            parsed = JSON.parse(text);
        } catch (e) {
            console.error("Failed to parse JSON", text);
            throw new Error("Failed to parse AI response. Please ensure the document is clear.");
        }

        configService.logAction('AI', 'Resume parsed successfully');

        return {
            text: parsed.text || "No summary available.",
            skills: Array.isArray(parsed.skills) ? parsed.skills : [],
            fileName: file.name
        };
    } catch (error: any) {
      const userMsg = this.formatError(error);
      configService.logAction('AI', `Resume parsing failed: ${userMsg}`, 'error');
      console.error("Resume parsing failed:", error);
      throw new Error(userMsg);
    }
  }

  async generateContextualAnswer(question: string, resume: ResumeData, settings: InterviewSettings): Promise<string> {
    try {
        const { client } = await this.getClient();

        const prompt = `
          You are an expert interview assistant helping a candidate.
          
          Candidate Context (Resume):
          ${resume.text}
          
          Candidate Skills:
          ${resume.skills.join(', ')}
          
          Target Role: ${settings.targetRole}
          Mode: ${settings.mode}
          Coding Language: ${settings.codingLanguage}

          Question: "${question}"

          Provide a structured response:
          1. A short, direct answer (punchy, confident).
          2. A detailed explanation with examples from the resume context if applicable.
          3. If this is a coding question, provide a ${settings.codingLanguage} solution with time/space complexity.
          
          Format with Markdown.
        `;

        // Wrapped in retry logic
        const response = await this.withRetry<GenerateContentResponse>(() => client.models.generateContent({
          model: this.textModelId,
          contents: prompt
        }));

        configService.logAction('AI', 'Generated contextual answer');
        return response.text || "Could not generate answer.";
        
    } catch (error: any) {
        const userMsg = this.formatError(error);
        configService.logAction('AI', `Answer generation failed: ${userMsg}`, 'error');
        throw new Error(userMsg);
    }
  }

  async connectLive(
    callbacks: {
      onOpen: () => void;
      onMessage: (text: string | null, isUser: boolean, isComplete: boolean) => void;
      onError: (err: Error) => void;
      onClose: () => void;
      onAudioData: (base64: string) => void;
    },
    resumeContext: ResumeData | null,
    settings: InterviewSettings
  ): Promise<{
    sendAudio: (data: Float32Array) => void;
    disconnect: () => void;
  }> {
    
    // We return a promise that resolves once the session OBJECT is ready to be used.
    // However, the actual connection is async.
    return new Promise(async (resolve, reject) => {
      try {
        const { client, modelId } = await this.getClient();

        let systemInstruction = `
          You are SmartInterview AI, a real-time interview copilot. 
          Your goal is to listen to the interview (user and interviewer) and help the user answer questions.
          Keep your responses concise and textual where possible, but you can speak if needed.
        `;

        if (resumeContext) {
          systemInstruction += `\n\nUser Resume Context:\n${resumeContext.text}\nSkills: ${resumeContext.skills.join(', ')}`;
        }
        
        systemInstruction += `\n\nFocus on ${settings.mode} questions for a ${settings.targetRole} role. Preferred language: ${settings.codingLanguage}.`;

        // Establish the session. We use the Promise to catch immediate config errors.
        const sessionPromise = client.live.connect({
          model: modelId,
          callbacks: {
            onopen: () => {
              configService.logAction('LiveAPI', 'Session connected');
              callbacks.onOpen();
            },
            onmessage: (message: LiveServerMessage) => {
              try {
                  // Handle User Input Transcription
                  const inputTranscription = message.serverContent?.inputTranscription?.text;
                  if (inputTranscription) {
                     callbacks.onMessage(inputTranscription, true, false);
                  }

                  // Handle Model Output Transcription
                  const outputTranscription = message.serverContent?.outputTranscription?.text;
                  if (outputTranscription) {
                     callbacks.onMessage(outputTranscription, false, false);
                  }

                  // Handle Turn Complete
                  const turnComplete = message.serverContent?.turnComplete;
                  if (turnComplete) {
                     callbacks.onMessage(null, false, true);
                  }
                  
                  // Handle Audio Output
                  const audioData = message.serverContent?.modelTurn?.parts?.[0]?.inlineData?.data;
                  if (audioData) {
                    callbacks.onAudioData(audioData);
                  }
              } catch (e) {
                  console.error("Error processing message:", e);
              }
            },
            onerror: (e: any) => {
              const msg = this.formatError(e);
              configService.logAction('LiveAPI', `Connection error: ${msg}`, 'error');
              callbacks.onError(new Error(msg));
            },
            onclose: () => {
              configService.logAction('LiveAPI', 'Session closed');
              callbacks.onClose();
            }
          },
          config: {
            systemInstruction: systemInstruction,
            responseModalities: [Modality.AUDIO], 
            inputAudioTranscription: {}, 
            outputAudioTranscription: {},
          }
        });

        // Wrapper to send audio safely
        const sendAudio = (data: Float32Array) => {
            const pcmBlob = createPcmBlob(data);
            sessionPromise
                .then(session => {
                    session.sendRealtimeInput({ media: pcmBlob });
                })
                .catch(e => {
                    // This catches errors if the session failed to initialize but we tried to send data
                    console.error("Failed to send audio - session not ready:", e);
                });
        };

        const disconnect = () => {
            sessionPromise.then(session => session.close()).catch(() => {});
        };

        resolve({ sendAudio, disconnect });

      } catch (err: any) {
        const msg = this.formatError(err);
        reject(new Error(msg));
      }
    });
  }
}

export const geminiService = new GeminiService();