import React, { useState, useEffect } from 'react';
import { QuizSetup, QuizConfig } from './QuizSetup';
import { QuizScreen } from './QuizScreen';
import { ResultDashboard } from './ResultDashboard';
import { QuizQuestion, QuizResult, Subject } from '../../types';
import { generateQuiz } from '../../services/gemini';
import { Loader2, BrainCircuit } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

interface QuizManagerProps {
  subjects: Subject[];
  onBackToHome: () => void;
}

type QuizStep = 'setup' | 'loading' | 'quiz' | 'result';

export const QuizManager: React.FC<QuizManagerProps> = ({ subjects, onBackToHome }) => {
  const [step, setStep] = useState<QuizStep>('setup');
  const [questions, setQuestions] = useState<QuizQuestion[]>([]);
  const [userAnswers, setUserAnswers] = useState<Record<string, string>>({});
  const [quizDetails, setQuizDetails] = useState<Record<string, QuizResult | null>>({});
  const [loadingMsg, setLoadingMsg] = useState('Đang khởi tạo AI...');
  const [currentConfig, setCurrentConfig] = useState<QuizConfig | null>(null);

  // Persistence for Quiz Stats
  const [stats, setStats] = useState<any>(() => {
    const saved = localStorage.getItem('ai_study_user_stats');
    return saved ? JSON.parse(saved) : {};
  });

  const saveStats = (subjectId: string, chapter: string, score: number) => {
    const newStats = { ...stats };
    if (!newStats[subjectId]) newStats[subjectId] = {};
    if (!newStats[subjectId][chapter]) {
      newStats[subjectId][chapter] = { highestScore: 0, attempts: 0, lastDate: 0 };
    }
    
    const chapterStats = newStats[subjectId][chapter];
    chapterStats.attempts += 1;
    chapterStats.lastDate = Date.now();
    if (score > chapterStats.highestScore) {
      chapterStats.highestScore = score;
    }
    
    setStats(newStats);
    localStorage.setItem('ai_study_user_stats', JSON.stringify(newStats));
  };

  const handleStart = async (config: QuizConfig) => {
    setCurrentConfig(config);
    setStep('loading');
    setLoadingMsg(`AI đang biên soạn đề thi môn ${config.subjectId}...`);
    
    try {
      const subjectName = subjects.find(s => s.id === config.subjectId)?.name || config.subjectId;
      const data = await generateQuiz(subjectName, config.chapter, config.difficulty, config.count);
      if (!data || !Array.isArray(data) || data.length === 0) {
        throw new Error("AI bận hoặc phản hồi cấu trúc câu hỏi bị lỗi. Vui lòng bấm tạo lại đề thi lần nữa!");
      }
      setQuestions(data);
      setStep('quiz');
    } catch (error: any) {
      console.error("Quiz generation failed:", error);
      alert(error?.message || "AI đang bận, vui lòng thử lại sau giây lát!");
      setStep('setup');
    }
  };

  const handleComplete = (answers: Record<string, string>, details: Record<string, QuizResult | null>) => {
    setUserAnswers(answers);
    setQuizDetails(details);
    
    // Calculate total score for stats
    const totalPossible = questions.length * 10;
    const actualScore = Object.values(details).reduce((acc, curr) => acc + (curr?.score || 0), 0);
    const score10 = (actualScore / totalPossible) * 10;
    
    if (currentConfig) {
        saveStats(currentConfig.subjectId, currentConfig.chapter, score10);
    }
    
    setStep('result');
  };

  return (
    <div className="min-h-full py-8 px-4">
      <AnimatePresence mode="wait">
        {step === 'setup' && (
          <motion.div
            key="setup"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
          >
            <QuizSetup subjects={subjects} onStart={handleStart} />
          </motion.div>
        )}

        {step === 'loading' && (
          <motion.div
            key="loading"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="flex flex-col items-center justify-center py-20 space-y-6"
          >
            <div className="relative">
                <div className="absolute inset-0 bg-blue-500 rounded-full blur-2xl opacity-20 animate-pulse" />
                <BrainCircuit size={64} className="text-blue-600 animate-bounce relative z-10" />
            </div>
            <div className="flex flex-col items-center gap-2">
                <Loader2 className="w-8 h-8 animate-spin text-blue-500" />
                <p className="text-lg font-bold text-gray-800 dark:text-white animate-pulse">{loadingMsg}</p>
                <p className="text-sm text-gray-400">Điều này có thể mất 10-15 giây...</p>
            </div>
          </motion.div>
        )}

        {step === 'quiz' && (
          <motion.div
            key="quiz"
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -20 }}
          >
            <QuizScreen questions={questions} onComplete={handleComplete} />
          </motion.div>
        )}

        {step === 'result' && (
          <motion.div
            key="result"
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.9 }}
          >
            <ResultDashboard 
              questions={questions} 
              userAnswers={userAnswers} 
              details={quizDetails} 
              onReset={() => setStep('setup')}
              onHome={onBackToHome}
            />
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};
