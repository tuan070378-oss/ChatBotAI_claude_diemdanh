import React, { useState, useEffect, useRef, useCallback } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  CheckCircle2, 
  ChevronRight, 
  ChevronLeft, 
  Send, 
  AlertTriangle, 
  Loader2, 
  ShieldCheck, 
  ShieldAlert,
  User, 
  GraduationCap, 
  Hash, 
  Award,
  BookOpen,
  Clock,
  Maximize2,
  Lock,
  EyeOff,
  AlertOctagon
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
  count?: number;
  onExit?: () => void;
}

export const OfficialTest: React.FC<OfficialTestProps> = ({
  testId,
  mssv,
  className,
  studentName,
  subjectId,
  subjectName,
  count = 40,
  onExit
}) => {
  const [questions, setQuestions] = useState<SafeQuestion[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [userAnswers, setUserAnswers] = useState<Record<string, string>>({});
  const [isLoadingQuestions, setIsLoadingQuestions] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  // Anti-Cheat & Exam Flow States
  const [hasStarted, setHasStarted] = useState(false);
  const [violationCount, setViolationCount] = useState(0);
  const [isBlurred, setIsBlurred] = useState(false);
  const [violationWarning, setViolationWarning] = useState<{
    show: boolean;
    count: number;
    reason: string;
    isExceeded: boolean;
  } | null>(null);
  const [isFullscreen, setIsFullscreen] = useState(false);

  // Timer: count minutes (mặc định 40 câu = 40 phút, 60 câu = 60 phút)
  const initialSeconds = count * 60;
  const [timeLeft, setTimeLeft] = useState(initialSeconds);

  // Submission states
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isAutoSubmitted, setIsAutoSubmitted] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [showConfirmModal, setShowConfirmModal] = useState(false);
  const [result, setResult] = useState<{
    score: number;
    correctCount?: number;
    totalQuestions?: number;
    violationCount?: number;
    isAutoSubmitted?: boolean;
    message: string;
  } | null>(null);

  // Refs for race-condition prevention & event listeners
  const submissionInProgress = useRef(false);
  const lastViolationTimeRef = useRef(0);
  const resultRef = useRef<any>(null);
  const hasStartedRef = useRef(false);
  const questionsRef = useRef<SafeQuestion[]>([]);
  const userAnswersRef = useRef<Record<string, string>>({});

  useEffect(() => {
    resultRef.current = result;
  }, [result]);

  useEffect(() => {
    hasStartedRef.current = hasStarted;
  }, [hasStarted]);

  useEffect(() => {
    questionsRef.current = questions;
  }, [questions]);

  useEffect(() => {
    userAnswersRef.current = userAnswers;
  }, [userAnswers]);

  // Request & Exit Fullscreen helpers
  const requestFullScreen = async () => {
    try {
      const elem = document.documentElement as any;
      if (elem.requestFullscreen) {
        await elem.requestFullscreen();
      } else if (elem.webkitRequestFullscreen) {
        await elem.webkitRequestFullscreen();
      } else if (elem.msRequestFullscreen) {
        await elem.msRequestFullscreen();
      }
      setIsFullscreen(true);
    } catch (err) {
      console.warn("[OfficialTest] Fullscreen request error:", err);
    }
  };

  const exitFullScreen = async () => {
    try {
      const doc = document as any;
      if (doc.fullscreenElement || doc.webkitFullscreenElement || doc.msFullscreenElement) {
        if (doc.exitFullscreen) {
          await doc.exitFullscreen();
        } else if (doc.webkitExitFullscreen) {
          await doc.webkitExitFullscreen();
        } else if (doc.msExitFullscreen) {
          await doc.msExitFullscreen();
        }
      }
      setIsFullscreen(false);
    } catch (err) {
      console.warn("[OfficialTest] Exit fullscreen error:", err);
    }
  };

  // Tải đề kiểm tra từ Firestore
  useEffect(() => {
    let isMounted = true;

    async function loadTestQuestions() {
      setIsLoadingQuestions(true);
      setLoadError(null);
      try {
        const response = await fetch(`/api/official-test-questions?subjectId=${encodeURIComponent(subjectId)}&count=${encodeURIComponent(count)}&testId=${encodeURIComponent(testId)}`);
        const data = await response.json().catch(() => ({}));
        if (!isMounted) return;

        if (!response.ok) {
          // Bản trang cũ bị cache → máy chủ báo thiếu testId: tự tải lại đúng 1 lần để lấy bản mới.
          if (data.code === 'MISSING_TEST_ID') {
            try {
              if (!sessionStorage.getItem('ot_reloaded')) {
                sessionStorage.setItem('ot_reloaded', '1');
                window.location.reload();
                return;
              }
            } catch (_) { /* sessionStorage có thể bị chặn */ }
          }
          throw new Error(data.error || `Không thể tải đề thi (mã lỗi ${response.status}).`);
        }

        const rawBank: SafeQuestion[] = Array.isArray(data.questions) ? data.questions : [];

        if (!rawBank || rawBank.length === 0) {
          throw new Error(`Chưa có câu hỏi nào trong ngân hàng đề của môn ${subjectName || subjectId}. Vui lòng liên hệ giảng viên.`);
        }

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
  }, [subjectId, subjectName, count, testId]);

  // Core Submit Test function (dùng chung cho nộp thủ công và tự động do vi phạm)
  const handleSubmitTestInternal = useCallback(async (isAuto = false, finalViolationCount?: number) => {
    if (submissionInProgress.current) return;
    submissionInProgress.current = true;
    setIsSubmitting(true);
    setSubmitError(null);
    setShowConfirmModal(false);

    if (isAuto) {
      setIsAutoSubmitted(true);
    }

    const currentQList = questionsRef.current;
    const currentAns = userAnswersRef.current;
    const answersPayload = currentQList.map(q => ({
      questionId: q.id,
      selectedAnswer: currentAns[q.id] || ''
    }));

    const finalViolations = typeof finalViolationCount === 'number' ? finalViolationCount : violationCount;

    try {
      const response = await fetch('/api/submit-official-test', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          testId,
          mssv,
          className,
          subjectId,
          answers: answersPayload,
          violationCount: finalViolations,
          isAutoSubmitted: isAuto
        })
      });

      let resData: any = {};
      try {
        resData = await response.json();
      } catch {
        throw new Error('Máy chủ phản hồi không đúng định dạng JSON.');
      }

      if (!response.ok) {
        throw new Error(resData.error || 'Nộp bài thất bại. Vui lòng thử lại hoặc thông báo giảng viên.');
      }

      // Nộp thành công: Thoát chế độ toàn màn hình và hiển thị kết quả
      await exitFullScreen();

      setResult({
        score: resData.score,
        correctCount: resData.correctCount,
        totalQuestions: resData.totalQuestions,
        violationCount: finalViolations,
        isAutoSubmitted: isAuto,
        message: resData.message || 'Bài làm đã được chấm và ghi nhận thành công vào Điểm danh Auto!'
      });
      setIsBlurred(false);
      setViolationWarning(null);
    } catch (err: any) {
      console.error("[OfficialTest] Lỗi khi nộp bài:", err);
      setSubmitError(err.message || 'Lỗi kết nối khi nộp bài thi.');
    } finally {
      submissionInProgress.current = false;
      setIsSubmitting(false);
    }
  }, [testId, mssv, className, subjectId, violationCount]);

  // Hàm kích hoạt cảnh báo vi phạm
  const triggerViolation = useCallback((reason: string) => {
    if (!hasStartedRef.current || resultRef.current || submissionInProgress.current) {
      return;
    }

    const now = Date.now();
    // Cooldown 2.5 giây để tránh việc Alt-Tab đồng thời kích hoạt visibilitychange, blur và fullscreenchange thành 3 lần
    if (now - lastViolationTimeRef.current < 2500) {
      setIsBlurred(true);
      return;
    }
    lastViolationTimeRef.current = now;
    setIsBlurred(true);

    setViolationCount(prev => {
      const nextCount = prev + 1;
      if (nextCount >= 3) {
        // Vi phạm 3 lần: Khóa giao diện và tự động nộp bài ngay lập tức!
        setViolationWarning({
          show: true,
          count: 3,
          reason,
          isExceeded: true
        });
        setTimeout(() => {
          handleSubmitTestInternal(true, 3);
        }, 800);
      } else {
        setViolationWarning({
          show: true,
          count: nextCount,
          reason,
          isExceeded: false
        });
      }
      return nextCount;
    });
  }, [handleSubmitTestInternal]);

  // Countdown Timer
  useEffect(() => {
    if (!hasStarted || result || isSubmitting) return;

    const timer = setInterval(() => {
      setTimeLeft(prev => {
        if (prev <= 1) {
          clearInterval(timer);
          // Hết giờ làm bài: tự động thu bài
          handleSubmitTestInternal(true);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(timer);
  }, [hasStarted, result, isSubmitting, handleSubmitTestInternal]);

  // Anti-Cheat Event Listeners (Bôi đen, Chuột phải, DevTools, Chuyển tab, Thoát Fullscreen)
  useEffect(() => {
    if (!hasStarted || result) return;

    // 1. Chặn chuột phải
    const handleContextMenu = (e: MouseEvent) => {
      e.preventDefault();
      return false;
    };

    // 2. Chặn bôi đen chọn văn bản
    const handleSelectStart = (e: Event) => {
      e.preventDefault();
      return false;
    };

    // 3. Chặn Copy, Cut, Paste
    const handleCopyCutPaste = (e: ClipboardEvent) => {
      e.preventDefault();
      return false;
    };

    // 4. Chặn phím tắt (F12, DevTools, View Source, Print, Ctrl+C/V/X/A/P)
    const handleKeyDown = (e: KeyboardEvent) => {
      const isCtrlOrMeta = e.ctrlKey || e.metaKey;
      
      // F12
      if (e.key === 'F12') {
        e.preventDefault();
        e.stopPropagation();
        return false;
      }
      // Ctrl+Shift+I / J / C (DevTools)
      if (isCtrlOrMeta && e.shiftKey && ['I', 'i', 'J', 'j', 'C', 'c'].includes(e.key)) {
        e.preventDefault();
        e.stopPropagation();
        return false;
      }
      // Ctrl+U (View source)
      if (isCtrlOrMeta && (e.key === 'u' || e.key === 'U')) {
        e.preventDefault();
        e.stopPropagation();
        return false;
      }
      // Ctrl+C, Ctrl+V, Ctrl+X, Ctrl+A, Ctrl+P (In đề)
      if (isCtrlOrMeta && ['c', 'C', 'v', 'V', 'x', 'X', 'a', 'A', 'p', 'P'].includes(e.key)) {
        e.preventDefault();
        e.stopPropagation();
        return false;
      }
    };

    // 5. Visibility API: Chuyển tab hoặc thu nhỏ trình duyệt
    const handleVisibilityChange = () => {
      if (document.hidden) {
        triggerViolation("Chuyển tab trình duyệt hoặc thu nhỏ cửa sổ");
      }
    };

    // 6. Blur / Focus: Mất tiêu điểm (mở Zalo, Messenger, Snipping Tool, ChatGPT, bấm PrintScreen)
    const handleWindowBlur = () => {
      triggerViolation("Rời khỏi màn hình làm bài hoặc mở ứng dụng khác");
    };

    // 7. Fullscreen Change: Thoát toàn màn hình
    const handleFullscreenChange = () => {
      const doc = document as any;
      const isFs = !!(doc.fullscreenElement || doc.webkitFullscreenElement || doc.msFullscreenElement);
      setIsFullscreen(isFs);
      if (!isFs && hasStartedRef.current && !resultRef.current && !submissionInProgress.current) {
        triggerViolation("Thoát khỏi chế độ toàn màn hình bắt buộc");
      }
    };

    // Đăng ký toàn bộ sự kiện
    window.addEventListener('contextmenu', handleContextMenu);
    window.addEventListener('selectstart', handleSelectStart);
    window.addEventListener('copy', handleCopyCutPaste);
    window.addEventListener('cut', handleCopyCutPaste);
    window.addEventListener('paste', handleCopyCutPaste);
    window.addEventListener('keydown', handleKeyDown, true);
    document.addEventListener('visibilitychange', handleVisibilityChange);
    window.addEventListener('blur', handleWindowBlur);
    document.addEventListener('fullscreenchange', handleFullscreenChange);
    document.addEventListener('webkitfullscreenchange', handleFullscreenChange);

    // Dọn dẹp sự kiện sạch sẽ khi unmount
    return () => {
      window.removeEventListener('contextmenu', handleContextMenu);
      window.removeEventListener('selectstart', handleSelectStart);
      window.removeEventListener('copy', handleCopyCutPaste);
      window.removeEventListener('cut', handleCopyCutPaste);
      window.removeEventListener('paste', handleCopyCutPaste);
      window.removeEventListener('keydown', handleKeyDown, true);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      window.removeEventListener('blur', handleWindowBlur);
      document.removeEventListener('fullscreenchange', handleFullscreenChange);
      document.removeEventListener('webkitfullscreenchange', handleFullscreenChange);
    };
  }, [hasStarted, result, triggerViolation]);

  // Bắt đầu làm bài thi
  const handleStartExam = async () => {
    await requestFullScreen();
    setHasStarted(true);
    setViolationCount(0);
    setIsBlurred(false);
    setViolationWarning(null);
  };

  // Nút sinh viên xác nhận đã hiểu cảnh báo vi phạm và quay lại thi
  const handleAcknowledgeWarning = async () => {
    setViolationWarning(null);
    setIsBlurred(false);
    await requestFullScreen();
  };

  const currentQuestion = questions[currentIndex];
  const totalQuestions = questions.length;
  const answeredCount = Object.keys(userAnswers).filter(k => userAnswers[k] && userAnswers[k].trim() !== '').length;
  const progress = totalQuestions > 0 ? ((currentIndex + 1) / totalQuestions) * 100 : 0;

  // Format time (MM:SS)
  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  const handleSelectOption = (opt: string) => {
    if (result || isSubmitting || !currentQuestion || isBlurred) return;
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

  // 1. Loading State
  if (isLoadingQuestions) {
    return (
      <div className="max-w-2xl mx-auto mt-12 p-8 text-center bg-white/90 dark:bg-gray-900/90 backdrop-blur-md rounded-3xl border border-gray-200 dark:border-gray-800 shadow-xl space-y-4 animate-in fade-in duration-500">
        <div className="w-16 h-16 mx-auto bg-orange-50 dark:bg-navy-panel rounded-2xl flex items-center justify-center text-fire-1 dark:text-fire-2">
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

  // 3. MÀN HÌNH CHUẨN BỊ & QUY CHẾ THI CHỐNG GIAN LẬN (Trước khi bấm Bắt đầu)
  if (!hasStarted) {
    return (
      <div className="max-w-2xl mx-auto my-6 sm:my-10 p-6 sm:p-8 bg-white/95 dark:bg-gray-900/95 backdrop-blur-xl rounded-3xl border border-red-200 dark:border-red-900/50 shadow-2xl space-y-6 animate-in zoom-in-95 duration-500 select-none">
        {/* Banner Header */}
        <div className="text-center space-y-3 pb-2 border-b border-gray-100 dark:border-gray-800">
          <div className="w-16 h-16 mx-auto bg-red-100 dark:bg-red-950/70 rounded-2xl flex items-center justify-center text-red-600 dark:text-red-400 shadow-sm">
            <Lock size={32} />
          </div>
          <div className="space-y-1">
            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[11px] font-black uppercase tracking-wider bg-red-600 text-white shadow-xs">
              <ShieldAlert size={14} /> Hệ thống giám sát thi cử trực tuyến
            </span>
            <h2 className="text-2xl sm:text-3xl font-black text-gray-900 dark:text-white tracking-tight">
              Quy Chế Bài Thi Chính Thức
            </h2>
            <p className="text-xs text-gray-500 dark:text-gray-400">
              Môn thi: <strong className="text-gray-800 dark:text-gray-200">{subjectName || subjectId}</strong> (Mã đề: <span className="font-mono">{testId}</span>)
            </p>
          </div>
        </div>

        {/* Thông tin thí sinh */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 p-3.5 bg-gray-50 dark:bg-gray-800/60 rounded-2xl border border-gray-100 dark:border-gray-800 text-xs">
          <div>
            <span className="text-[10px] uppercase font-bold text-gray-400 tracking-wider block">Thí sinh:</span>
            <span className="font-bold text-gray-900 dark:text-white truncate block">{studentName || 'Sinh viên'}</span>
          </div>
          <div>
            <span className="text-[10px] uppercase font-bold text-gray-400 tracking-wider block">MSSV:</span>
            <span className="font-bold font-mono text-gray-900 dark:text-white block">{mssv}</span>
          </div>
          <div>
            <span className="text-[10px] uppercase font-bold text-gray-400 tracking-wider block">Lớp:</span>
            <span className="font-bold text-gray-900 dark:text-white block">{className}</span>
          </div>
          <div>
            <span className="text-[10px] uppercase font-bold text-gray-400 tracking-wider block">Thời gian:</span>
            <span className="font-bold text-red-600 dark:text-red-400 block">{count} phút ({count} câu)</span>
          </div>
        </div>

        {/* Danh sách 4 quy định chống gian lận nghiêm ngặt */}
        <div className="space-y-3">
          <h4 className="text-xs font-black uppercase tracking-wider text-red-600 dark:text-red-400 flex items-center gap-1.5">
            <AlertOctagon size={16} /> 4 Quy định bắt buộc trong suốt quá trình làm bài:
          </h4>
          <div className="space-y-2.5 text-xs text-gray-700 dark:text-gray-300">
            <div className="p-3 bg-red-50/60 dark:bg-red-950/20 border border-red-100 dark:border-red-900/30 rounded-xl flex items-start gap-3">
              <span className="w-5 h-5 rounded-full bg-red-600 text-white font-black text-[11px] flex items-center justify-center shrink-0 mt-0.5">1</span>
              <div>
                <strong>Chế độ Toàn màn hình bắt buộc:</strong> Khi bấm bắt đầu, trình duyệt sẽ phóng to toàn màn hình. Nghiêm cấm thoát toàn màn hình (phím ESC) trong lúc thi.
              </div>
            </div>

            <div className="p-3 bg-red-50/60 dark:bg-red-950/20 border border-red-100 dark:border-red-900/30 rounded-xl flex items-start gap-3">
              <span className="w-5 h-5 rounded-full bg-red-600 text-white font-black text-[11px] flex items-center justify-center shrink-0 mt-0.5">2</span>
              <div>
                <strong>Nghiêm cấm chuyển Tab / Mở App:</strong> Không được mở tab mới, thu nhỏ trình duyệt, hoặc chuyển sang ứng dụng khác (Zalo, Discord, Snipping Tool, ChatGPT...).
              </div>
            </div>

            <div className="p-3 bg-red-50/60 dark:bg-red-950/20 border border-red-100 dark:border-red-900/30 rounded-xl flex items-start gap-3">
              <span className="w-5 h-5 rounded-full bg-red-600 text-white font-black text-[11px] flex items-center justify-center shrink-0 mt-0.5">3</span>
              <div>
                <strong>Khóa sao chép & công cụ kỹ thuật:</strong> Chuột phải, bôi đen văn bản, phím F12, DevTools, Copy/Paste đều bị khóa hoàn toàn.
              </div>
            </div>

            <div className="p-3 bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-900/40 rounded-xl flex items-start gap-3 text-amber-900 dark:text-amber-200">
              <span className="w-5 h-5 rounded-full bg-amber-600 text-white font-black text-[11px] flex items-center justify-center shrink-0 mt-0.5">4</span>
              <div>
                <strong>Tự động thu bài khi vi phạm 3 lần:</strong> Mọi hành vi rời màn hình đều được ghi nhận (lần 1 và 2 cảnh báo đỏ). <strong>Vi phạm đến lần thứ 3 sẽ bị TỰ ĐỘNG THU BÀI</strong> và gửi điểm số hiện tại về máy chủ!
              </div>
            </div>
          </div>
        </div>

        {/* Nút hành động */}
        <div className="pt-2 flex flex-col sm:flex-row items-center gap-3">
          {onExit && (
            <button
              onClick={onExit}
              className="w-full sm:w-auto px-5 py-3 rounded-2xl border border-gray-200 dark:border-gray-700 text-xs font-bold text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800 transition-all cursor-pointer"
            >
              Rút lui & Thoát
            </button>
          )}
          <button
            onClick={handleStartExam}
            className="flex-1 w-full py-3.5 px-6 bg-red-600 hover:bg-red-700 active:scale-98 text-white rounded-2xl text-xs sm:text-sm font-black flex items-center justify-center gap-2 shadow-lg shadow-red-600/30 transition-all cursor-pointer"
          >
            <Maximize2 size={18} />
            BẬT TOÀN MÀN HÌNH & BẮT ĐẦU LÀM BÀI
          </button>
        </div>
      </div>
    );
  }

  // 4. Result Screen (Nộp bài thành công)
  if (result) {
    return (
      <div className="max-w-2xl mx-auto mt-6 sm:mt-12 p-6 sm:p-8 bg-white/95 dark:bg-gray-900/95 backdrop-blur-xl rounded-3xl border border-emerald-200 dark:border-emerald-800/60 shadow-2xl space-y-6 animate-in zoom-in-95 duration-500 text-center select-none">
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

        {/* Huy hiệu kết quả giám sát chống gian lận */}
        <div className="max-w-md mx-auto">
          {result.violationCount && result.violationCount > 0 ? (
            <div className="p-3 bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-900/50 rounded-2xl flex items-center justify-center gap-2 text-xs font-bold text-amber-800 dark:text-amber-300">
              <AlertTriangle size={16} className="text-amber-600 shrink-0" />
              <span>
                Biên bản ghi nhận vi phạm: <strong>{result.violationCount}/3 lần</strong>
                {result.isAutoSubmitted ? ' (Bài thi tự động thu do vi phạm)' : ''}
              </span>
            </div>
          ) : (
            <div className="p-3 bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-900/50 rounded-2xl flex items-center justify-center gap-2 text-xs font-bold text-emerald-800 dark:text-emerald-300">
              <ShieldCheck size={16} className="text-emerald-600 shrink-0" />
              <span>Tính trung thực 100% — Không có vi phạm quy chế thi</span>
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
            Điểm và biên bản làm bài đã được tự động lưu vào Sổ tay điểm danh của giảng viên. Em có thể đóng tab trình duyệt này an toàn.
          </p>
        </div>
      </div>
    );
  }

  // 5. Active Testing Interface
  return (
    <div className="max-w-3xl mx-auto space-y-4 sm:space-y-6 animate-in fade-in zoom-in-95 duration-500 pb-12 select-none relative" style={{ WebkitUserSelect: 'none', userSelect: 'none' }}>
      {/* Official Header Banner */}
      <div className="bg-white/95 dark:bg-gray-900/90 backdrop-blur-xl border border-red-200 dark:border-red-900/40 rounded-3xl p-4 sm:p-5 shadow-sm space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-gray-100 dark:border-gray-800 pb-3">
          <div className="flex items-center gap-2.5">
            <span className="px-2.5 py-1 rounded-full text-[10px] font-black uppercase tracking-wider bg-red-600 text-white shadow-xs animate-pulse">
              Bài kiểm tra chính thức
            </span>
            <span className="text-xs font-bold text-gray-700 dark:text-gray-300 flex items-center gap-1.5">
              <BookOpen size={14} className="text-red-500" />
              {subjectName || subjectId}
            </span>
          </div>

          <div className="flex items-center gap-3">
            {/* Đồng hồ đếm ngược */}
            <div className={cn(
              "flex items-center gap-1.5 px-3 py-1 rounded-xl font-mono text-xs font-black tracking-wider transition-colors",
              timeLeft <= 300 
                ? "bg-red-100 text-red-600 dark:bg-red-950/80 dark:text-red-400 animate-pulse border border-red-300"
                : "bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-200 border border-gray-200 dark:border-gray-700"
            )}>
              <Clock size={14} />
              <span>{formatTime(timeLeft)}</span>
            </div>

            {/* Trạng thái Fullscreen & Vi phạm */}
            <div className={cn(
              "flex items-center gap-1 px-2.5 py-1 rounded-xl text-[11px] font-bold font-mono",
              violationCount === 0 
                ? "bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-400"
                : violationCount === 1
                  ? "bg-amber-100 text-amber-800 dark:bg-amber-950/60 dark:text-amber-300"
                  : "bg-red-100 text-red-800 dark:bg-red-950/60 dark:text-red-300 animate-pulse"
            )}>
              <ShieldAlert size={13} />
              <span>Vi phạm: {violationCount}/3</span>
            </div>
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
          <div className="font-bold text-xs text-fire-1 dark:text-fire-2">
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
                      ? "bg-orange-100 text-fire-1 dark:bg-navy-panel dark:text-fire-2"
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

      {/* Main Question Card with Visual Blur Effect when out of focus */}
      <div className={cn(
        "bg-white dark:bg-gray-900 rounded-3xl shadow-md border border-gray-200 dark:border-gray-800 p-5 sm:p-8 min-h-[360px] flex flex-col relative overflow-hidden transition-all duration-300",
        isBlurred && "filter blur-md pointer-events-none select-none"
      )}>
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
                      disabled={isSubmitting || isBlurred}
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
              disabled={currentIndex === 0 || isSubmitting || isBlurred}
              className="px-4 py-2.5 rounded-xl border border-gray-200 dark:border-gray-700 text-xs sm:text-sm font-bold text-gray-600 dark:text-gray-300 hover:text-red-600 hover:border-red-500 disabled:opacity-30 disabled:pointer-events-none transition-all flex items-center gap-1.5 cursor-pointer"
            >
              <ChevronLeft size={16} />
              Câu trước
            </button>
            <button
              onClick={handleNext}
              disabled={currentIndex === totalQuestions - 1 || isSubmitting || isBlurred}
              className="px-4 py-2.5 rounded-xl border border-gray-200 dark:border-gray-700 text-xs sm:text-sm font-bold text-gray-600 dark:text-gray-300 hover:text-red-600 hover:border-red-500 disabled:opacity-30 disabled:pointer-events-none transition-all flex items-center gap-1.5 cursor-pointer"
            >
              Câu kế tiếp
              <ChevronRight size={16} />
            </button>
          </div>

          <button
            onClick={() => setShowConfirmModal(true)}
            disabled={isSubmitting || answeredCount === 0 || isBlurred}
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
                Sau khi nộp, điểm số và biên bản giám sát sẽ được máy chủ chấm tự động và gửi trực tiếp vào hệ thống Điểm danh Auto.
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
                onClick={() => handleSubmitTestInternal(false)}
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

      {/* CẢNH BÁO VI PHẠM GIAN LẬN / CHUYỂN TAB MODAL */}
      {violationWarning && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-md flex items-center justify-center p-4 animate-in fade-in duration-200">
          <div className="bg-white dark:bg-gray-900 rounded-3xl p-6 sm:p-8 max-w-lg w-full border-2 border-red-500 shadow-2xl space-y-5 text-center">
            <div className="w-16 h-16 mx-auto bg-red-100 dark:bg-red-950/80 text-red-600 dark:text-red-400 rounded-2xl flex items-center justify-center animate-bounce">
              <ShieldAlert size={36} />
            </div>

            <div className="space-y-2">
              <span className="inline-block px-3 py-1 rounded-full text-[11px] font-black uppercase tracking-wider bg-red-600 text-white">
                Cảnh báo vi phạm quy chế thi
              </span>
              <h3 className="text-xl sm:text-2xl font-black text-red-600 dark:text-red-400">
                {violationWarning.isExceeded 
                  ? "BẠN ĐÃ VI PHẠM QUÁ 3 LẦN!" 
                  : `VI PHẠM QUY CHẾ THI (${violationWarning.count}/3)`}
              </h3>
              <p className="text-xs sm:text-sm text-gray-700 dark:text-gray-300 leading-relaxed font-medium">
                Hệ thống phát hiện hành vi: <strong className="text-red-600 dark:text-red-400">"{violationWarning.reason}"</strong>.
              </p>
            </div>

            {violationWarning.isExceeded ? (
              <div className="p-4 bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-900/50 rounded-2xl text-xs text-red-700 dark:text-red-300 space-y-2">
                <p className="font-bold">
                  Quy chế thi trực tuyến: Thí sinh vi phạm quá 3 lần bị truất quyền tiếp tục làm bài.
                </p>
                <div className="flex items-center justify-center gap-2 text-xs font-semibold">
                  <Loader2 size={16} className="animate-spin text-red-600" />
                  Hệ thống đang tự động thu bài và gửi điểm về Điểm danh Auto...
                </div>
              </div>
            ) : (
              <div className="p-4 bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-900/50 rounded-2xl text-xs text-amber-800 dark:text-amber-200 text-left space-y-1.5">
                <p className="font-bold">⚠️ CẢNH BÁO QUAN TRỌNG:</p>
                <ul className="list-disc list-inside space-y-1 text-[11px]">
                  <li>Không được chuyển tab, thu nhỏ cửa sổ hoặc mở ứng dụng khác.</li>
                  <li>Không được thoát chế độ toàn màn hình.</li>
                  <li>Nếu vi phạm tiếp đến <strong>lần thứ 3</strong>, hệ thống sẽ <strong>TỰ ĐỘNG THU BÀI</strong> ngay lập tức!</li>
                </ul>
              </div>
            )}

            {!violationWarning.isExceeded && (
              <button
                onClick={handleAcknowledgeWarning}
                className="w-full py-3.5 px-6 bg-red-600 hover:bg-red-700 text-white rounded-2xl text-xs sm:text-sm font-extrabold flex items-center justify-center gap-2 shadow-lg shadow-red-600/30 transition-all cursor-pointer"
              >
                <Maximize2 size={16} />
                Tôi đã hiểu & Quay lại toàn màn hình làm bài
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
};