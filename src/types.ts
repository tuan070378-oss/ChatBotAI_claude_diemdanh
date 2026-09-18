export type Role = 'user' | 'model';

export interface Message {
  role: Role;
  content: string;
  images?: string[]; // Array of base64 strings
  timestamp?: number;
}

export interface Subject {
  id: string;
  name: string;
  icon: any;
  color: string;
  bg: string;
}

export interface QuizQuestion {
  id: string;
  type: 'mcq' | 'essay';
  question: string;
  options?: string[];
  correctAnswer: string;
  explanation: string;
  difficulty: 'easy' | 'medium' | 'hard';
}

export interface QuizProgress {
  subjectId: string;
  chapter: string;
  score: number;
  totalQuestions: number;
  date: number;
}

export interface QuizResult {
  score: number;
  feedback: string;
  missingPoints: string[];
}
