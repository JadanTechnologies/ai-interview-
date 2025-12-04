import { GoogleGenAI, LiveServerMessage, Modality } from "@google/genai";
import { ResumeData, InterviewSettings } from "../types";
import { createPcmBlob, fileToBase64 } from "./audioUtils";
import { configService } from "./configService";

export class GeminiService {
  private textModelId = 'gemini-2.5-flash';

  // Helper to get a working client with failover
  private async getClient(): Promise<{ client: GoogleGenAI, modelId: string }> {
    const providers = configService.getActiveProviders();
    
    if (providers.length === 0) {
      throw new Error("No active AI providers configured. Please contact Admin.");
    }

    // Simple priority-based selection
    const primary = providers[0];
    
    // Log usage
    primary.usageCount++;
    configService.saveProvider(primary);

    return {
      client: new GoogleGenAI({ apiKey: primary.apiKey }),
      modelId: primary.modelId
    };
  }

  async parseResume(file: File): Promise<ResumeData> {
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

    try {
      const response = await client.models.generateContent({
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
      });

      let text = response.text;
      if (!text) throw new Error("No response from Gemini");
      
      // Sanitize markdown code blocks if present
      text = text.replace(/```json/g, '').replace(/```/g, '');

      let parsed;
      try {
        parsed = JSON.parse(text);
      } catch (e) {
        console.error("Failed to parse JSON", text);
        throw new Error("Invalid response format from AI");
      }

      configService.logAction('AI', 'Resume parsed successfully');

      return {
        text: parsed.text || "No summary available.",
        skills: Array.isArray(parsed.skills) ? parsed.skills : [],
        fileName: file.name
      };
    } catch (error: any) {
      configService.logAction('AI', `Resume parsing failed: ${error.message}`, 'error');
      console.error("Resume parsing failed:", error);
      throw error;
    }
  }

  async generateContextualAnswer(question: string, resume: ResumeData, settings: InterviewSettings): Promise<string> {
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

    const response = await client.models.generateContent({
      model: this.textModelId,
      contents: prompt
    });

    configService.logAction('AI', 'Generated contextual answer');
    return response.text || "Could not generate answer.";
  }

  // Live API Connection Manager
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

    return new Promise(async (resolve, reject) => {
      try {
        const sessionPromise = client.live.connect({
          model: modelId,
          callbacks: {
            onopen: () => {
              configService.logAction('LiveAPI', 'Session connected');
              callbacks.onOpen();
            },
            onmessage: (message: LiveServerMessage) => {
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

              // Handle Turn Complete (useful for finalizing state if needed)
              const turnComplete = message.serverContent?.turnComplete;
              if (turnComplete) {
                 callbacks.onMessage(null, false, true);
              }
              
              // Handle Audio Output
              const audioData = message.serverContent?.modelTurn?.parts?.[0]?.inlineData?.data;
              if (audioData) {
                callbacks.onAudioData(audioData);
              }
            },
            onerror: (e: ErrorEvent) => {
              configService.logAction('LiveAPI', 'Connection error', 'error');
              callbacks.onError(new Error("Live connection error"));
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

        const sendAudio = (data: Float32Array) => {
            const pcmBlob = createPcmBlob(data);
            sessionPromise.then(session => {
                session.sendRealtimeInput({ media: pcmBlob });
            });
        };

        const disconnect = () => {
            sessionPromise.then(session => session.close());
        };

        resolve({ sendAudio, disconnect });

      } catch (err) {
        reject(err);
      }
    });
  }
}

export const geminiService = new GeminiService();