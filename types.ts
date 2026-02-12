
export interface DialogueTurn {
  id: number;
  speaker: string; // "A" or "B"
  english: string;
  korean: string;
}

export interface Dialogue {
  id: number;
  title: string;
  category: string;
  turns: DialogueTurn[];
}

export interface Word {
  id: number;
  english: string;
  korean: string;
  category: string;
}

export interface UserProgress {
  completedIds: number[]; // Completed Dialogue IDs (Learning Phase)
  roleplayCompletedIds: number[]; // Completed Dialogue IDs (Roleplay Phase)
  completedTurnIds: number[];
  completedWordIds: number[];
  dailyCount: number;
  lastPracticeDate: string;
  targetAccuracy: number;
  dailyGoal: number;
}

export interface PronunciationFeedback {
  word: string;
  isCorrect: boolean;
  score: number;
  tip?: string;
}

export interface AnalysisResult {
  overallScore: number;
  feedback: PronunciationFeedback[];
  summary: string;
}

export enum AppState {
  IDLE = 'IDLE',
  RECORDING = 'RECORDING',
  ANALYZING = 'ANALYZING',
  RESULT = 'RESULT',
  WAITING_FOR_AI = 'WAITING_FOR_AI' // AI가 대답하는 중
}

export type PracticeMode = 'sentence' | 'word';
export type DialoguePhase = 'learning' | 'roleplay';
export type Role = 'A' | 'B';
