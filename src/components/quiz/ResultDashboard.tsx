import React from 'react';
import { QuizQuestion, QuizResult } from '../../types';
import { Trophy, RefreshCcw, Home, Check, X, AlertCircle } from 'lucide-react';
import { motion } from 'motion/react';
import { cn, cleanMathText } from '../../lib/utils';

interface ResultDashboardProps {
  questions: QuizQuestion[];
  userAnswers: Record<string, string>;
  details: Record<string, QuizResult | null>;
  onReset: () => void;
  onHome: () => void;
}

export const ResultDashboard: React.FC<ResultDashboardProps> = ({
  questions,
  userAnswers,
  details,
  onReset,
  onHome
}) => {
  const totalScore = Object.values(details).reduce((acc, curr) => acc + (curr?.score || 0), 0);
  const avgScore = (totalScore / (questions.length * 10)).toFixed(1);
  const percentage = Math.round((totalScore / (questions.length * 10)) * 100);

  const getEncouragement = (p: number) => {
    if (p >= 90) return "Xuất sắc! Em đã nắm rất vững bản chất kiến thức cơ khí phần này.";
    if (p >= 70) return "Rất tốt! Em hiểu bài khá sâu, hãy tiếp tục phát huy tay nghề.";
    if (p >= 50) return "Khá ổn, nhưng em cần xem kỹ lại các câu sai để nắm chắc hơn.";
    return "Đừng nản lòng nhé! Em hãy đọc kỹ phần giải thích chi tiết bên dưới để ôn tập lại.";
  };

  return (
    <div className="max-w-4xl mx-auto space-y-6 sm:space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
      {/* Summary Card */}
      <div className="bg-white dark:bg-gray-900 rounded-3xl shadow-md border border-gray-200 dark:border-gray-800 overflow-hidden">
        <div className="bg-gradient-to-br from-cyan-600 to-indigo-700 p-6 sm:p-8 text-center space-y-3 text-white">
          <motion.div
            initial={{ scale: 0 }}
            animate={{ scale: 1 }}
            transition={{ type: 'spring', damping: 12 }}
            className="w-20 h-20 bg-white/20 backdrop-blur-md rounded-full flex items-center justify-center mx-auto border-3 border-white/40 shadow-md"
          >
            <Trophy className="w-10 h-10 text-white fill-white/20" />
          </motion.div>
          <div className="space-y-1">
            <h2 className="text-2xl sm:text-3xl font-extrabold text-white">Kết quả: {percentage}%</h2>
            <p className="text-cyan-100 text-xs sm:text-sm font-medium max-w-md mx-auto">{getEncouragement(percentage)}</p>
          </div>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-4 border-b border-gray-100 dark:border-gray-800 divide-x divide-gray-100 dark:divide-gray-800">
          <div className="p-4 sm:p-5 text-center">
            <span className="block text-[11px] uppercase font-bold text-gray-500 mb-1">Tổng điểm</span>
            <span className="text-xl sm:text-2xl font-black text-gray-900 dark:text-white">{totalScore}</span>
          </div>
          <div className="p-4 sm:p-5 text-center">
            <span className="block text-[11px] uppercase font-bold text-gray-500 mb-1">Số câu hỏi</span>
            <span className="text-xl sm:text-2xl font-black text-gray-900 dark:text-white">{questions.length}</span>
          </div>
          <div className="p-4 sm:p-5 text-center">
            <span className="block text-[11px] uppercase font-bold text-gray-500 mb-1">Đạt yêu cầu</span>
            <span className="text-xl sm:text-2xl font-black text-emerald-600 dark:text-emerald-400">
              {Object.values(details).filter(d => (d?.score || 0) >= 7).length}
            </span>
          </div>
          <div className="p-4 sm:p-5 text-center">
            <span className="block text-[11px] uppercase font-bold text-gray-500 mb-1">Hệ số TB</span>
            <span className="text-xl sm:text-2xl font-black text-cyan-600 dark:text-cyan-400">{avgScore}</span>
          </div>
        </div>

        {/* Detailed Feedback */}
        <div className="p-4 sm:p-6 space-y-4 sm:space-y-6">
          <h3 className="font-bold text-sm sm:text-base text-gray-900 dark:text-white flex items-center gap-2">
            <AlertCircle size={18} className="text-cyan-600 dark:text-cyan-400" /> Chi tiết đáp án & Phân tích chuyên sâu
          </h3>
          <div className="space-y-3 sm:space-y-4">
            {questions.map((q, idx) => {
              const res = details[q.id];
              const isCorrect = (res?.score || 0) >= 8;
              return (
                <div key={q.id} className="p-4 bg-gray-50 dark:bg-gray-800/60 rounded-2xl border border-gray-200/80 dark:border-gray-800 space-y-3">
                  <div className="flex items-start gap-3">
                    <div className={cn(
                      "w-6 h-6 rounded-lg flex items-center justify-center shrink-0 mt-0.5 shadow-2xs",
                      isCorrect ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-300" : "bg-rose-100 text-rose-700 dark:bg-rose-950/60 dark:text-rose-300"
                    )}>
                      {isCorrect ? <Check size={14} /> : <X size={14} />}
                    </div>
                    <div className="space-y-2 flex-1 min-w-0">
                      <div className="flex items-start justify-between gap-2">
                        <p className="text-xs sm:text-sm font-bold text-gray-900 dark:text-white leading-snug">
                          Câu {idx + 1}: {cleanMathText(q.question)}
                        </p>
                        <span className={cn("text-xs font-black shrink-0 px-2 py-0.5 rounded-md", isCorrect ? "bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300" : "bg-rose-100 text-rose-800 dark:bg-rose-950 dark:text-rose-300")}>
                          {res?.score}/10đ
                        </span>
                      </div>
                      
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
                        <div className="p-2.5 bg-white dark:bg-gray-900 rounded-xl border border-gray-100 dark:border-gray-800">
                          <span className="text-gray-400 font-bold uppercase text-[10px] block mb-0.5">Em đã chọn:</span>
                          <p className={cn("font-semibold leading-relaxed", isCorrect ? "text-emerald-700 dark:text-emerald-400" : "text-rose-700 dark:text-rose-400")}>
                            {cleanMathText(userAnswers[q.id] || '(Chưa điền câu trả lời)')}
                          </p>
                        </div>
                        <div className="p-2.5 bg-white dark:bg-gray-900 rounded-xl border border-gray-100 dark:border-gray-800">
                          <span className="text-gray-400 font-bold uppercase text-[10px] block mb-0.5">Đáp án chuẩn:</span>
                          <p className="text-cyan-800 dark:text-cyan-300 font-semibold leading-relaxed">{cleanMathText(q.correctAnswer)}</p>
                        </div>
                      </div>

                      <div className="p-3 bg-white dark:bg-gray-900 rounded-xl text-xs leading-relaxed border border-gray-100 dark:border-gray-800">
                        <span className="font-bold text-cyan-700 dark:text-cyan-400 uppercase text-[10px] mb-1 block">💡 Phân tích & Hướng dẫn:</span>
                        <p className="text-gray-700 dark:text-gray-300">{cleanMathText(res?.feedback || q.explanation)}</p>
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      <div className="flex flex-col sm:flex-row gap-3">
        <button
          onClick={onReset}
          className="flex-1 py-3.5 bg-cyan-600 hover:bg-cyan-700 active:scale-98 text-white rounded-2xl font-bold flex items-center justify-center gap-2 shadow-md shadow-cyan-600/20 transition-all cursor-pointer text-xs sm:text-sm"
        >
          <RefreshCcw size={18} />
          Làm bộ đề mới
        </button>
        <button
          onClick={onHome}
          className="flex-1 py-3.5 bg-white dark:bg-gray-900 text-gray-800 dark:text-gray-200 border border-gray-200 dark:border-gray-800 hover:bg-gray-50 dark:hover:bg-gray-800 active:scale-98 rounded-2xl font-bold flex items-center justify-center gap-2 shadow-2xs transition-all cursor-pointer text-xs sm:text-sm"
        >
          <Home size={18} />
          Về màn hình chính
        </button>
      </div>
    </div>
  );
};
