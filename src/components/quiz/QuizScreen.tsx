import React, { useState } from 'react';
import { QuizQuestion, QuizResult } from '../../types';
import { motion, AnimatePresence } from 'motion/react';
import { CheckCircle2, ChevronRight, ChevronLeft, Send, HelpCircle, Loader2 } from 'lucide-react';
import { cn, cleanMathText } from '../../lib/utils';
import { gradeEssay } from '../../services/gemini';

interface QuizScreenProps {
  questions: QuizQuestion[];
  onComplete: (userAnswers: Record<string, string>, details: Record<string, QuizResult | null>) => void;
}

export const QuizScreen: React.FC<QuizScreenProps> = ({ questions, onComplete }) => {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [userAnswers, setUserAnswers] = useState<Record<string, string>>({});
  const [essayGrading, setEssayGrading] = useState<Record<string, QuizResult | null>>({});
  const [isLoading, setIsLoading] = useState(false);

  const currentQuestion = questions[currentIndex];
  const isMcq = currentQuestion.type === 'mcq';
  const progress = ((currentIndex + 1) / questions.length) * 100;

  const handleNext = async () => {
    if (currentIndex < questions.length - 1) {
      setCurrentIndex(prev => prev + 1);
    } else {
      // Finalize
      setIsLoading(true);
      const details: Record<string, QuizResult | null> = {};
      
      // For MCQ, we can auto-grade. For essay, we use the saved gradings (if any) or grade them now
      for (const q of questions) {
        if (q.id in essayGrading) {
            details[q.id] = essayGrading[q.id];
        } else if (q.type === 'mcq') {
            const isCorrect = userAnswers[q.id] === q.correctAnswer;
            details[q.id] = {
                score: isCorrect ? 10 : 0,
                feedback: isCorrect ? "Đáp án hoàn toàn chính xác!" : `Rất tiếc, đáp án đúng phải là ${q.correctAnswer}.`,
                missingPoints: isCorrect ? [] : ["Đáp án chưa đúng"]
            };
        }
      }
      
      onComplete(userAnswers, details);
      setIsLoading(false);
    }
  };

  const handleMcqSelect = (ans: string) => {
    setUserAnswers(prev => ({ ...prev, [currentQuestion.id]: ans }));
  };

  const handleEssaySubmit = async () => {
    const ans = userAnswers[currentQuestion.id];
    if (!ans) return;

    setIsLoading(true);
    try {
      const result = await gradeEssay(currentQuestion.question, currentQuestion.correctAnswer, ans);
      setEssayGrading(prev => ({ ...prev, [currentQuestion.id]: result }));
    } catch (error) {
      console.error("Grading failed:", error);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="max-w-3xl mx-auto space-y-4 sm:space-y-6 animate-in fade-in zoom-in-95 duration-500">
      {/* Progress Bar */}
      <div className="bg-white/90 dark:bg-gray-900/80 backdrop-blur-md border border-gray-200 dark:border-gray-800 rounded-2xl p-3.5 sm:p-4 flex items-center gap-4 shadow-xs">
        <div className="flex-1 h-2.5 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
          <motion.div 
            className="h-full bg-fire-1 dark:bg-fire-2 rounded-full shadow-xs" 
            initial={{ width: 0 }}
            animate={{ width: `${progress}%` }}
          />
        </div>
        <span className="text-xs font-extrabold text-fire-1 dark:text-fire-2 min-w-[60px] text-right font-mono">
          {currentIndex + 1} / {questions.length}
        </span>
      </div>

      {/* Main Question Card */}
      <div className="bg-white dark:bg-gray-900 rounded-3xl shadow-md border border-gray-200 dark:border-gray-800 p-5 sm:p-8 min-h-[360px] flex flex-col relative overflow-hidden transition-colors">
        <AnimatePresence mode="wait">
          <motion.div
            key={currentQuestion.id}
            initial={{ opacity: 0, x: 16 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -16 }}
            className="space-y-6 flex-1"
          >
            <div className="flex items-start gap-3.5 sm:gap-4">
              <div className={cn(
                "w-10 h-10 rounded-xl flex items-center justify-center shrink-0 shadow-xs",
                isMcq ? "bg-orange-100 dark:bg-navy-panel text-fire-1 dark:text-fire-2" : "bg-indigo-100 dark:bg-indigo-950/60 text-indigo-700 dark:text-indigo-300"
              )}>
                {isMcq ? <CheckCircle2 size={22} /> : <HelpCircle size={22} />}
              </div>
              <div className="space-y-1">
                <span className="text-[10px] uppercase font-bold tracking-wider text-fire-1 dark:text-fire-2">
                  {isMcq ? "Câu hỏi Trắc nghiệm" : "Câu hỏi Tự luận giải thích"}
                </span>
                <h3 className="text-base sm:text-lg font-bold text-gray-900 dark:text-white leading-relaxed">
                  {cleanMathText(currentQuestion.question)}
                </h3>
              </div>
            </div>

            {/* Answer Area */}
            <div className="space-y-3">
              {isMcq ? (
                <div className="grid grid-cols-1 gap-2.5">
                  {currentQuestion.options?.map((opt, idx) => {
                    const isSelected = userAnswers[currentQuestion.id] === opt;
                    return (
                      <button
                        key={idx}
                        onClick={() => handleMcqSelect(opt)}
                        className={cn(
                          "p-3.5 sm:p-4 rounded-2xl border text-left transition-all flex items-center gap-3 sm:gap-4 group cursor-pointer",
                          isSelected 
                            ? "border-fire-2 bg-orange-50 dark:bg-navy-panel ring-2 ring-fire-2/30 shadow-xs" 
                            : "border-gray-200 dark:border-steel hover:border-fire-2/60 hover:bg-gray-50 dark:hover:bg-gray-800/40"
                        )}
                      >
                        <div className={cn(
                          "w-6 h-6 rounded-full border flex items-center justify-center transition-all shrink-0 font-bold text-xs",
                          isSelected ? "bg-fire-1 border-fire-1 text-white" : "border-gray-300 dark:border-gray-600 text-gray-500"
                        )}>
                          {String.fromCharCode(65 + idx)}
                        </div>
                        <span className={cn(
                          "text-xs sm:text-sm font-medium",
                          isSelected ? "text-orange-950 dark:text-fire-2 font-bold" : "text-gray-800 dark:text-gray-200"
                        )}>
                          {cleanMathText(opt)}
                        </span>
                      </button>
                    );
                  })}
                </div>
              ) : (
                <div className="space-y-3.5">
                  <textarea
                    value={userAnswers[currentQuestion.id] || ''}
                    onChange={(e) => setUserAnswers(prev => ({ ...prev, [currentQuestion.id]: e.target.value }))}
                    placeholder="Hãy nêu khái niệm, các bước tính toán hoặc phân tích của em..."
                    aria-label="Câu trả lời tự luận"
                    className="w-full p-4 rounded-2xl bg-gray-50 dark:bg-gray-800/80 border border-gray-200 dark:border-gray-700 focus-visible:ring-2 focus-visible:ring-fire-2 outline-none text-gray-900 dark:text-white text-xs sm:text-sm min-h-[140px] transition-all"
                  />
                  {!essayGrading[currentQuestion.id] && (
                    <button
                        onClick={handleEssaySubmit}
                        disabled={isLoading || !userAnswers[currentQuestion.id]}
                        className="px-5 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs sm:text-sm font-bold transition-all disabled:opacity-40 flex items-center gap-2 cursor-pointer shadow-xs"
                    >
                        {isLoading ? <Loader2 size={16} className="animate-spin" /> : <Send size={16} />}
                        Nộp câu này để Thầy/Cô chấm điểm
                    </button>
                  )}
                  {essayGrading[currentQuestion.id] && (
                    <div className="p-4 bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-800/60 rounded-2xl space-y-2">
                        <div className="flex items-center justify-between">
                            <span className="text-xs font-bold text-emerald-800 dark:text-emerald-300 uppercase tracking-wider">Thầy/Cô đã chấm điểm:</span>
                            <span className="text-lg font-black text-emerald-700 dark:text-emerald-400">{essayGrading[currentQuestion.id]?.score}/10 điểm</span>
                        </div>
                        <p className="text-xs text-emerald-900 dark:text-emerald-200 leading-relaxed font-medium">{cleanMathText(essayGrading[currentQuestion.id]?.feedback)}</p>
                    </div>
                  )}
                </div>
              )}
            </div>
          </motion.div>
        </AnimatePresence>

        {/* Footer Actions */}
        <div className="mt-8 pt-5 border-t border-gray-100 dark:border-gray-800 flex justify-between items-center gap-3">
            <button
                onClick={() => setCurrentIndex(prev => Math.max(0, prev - 1))}
                disabled={currentIndex === 0}
                className="px-4 py-2.5 rounded-xl border border-gray-200 dark:border-gray-700 text-xs sm:text-sm font-bold text-gray-600 dark:text-gray-300 hover:text-fire-1 hover:border-fire-2 disabled:opacity-30 disabled:pointer-events-none transition-all flex items-center gap-1.5 cursor-pointer"
                aria-label="Quay lại câu trước"
            >
                <ChevronLeft size={16} />
                Quay lại
            </button>
            <button
                onClick={handleNext}
                disabled={isLoading || !userAnswers[currentQuestion.id]}
                className="px-6 sm:px-8 py-2.5 sm:py-3 fire-gradient-bg hover:opacity-90 active:scale-98 text-white rounded-xl text-xs sm:text-sm font-bold flex items-center gap-2 shadow-md shadow-fire-1/20 transition-all disabled:opacity-40 disabled:pointer-events-none cursor-pointer"
            >
                {isLoading ? (
                    <Loader2 size={18} className="animate-spin" />
                ) : (
                    <>
                        {currentIndex < questions.length - 1 ? 'Câu tiếp theo' : 'Hoàn thành bài ôn'}
                        <ChevronRight size={18} />
                    </>
                )}
            </button>
        </div>
      </div>
      
      <p className="text-center text-[10px] text-gray-500 dark:text-gray-400 font-bold uppercase tracking-widest">
        Học tập thực chất - Vững chắc tay nghề
      </p>
    </div>
  );
};