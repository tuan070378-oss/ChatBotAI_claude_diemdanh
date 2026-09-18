import React, { useState } from 'react';
import { Subject } from '../../types';
import { Settings, Play, BookOpen, Layers, BarChart3 } from 'lucide-react';
import { cn } from '../../lib/utils';

interface QuizSetupProps {
  subjects: Subject[];
  onStart: (config: QuizConfig) => void;
}

export interface QuizConfig {
  subjectId: string;
  chapter: string;
  difficulty: 'easy' | 'medium' | 'hard';
  count: number;
}

const CHAPTERS: Record<string, string[]> = {
  'dung-sai': ['Kích thước & Sai lệch', 'Lắp ghép lỏng/chặt', 'Dụng cụ đo panme/thước cặp', 'Dung sai hình học'],
  'co-ky-thuat': ['Lực & Mô men', 'Cân bằng vật rắn', 'Ma sát', 'Truyền động bánh răng'],
  've-ky-thuat': ['Hình chiếu cơ bản', 'Hình cắt - Mặt cắt', 'Lược đồ chi tiết', 'Ký hiệu độ nhám'],
  'an-toan': ['Trang thiết bị BHLĐ', 'An toàn điện', 'PCCC tại xưởng', 'Vệ sinh công nghiệp'],
  'vat-lieu': ['Tính chất của vật liệu', 'Thép & Gang', 'Kim loại màu & Hợp kim', 'Nhiệt luyện thép', 'VẬT LIỆU PHI KIM LOẠI (Polyme, Cao su, Composit)', 'Dầu, mỡ bôi trơn & Nhiên liệu'],
};

export const QuizSetup: React.FC<QuizSetupProps> = ({ subjects, onStart }) => {
  const [subjectId, setSubjectId] = useState(subjects[0].id);
  const [chapter, setChapter] = useState(CHAPTERS[subjects[0].id]?.[0] || 'Chương 1');
  const [difficulty, setDifficulty] = useState<'easy' | 'medium' | 'hard'>('medium');
  const [count, setCount] = useState(5);

  const handleSubjectChange = (id: string) => {
    setSubjectId(id);
    setChapter(CHAPTERS[id]?.[0] || 'Chương 1');
  };

  const currentChapters = CHAPTERS[subjectId] || ['Chương 1', 'Chương 2', 'Chương 3'];

  return (
    <div className="max-w-4xl mx-auto space-y-6 sm:space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
      <div className="text-center space-y-2">
        <h2 className="font-heading font-extrabold text-2xl sm:text-3xl text-gray-900 dark:text-white">
          Cấu hình Ôn tập Trí tuệ AI
        </h2>
        <p className="text-gray-600 dark:text-gray-400 text-xs sm:text-sm font-medium">
          Tự động biên soạn đề thi bám sát chương trình đào tạo Cao đẳng Cơ khí
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Left Column: Select Subject */}
        <div className="space-y-3">
          <label className="text-xs font-bold uppercase tracking-wider text-cyan-700 dark:text-cyan-400 flex items-center gap-2">
            <BookOpen size={14} /> Bước 1: Chọn môn học ôn luyện
          </label>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
            {subjects.map((s) => (
              <button
                key={s.id}
                onClick={() => handleSubjectChange(s.id)}
                className={cn(
                  "p-3.5 sm:p-4 rounded-2xl border text-left transition-all relative overflow-hidden group cursor-pointer",
                  subjectId === s.id 
                    ? "border-cyan-500 bg-cyan-50 dark:bg-cyan-950/40 ring-2 ring-cyan-500/30 shadow-xs" 
                    : "border-gray-200 dark:border-gray-800 bg-white/90 dark:bg-gray-900/60 hover:border-cyan-400/50"
                )}
              >
                <s.icon size={20} className={cn("mb-2 transition-transform group-hover:scale-110", subjectId === s.id ? "text-cyan-600 dark:text-cyan-400" : "text-gray-500 group-hover:text-cyan-600")} />
                <span className={cn("text-xs sm:text-sm font-bold block", subjectId === s.id ? "text-cyan-900 dark:text-cyan-300" : "text-gray-800 dark:text-gray-300")}>
                  {s.name}
                </span>
              </button>
            ))}
          </div>
        </div>

        {/* Right Column: Settings */}
        <div className="bg-white/90 dark:bg-gray-900/80 backdrop-blur-xl border border-gray-200 dark:border-gray-800 rounded-3xl p-5 sm:p-6 space-y-5 shadow-xs">
          <div className="space-y-2">
            <label className="text-xs font-bold uppercase tracking-wider text-cyan-700 dark:text-cyan-400 flex items-center gap-2">
              <Layers size={14} /> Bước 2: Chương / Chủ đề
            </label>
            <select
              value={chapter}
              onChange={(e) => setChapter(e.target.value)}
              className="w-full p-3 rounded-xl bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 text-xs sm:text-sm text-gray-900 dark:text-gray-100 font-semibold outline-none focus-visible:ring-2 focus-visible:ring-cyan-500/50 cursor-pointer shadow-2xs"
            >
              {currentChapters.map((c) => (
                <option key={c} value={c}>{c}</option>
              ))}
            </select>
          </div>

          <div className="space-y-2">
            <label className="text-xs font-bold uppercase tracking-wider text-cyan-700 dark:text-cyan-400 flex items-center gap-2">
              <BarChart3 size={14} /> Bước 3: Mức độ đề
            </label>
            <div className="flex gap-2">
              {(['easy', 'medium', 'hard'] as const).map((d) => (
                <button
                  key={d}
                  onClick={() => setDifficulty(d)}
                  className={cn(
                    "flex-1 py-2.5 rounded-xl text-xs sm:text-sm font-bold transition-all border cursor-pointer",
                    difficulty === d 
                      ? "bg-cyan-600 hover:bg-cyan-700 text-white border-cyan-600 shadow-xs" 
                      : "bg-gray-50 dark:bg-gray-800/80 text-gray-700 dark:text-gray-300 border-gray-200 dark:border-gray-700 hover:border-cyan-500/40"
                  )}
                >
                  {d === 'easy' ? 'Dễ' : d === 'medium' ? 'Vừa' : 'Khó'}
                </button>
              ))}
            </div>
          </div>

          <div className="space-y-2">
            <label className="text-xs font-bold uppercase tracking-wider text-cyan-700 dark:text-cyan-400 flex items-center justify-between">
              <span className="flex items-center gap-2"><Settings size={14} /> Bước 4: Số lượng câu:</span>
              <span className="text-cyan-600 dark:text-cyan-400 font-extrabold">{count} câu</span>
            </label>
            <input
              type="range"
              min="3"
              max="15"
              step="1"
              value={count}
              onChange={(e) => setCount(Number(e.target.value))}
              className="w-full h-2 bg-gray-200 dark:bg-gray-700 rounded-lg appearance-none cursor-pointer accent-cyan-600"
            />
            <div className="flex justify-between text-[11px] text-gray-500 px-1 font-mono">
              <span>3 câu</span>
              <span>15 câu</span>
            </div>
          </div>
        </div>
      </div>

      <div className="flex justify-center pt-2">
        <button
          onClick={() => onStart({ subjectId, chapter, difficulty, count })}
          className="w-full sm:w-auto px-8 sm:px-12 py-3.5 sm:py-4 bg-cyan-600 hover:bg-cyan-700 active:scale-98 text-white rounded-2xl font-bold flex items-center justify-center gap-3 shadow-lg shadow-cyan-600/20 transition-all group cursor-pointer"
        >
          <Play size={18} className="fill-current group-hover:scale-110 transition-transform" />
          Bắt đầu ôn tập cùng AI
        </button>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <div className="p-3.5 bg-emerald-50 dark:bg-emerald-950/20 border border-emerald-200 dark:border-emerald-800/40 rounded-2xl flex items-center gap-3">
          <div className="w-7 h-7 rounded-full bg-emerald-100 dark:bg-emerald-900/40 flex items-center justify-center text-emerald-600 dark:text-emerald-400 text-xs font-bold shrink-0">✓</div>
          <span className="text-xs text-emerald-800 dark:text-emerald-300 font-semibold">Sinh đề chuẩn giáo trình</span>
        </div>
        <div className="p-3.5 bg-purple-50 dark:bg-purple-950/20 border border-purple-200 dark:border-purple-800/40 rounded-2xl flex items-center gap-3">
          <div className="w-7 h-7 rounded-full bg-purple-100 dark:bg-purple-900/40 flex items-center justify-center text-purple-600 dark:text-purple-400 text-xs font-bold shrink-0">✎</div>
          <span className="text-xs text-purple-800 dark:text-purple-300 font-semibold">Tự luận & Trắc nghiệm AI</span>
        </div>
        <div className="p-3.5 bg-amber-50 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-800/40 rounded-2xl flex items-center gap-3">
          <div className="w-7 h-7 rounded-full bg-amber-100 dark:bg-amber-900/40 flex items-center justify-center text-amber-600 dark:text-amber-400 text-xs font-bold shrink-0">∞</div>
          <span className="text-xs text-amber-800 dark:text-amber-300 font-semibold">Luyện tập không giới hạn</span>
        </div>
      </div>
    </div>
  );
};
