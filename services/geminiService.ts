
import { GoogleGenAI, Modality, Type } from "@google/genai";
import { AnalysisResult } from "../types";

// Helper to encode Uint8Array to base64
function encode(bytes: Uint8Array) {
  let binary = '';
  const len = bytes.byteLength;
  for (let i = 0; i < len; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary);
}

// Helper to decode base64 to Uint8Array
function decode(base64: string) {
  const binaryString = atob(base64);
  const len = binaryString.length;
  const bytes = new Uint8Array(len);
  for (let i = 0; i < len; i++) {
    bytes[i] = binaryString.charCodeAt(i);
  }
  return bytes;
}

export async function decodeAudioData(
  data: Uint8Array,
  ctx: AudioContext,
  sampleRate: number,
  numChannels: number,
): Promise<AudioBuffer> {
  const dataInt16 = new Int16Array(data.buffer);
  const frameCount = dataInt16.length / numChannels;
  const buffer = ctx.createBuffer(numChannels, frameCount, sampleRate);

  for (let channel = 0; channel < numChannels; channel++) {
    const channelData = buffer.getChannelData(channel);
    for (let i = 0; i < frameCount; i++) {
      channelData[i] = dataInt16[i * numChannels + channel] / 32768.0;
    }
  }
  return buffer;
}

export class GeminiService {
  private ai: GoogleGenAI;

  constructor() {
    this.ai = new GoogleGenAI({ apiKey: process.env.API_KEY || '' });
  }

  async speak(text: string): Promise<void> {
    try {
      const response = await this.ai.models.generateContent({
        model: "gemini-2.5-flash-preview-tts",
        contents: [{ parts: [{ text: `Read naturally: ${text}` }] }],
        config: {
          responseModalities: [Modality.AUDIO],
          speechConfig: {
            voiceConfig: {
              prebuiltVoiceConfig: { voiceName: 'Kore' },
            },
          },
        },
      });

      const base64Audio = response.candidates?.[0]?.content?.parts?.[0]?.inlineData?.data;
      if (!base64Audio) throw new Error("No audio returned");

      const audioContext = new (window.AudioContext || (window as any).webkitAudioContext)({ sampleRate: 24000 });
      const audioBuffer = await decodeAudioData(decode(base64Audio), audioContext, 24000, 1);
      
      const source = audioContext.createBufferSource();
      source.buffer = audioBuffer;
      source.connect(audioContext.destination);
      source.start();
    } catch (error) {
      console.error("TTS Error:", error);
    }
  }

  async analyzePronunciation(text: string, audioBase64: string): Promise<AnalysisResult> {
    try {
      const response = await this.ai.models.generateContent({
        model: 'gemini-3-flash-preview',
        contents: [
          {
            parts: [
              {
                inlineData: {
                  mimeType: 'audio/webm;codecs=opus',
                  data: audioBase64,
                },
              },
              {
                text: `Analyze the pronunciation of the user speaking the sentence: "${text}". 
                Identify which words were pronounced correctly and which were not. 
                Return the results as JSON.`,
              },
            ],
          },
        ],
        config: {
          responseMimeType: "application/json",
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              overallScore: { type: Type.NUMBER, description: "A score from 0 to 100 for overall clarity." },
              summary: { type: Type.STRING, description: "A brief encouraging summary of what they did well and what to improve." },
              feedback: {
                type: Type.ARRAY,
                items: {
                  type: Type.OBJECT,
                  properties: {
                    word: { type: Type.STRING },
                    isCorrect: { type: Type.BOOLEAN },
                    score: { type: Type.NUMBER },
                    tip: { type: Type.STRING, description: "Phonetic advice for this specific word." }
                  },
                  required: ["word", "isCorrect", "score"]
                }
              }
            },
            required: ["overallScore", "feedback", "summary"]
          }
        }
      });

      return JSON.parse(response.text.trim());
    } catch (error) {
      console.error("Analysis Error:", error);
      return {
        overallScore: 0,
        summary: "Something went wrong with the analysis. Please try again.",
        feedback: text.split(' ').map(w => ({ word: w, isCorrect: false, score: 0, tip: "Error" }))
      };
    }
  }
}
