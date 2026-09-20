import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  CheckCircle2, 
  ChevronRight, 
  ChevronLeft, 
  Send, 
  AlertTriangle, 
  Loader2, 
  ShieldCheck, 
  User, 
  GraduationCap, 
  Hash, 
  Award,
  RefreshCw,
  BookOpen
} from 'lucide-react';
import { cn, cleanMathText } from '../../lib/utils';

// Client-safe Question representation (guarantees correctAnswer NEVER touches client memory)
interface SafeQuestion {
  id: string;
  question: string;
  options: string[];
  difficulty?: string;
}

interface OfficialTestProps {
  testId: string;
  mssv: string;
  className: string;
  studentName?: string;
  subjectId: string;
  subjectName?: string;
  onExit?: () => void;
}

export const OfficialTest: React.FC<OfficialTestProps> = ({
  testId,
  mssv,
  className,
  studentName,
  subjectId,
  subjectName,
  onExit
}) => {
  const [questions, setQuestions] = useState<SafeQuestion[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [userAnswers, setUserAnswers] = useState<Record<string, string>>({});
  const [isLoadingQuestions, setIsLoadingQuestions] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  // Submission states
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [showConfirmModal, setShowConfirmModal] = useState(false);
  const [result, setResult] = useState<{
    score: number;
    correctCount?: number;
    totalQuestions?: number;
    message: string;
  } | null>(null);

  // Tải đề kiểm tra từ Firestore qua fetchQuestionBank, triệt tiêu correctAnswer hoàn toàn
  useEffect(() => {
    let isMounted = true;

    async function loadTestQuestions() {
      setIsLoadingQuestions(true);
      setLoadError(null);
      try {
        const response = await fetch(`/api/official-test-questions?subjectId=${encodeURIComponent(subjectId)}`);
        const data = await response.json().catch(() => ({}));
        if (!isMounted) return;

        if (!response.ok) {
          throw new Error(data.error || `Không thể tải đề thi (mã lỗi ${response.status}).`);
        }

        const rawBank: SafeQuestion[] = Array.isArray(data.questions) ? data.questions : [];

        if (!rawBank || rawBank.length === 0) {
          throw new Error(`Chưa có câu hỏi nào trong ngân hàng đề của môn ${subjectName || subjectId}. Vui lòng liên hệ giảng viên.`);
        }

        // Server đã lọc sẵn — chỉ còn id, question, options, difficulty. Không cần lọc thêm ở đây,
        // nhưng vẫn giữ bước map tường minh để không vô tình lưu field lạ nào vào state.
        const sanitizedList: SafeQuestion[] = rawBank.map((q) => ({
          id: q.id,
          question: q.question,
          options: Array.isArray(q.options) ? q.options : [],
          difficulty: q.difficulty,
        }));

        setQuestions(sanitizedList);
      } catch (err: any) {
        if (!isMounted) return;
        console.error("[OfficialTest] Không thể tải đề thi:", err);
        setLoadError(err.message || 'Không thể tải đề thi từ hệ thống.');
      } finally {
        if (isMounted) {
          setIsLoadingQuestions(false);
        }
      }
    }

    loadTestQuestions();

    return () => {
      isMounted = false;
    };
  }, [subjectId, subjectName]);

  const currentQuestion = questions[currentIndex];
  const totalQuestions = questions.length;
  const answeredCount = Object.keys(userAnswers).filter(k => userAnswers[k] && userAnswers[k].trim() !== '').length;
  const progress = totalQuestions > 0 ? ((currentIndex + 1) / totalQuestions) * 100 : 0;

  const handleSelectOption = (opt: string) => {
    if (result || isSubmitting || !currentQuestion) return;
    setUserAnswers(prev => ({
      ...prev,
      [currentQuestion.id]: opt
    }));
  };

  const handleNext = () => {
    if (currentIndex < totalQuestions - 1) {
      setCurrentIndex(prev => prev + 1);
    }
  };

  const handlePrev = () => {
    if (currentIndex > 0) {
      setCurrentIndex(prev => prev - 1);
    }
  };

  const handleSubmitTest = async () => {
    setShowConfirmModal(false);
    setIsSubmitting(true);
    setSubmitError(null);

    // Chuyển đổi format answers: [{ questionId, selectedAnswer }]
    const answersPayload = questions.map(q => ({
      questionId: q.id,
      selectedAnswer: userAnswers[q.id] || ''
    }));

    try {
      const response = await fetch('/api/submit-official-test', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          testId,
          mssv,
          className,
          subjectId,
          answers: answersPayload
        })
      });

      let resData: any = {};
      try {
        resData = await response.json();
      } catch (jsonErr) {
        throw new Error('Máy chủ phản hồi không đúng định dạng JSON.');
      }

      if (!response.ok) {
        throw new Error(resData.error || 'Nộp bài thất bại. Vui lòng thử lại hoặc thông báo giảng viên.');
      }

      setResult({
        score: resData.score,
        correctCount: resData.correctCount,
        totalQuestions: resData.totalQuestions,
        message: resData.message || 'Bài làm đã được chấm và ghi nhận thành công vào Điểm danh Auto!'
      });
    } catch (err: any) {
      console.error("[OfficialTest] Lỗi khi nộp bài:", err);
      setSubmitError(err.message || 'Lỗi kết nối khi nộp bài thi.');
    } finally {
      setIsSubmitting(false);
    }
  };

  // 1. Loading State
  if (isLoadingQuestions) {
    return (
      <div className="max-w-2xl mx-auto mt-12 p-8 text-center bg-white/90 dark:bg-gray-900/90 backdrop-blur-md rounded-3xl border border-gray-200 dark:border-gray-800 shadow-xl space-y-4 animate-in fade-in duration-500">
        <div className="w-16 h-16 mx-auto bg-cyan-50 dark:bg-cyan-950/50 rounded-2xl flex items-center justify-center text-cyan-600 dark:text-cyan-400">
          <Loader2 size={32} className="animate-spin" />
        </div>
        <h3 className="text-lg font-extrabold text-gray-900 dark:text-white">Đang niêm phong & chuẩn bị đề kiểm tra...</h3>
        <p className="text-xs text-gray-500 dark:text-gray-400 max-w-md mx-auto">
          Hệ thống đang tải ngân hàng câu hỏi chính thức cho môn {subjectName || subjectId} và khởi tạo phiên làm bài bảo mật.
        </p>
      </div>
    );
  }

  // 2. Load Error State
  if (loadError || questions.length === 0) {
    return (
      <div className="max-w-2xl mx-auto mt-12 p-8 text-center bg-white/90 dark:bg-gray-900/90 backdrop-blur-md rounded-3xl border border-red-200 dark:border-red-900/50 shadow-xl space-y-5 animate-in fade-in duration-500">
        <div className="w-16 h-16 mx-auto bg-red-50 dark:bg-red-950/50 rounded-2xl flex items-center justify-center text-red-600 dark:text-red-400">
          <AlertTriangle size={32} />
        </div>
        <div className="space-y-2">
          <h3 className="text-lg font-extrabold text-gray-900 dark:text-white">Không thể khởi tạo bài kiểm tra</h3>
          <p className="text-xs sm:text-sm text-red-600 dark:text-red-400 max-w-md mx-auto leading-relaxed">
            {loadError || 'Không tìm thấy câu hỏi kiểm tra nào phù hợp với môn học này.'}
          </p>
        </div>
        {onExit && (
          <button
            onClick={onExit}
            className="px-6 py-2.5 bg-gray-100 hover:bg-gray-200 dark:bg-gray-800 dark:hover:bg-gray-700 text-gray-800 dark:text-gray-200 rounded-xl text-xs font-bold transition-all cursor-pointer"
          >
            Quay lại trang chính
          </button>
        )}
      </div>
    );
  }

  // 3. Result Screen (Nộp bài thành công)
  if (result) {
    return (
      <div className="max-w-2xl mx-auto mt-6 sm:mt-12 p-6 sm:p-8 bg-white/95 dark:bg-gray-900/95 backdrop-blur-xl rounded-3xl border border-emerald-200 dark:border-emerald-800/60 shadow-2xl space-y-6 animate-in zoom-in-95 duration-500 text-center">
        <div className="w-20 h-20 mx-auto bg-emerald-100 dark:bg-emerald-950/60 rounded-3xl flex items-center justify-center text-emerald-600 dark:text-emerald-400 shadow-md">
          <Award size={44} />
        </div>

        <div className="space-y-2">
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[11px] font-extrabold uppercase tracking-wider bg-emerald-100 text-emerald-800 dark:bg-emerald-950/80 dark:text-emerald-300">
            <ShieldCheck size={14} /> Điểm số đã đồng bộ chính thức
          </span>
          <h2 className="text-2xl sm:text-3xl font-black text-gray-900 dark:text-white">
            Hoàn Thành Bài Kiểm Tra!
          </h2>
          <p className="text-xs sm:text-sm text-gray-600 dark:text-gray-400 max-w-lg mx-auto">
            {result.message}
          </p>
        </div>

        {/* Big Score Display */}
        <div className="py-6 px-8 bg-gradient-to-br from-emerald-500/10 to-teal-500/10 dark:from-emerald-950/40 dark:to-teal-950/40 border border-emerald-200/80 dark:border-emerald-800/50 rounded-3xl max-w-sm mx-auto shadow-inner">
          <div className="text-[11px] font-bold uppercase tracking-widest text-emerald-700 dark:text-emerald-400 mb-1">
            Điểm Đạt Được (Thang 10)
          </div>
          <div className="text-5xl sm:text-6xl font-black text-emerald-600 dark:text-emerald-400 tracking-tight font-mono">
            {result.score.toFixed(1)}
          </div>
          {result.correctCount !== undefined && result.totalQuestions !== undefined && (
            <div className="text-xs font-semibold text-emerald-700/80 dark:text-emerald-300/80 mt-2">
              Trả lời đúng {result.correctCount} / {result.totalQuestions} câu
            </div>
          )}
        </div>

        {/* Student & Test Metadata Card */}
        <div className="grid grid-cols-2 gap-3 text-left p-4 bg-gray-50 dark:bg-gray-800/60 rounded-2xl border border-gray-100 dark:border-gray-800 text-xs">
          <div>
            <span className="text-[10px] uppercase font-bold text-gray-400 tracking-wider block">Sinh viên:</span>
            <span className="font-bold text-gray-800 dark:text-gray-200">{studentName || 'Chưa định danh'}</span>
          </div>
          <div>
            <span className="text-[10px] uppercase font-bold text-gray-400 tracking-wider block">MSSV:</span>
            <span className="font-bold font-mono text-gray-800 dark:text-gray-200">{mssv}</span>
          </div>
          <div>
            <span className="text-[10px] uppercase font-bold text-gray-400 tracking-wider block">Lớp:</span>
            <span className="font-bold text-gray-800 dark:text-gray-200">{className}</span>
          </div>
          <div>
            <span className="text-[10px] uppercase font-bold text-gray-400 tracking-wider block">Mã bài kiểm tra:</span>
            <span className="font-bold font-mono text-gray-800 dark:text-gray-200 truncate block">{testId}</span>
          </div>
        </div>

        <div className="pt-2">
          <p className="text-[11px] text-gray-500 dark:text-gray-400 font-medium">
            Điểm đã được tự động lưu vào Sổ tay điểm danh của giảng viên. Em có thể đóng tab trình duyệt này an toàn.
          </p>
        </div>
      </div>
    );
  }

  // 4. Active Testing Interface
  return (
    <div className="max-w-3xl mx-auto space-y-4 sm:space-y-6 animate-in fade-in zoom-in-95 duration-500 pb-12">
      {/* Official Header Banner */}
      <div className="bg-white/95 dark:bg-gray-900/90 backdrop-blur-xl border border-red-200 dark:border-red-900/40 rounded-3xl p-4 sm:p-5 shadow-sm space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-gray-100 dark:border-gray-800 pb-3">
          <div className="flex items-center gap-2.5">
            <span className="px-2.5 py-1 rounded-full text-[10px] font-black uppercase tracking-wider bg-red-500 text-white shadow-xs animate-pulse">
              Bài kiểm tra chính thức
            </span>
            <span className="text-xs font-bold text-gray-700 dark:text-gray-300 flex items-center gap-1.5">
              <BookOpen size={14} className="text-red-500" />
              {subjectName || subjectId}
            </span>
          </div>
          <div className="text-[11px] font-mono font-semibold text-gray-500 dark:text-gray-400">
            Mã đề: <span className="font-bold text-gray-800 dark:text-gray-200">{testId}</span>
          </div>
        </div>

        {/* Student Quick Bio */}
        <div className="flex flex-wrap items-center justify-between text-xs text-gray-600 dark:text-gray-400 gap-2">
          <div className="flex items-center gap-4">
            <span className="flex items-center gap-1 font-medium">
              <User size={14} className="text-gray-400" /> {studentName || 'Sinh viên'}
            </span>
            <span className="flex items-center gap-1 font-mono font-bold text-gray-800 dark:text-gray-200">
              <Hash size={14} className="text-gray-400" /> {mssv}
            </span>
            <span className="flex items-center gap-1 font-medium">
              <GraduationCap size={14} className="text-gray-400" /> {className}
            </span>
          </div>
          <div className="font-bold text-xs text-cyan-600 dark:text-cyan-400">
            Đã làm: {answeredCount} / {totalQuestions} câu
          </div>
        </div>
      </div>

      {/* Progress & Question Map Bar */}
      <div className="bg-white/90 dark:bg-gray-900/80 backdrop-blur-md border border-gray-200 dark:border-gray-800 rounded-2xl p-3.5 sm:p-4 space-y-3 shadow-xs">
        <div className="flex items-center gap-4">
          <div className="flex-1 h-2.5 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
            <motion.div 
              className="h-full bg-red-500 dark:bg-red-500 rounded-full shadow-xs" 
              initial={{ width: 0 }}
              animate={{ width: `${progress}%` }}
            />
          </div>
          <span className="text-xs font-extrabold text-red-600 dark:text-red-400 min-w-[65px] text-right font-mono">
            Câu {currentIndex + 1} / {totalQuestions}
          </span>
        </div>

        {/* Question Palette Pill Selector */}
        <div className="flex flex-wrap gap-1.5 pt-1">
          {questions.map((q, idx) => {
            const isAnswered = !!userAnswers[q.id];
            const isCurrent = idx === currentIndex;
            return (
              <button
                key={q.id}
                onClick={() => setCurrentIndex(idx)}
                className={cn(
                  "w-7 h-7 rounded-lg text-xs font-bold font-mono transition-all flex items-center justify-center cursor-pointer",
                  isCurrent 
                    ? "ring-2 ring-red-500 bg-red-500 text-white shadow-xs"
                    : isAnswered
                      ? "bg-cyan-100 text-cyan-800 dark:bg-cyan-950/60 dark:text-cyan-300"
                      : "bg-gray-100 dark:bg-gray-800 text-gray-500 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-gray-700"
                )}
                title={`Câu ${idx + 1}: ${isAnswered ? 'Đã chọn đáp án' : 'Chưa trả lời'}`}
              >
                {idx + 1}
              </button>
            );
          })}
        </div>
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
              <div className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0 shadow-xs bg-red-100 dark:bg-red-950/60 text-red-700 dark:text-red-400 font-black">
                {currentIndex + 1}
              </div>
              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  <span className="text-[10px] uppercase font-bold tracking-wider text-red-600 dark:text-red-400">
                    Câu hỏi trắc nghiệm
                  </span>
                  <span className="text-[10px] text-gray-400 font-mono">
                    (Mã: {currentQuestion.id})
                  </span>
                </div>
                <h3 className="text-base sm:text-lg font-bold text-gray-900 dark:text-white leading-relaxed">
                  {cleanMathText(currentQuestion.question)}
                </h3>
              </div>
            </div>

            {/* Answer Options */}
            <div className="space-y-3 pt-2">
              <div className="grid grid-cols-1 gap-2.5">
                {currentQuestion.options.map((opt, idx) => {
                  const isSelected = userAnswers[currentQuestion.id] === opt;
                  return (
                    <button
                      key={idx}
                      onClick={() => handleSelectOption(opt)}
                      disabled={isSubmitting}
                      className={cn(
                        "p-3.5 sm:p-4 rounded-2xl border text-left transition-all flex items-center gap-3 sm:gap-4 group cursor-pointer",
                        isSelected 
                          ? "border-red-500 bg-red-50 dark:bg-red-950/40 ring-2 ring-red-500/30 shadow-xs" 
                          : "border-gray-200 dark:border-gray-800 hover:border-red-400/60 hover:bg-gray-50 dark:hover:bg-gray-800/40"
                      )}
                    >
                      <div className={cn(
                        "w-7 h-7 rounded-full border flex items-center justify-center transition-all shrink-0 font-bold text-xs",
                        isSelected ? "bg-red-500 border-red-500 text-white" : "border-gray-300 dark:border-gray-600 text-gray-500"
                      )}>
                        {String.fromCharCode(65 + idx)}
                      </div>
                      <span className={cn(
                        "text-xs sm:text-sm font-medium",
                        isSelected ? "text-red-950 dark:text-red-100 font-bold" : "text-gray-800 dark:text-gray-200"
                      )}>
                        {cleanMathText(opt)}
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>
          </motion.div>
        </AnimatePresence>

        {/* Error Notification during submit */}
        {submitError && (
          <div className="mt-4 p-3 bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-900/50 rounded-xl text-xs text-red-700 dark:text-red-300 flex items-start gap-2 animate-shake">
            <AlertTriangle size={16} className="shrink-0 mt-0.5" />
            <div className="flex-1">
              <strong>Lỗi khi nộp bài:</strong> {submitError}
              <div className="mt-1 font-medium">Em có thể bấm nút "Nộp bài" lại để gửi lại điểm.</div>
            </div>
          </div>
        )}

        {/* Footer Actions */}
        <div className="mt-8 pt-5 border-t border-gray-100 dark:border-gray-800 flex flex-wrap justify-between items-center gap-3">
          <div className="flex items-center gap-2">
            <button
              onClick={handlePrev}
              disabled={currentIndex === 0 || isSubmitting}
              className="px-4 py-2.5 rounded-xl border border-gray-200 dark:border-gray-700 text-xs sm:text-sm font-bold text-gray-600 dark:text-gray-300 hover:text-red-600 hover:border-red-500 disabled:opacity-30 disabled:pointer-events-none transition-all flex items-center gap-1.5 cursor-pointer"
            >
              <ChevronLeft size={16} />
              Câu trước
            </button>
            <button
              onClick={handleNext}
              disabled={currentIndex === totalQuestions - 1 || isSubmitting}
              className="px-4 py-2.5 rounded-xl border border-gray-200 dark:border-gray-700 text-xs sm:text-sm font-bold text-gray-600 dark:text-gray-300 hover:text-red-600 hover:border-red-500 disabled:opacity-30 disabled:pointer-events-none transition-all flex items-center gap-1.5 cursor-pointer"
            >
              Câu kế tiếp
              <ChevronRight size={16} />
            </button>
          </div>

          <button
            onClick={() => setShowConfirmModal(true)}
            disabled={isSubmitting || answeredCount === 0}
            className="px-6 sm:px-8 py-2.5 sm:py-3 bg-red-600 hover:bg-red-700 active:scale-98 text-white rounded-2xl text-xs sm:text-sm font-extrabold flex items-center gap-2 shadow-md shadow-red-600/20 transition-all disabled:opacity-40 disabled:pointer-events-none cursor-pointer"
          >
            {isSubmitting ? (
              <>
                <Loader2 size={18} className="animate-spin" />
                Đang chấm & ghi điểm...
              </>
            ) : (
              <>
                <Send size={16} />
                Nộp bài thi ({answeredCount}/{totalQuestions})
              </>
            )}
          </button>
        </div>
      </div>

      {/* Confirmation Modal */}
      {showConfirmModal && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in duration-200">
          <div className="bg-white dark:bg-gray-900 rounded-3xl p-6 max-w-md w-full border border-gray-200 dark:border-gray-800 shadow-2xl space-y-4">
            <div className="w-12 h-12 rounded-2xl bg-amber-100 dark:bg-amber-950/60 text-amber-600 flex items-center justify-center">
              <AlertTriangle size={24} />
            </div>
            <div className="space-y-1">
              <h4 className="text-base font-bold text-gray-900 dark:text-white">Xác nhận nộp bài kiểm tra</h4>
              <p className="text-xs text-gray-600 dark:text-gray-400 leading-relaxed">
                {answeredCount < totalQuestions ? (
                  <span className="text-amber-600 dark:text-amber-400 font-semibold block mb-1">
                    ⚠️ Em mới trả lời {answeredCount}/{totalQuestions} câu hỏi. Các câu chưa làm sẽ không có điểm!
                  </span>
                ) : (
                  <span>Em đã hoàn thành đủ {totalQuestions}/{totalQuestions} câu hỏi.</span>
                )}
                Sau khi nộp, điểm số sẽ được máy chủ chấm tự động và gửi trực tiếp vào hệ thống Điểm danh Auto. Em sẽ không thể làm lại bài này.
              </p>
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <button
                onClick={() => setShowConfirmModal(false)}
                disabled={isSubmitting}
                className="px-4 py-2 text-xs font-bold text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-xl cursor-pointer"
              >
                Làm tiếp
              </button>
              <button
                onClick={handleSubmitTest}
                disabled={isSubmitting}
                className="px-5 py-2 text-xs font-bold bg-red-600 hover:bg-red-700 text-white rounded-xl flex items-center gap-1.5 cursor-pointer shadow-xs"
              >
                {isSubmitting ? <Loader2 size={14} className="animate-spin" /> : <CheckCircle2 size={14} />}
                Xác nhận nộp bài
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};