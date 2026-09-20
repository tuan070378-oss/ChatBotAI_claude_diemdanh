import React, { useState, useRef, useEffect } from 'react';
import { Ruler, PencilRuler, Zap, ShieldAlert, Layers, ChevronRight, MessageSquare } from 'lucide-react';
import { AnimatePresence } from 'motion/react';
import { sendMessageStream } from '../services/gemini';
import { ThemeBackground } from './ThemeBackground';
import { Message, Subject, StudentInfo } from '../types';

// Sub-components
import { ChatHeader } from './chat/ChatHeader';
import { ChatInput } from './chat/ChatInput';
import { MessageItem } from './chat/MessageItem';
import { SubjectCard } from './chat/SubjectCard';
import { QuizManager } from './quiz/QuizManager';
import { OfficialTest } from './quiz/OfficialTest';
import { AdminPanel } from './admin/AdminPanel';
import cyberHorseLogo from '../assets/images/cyber_fire_horse.webp';

declare global {
  interface Window {
    webkitSpeechRecognition: any;
  }
}

type AppMode = 'chat' | 'quiz' | 'select-mode' | 'official-test';

interface OfficialTestParams {
  testId: string;
  mssv: string;
  className: string;
  subjectId: string;
  studentName?: string;
}

const SUBJECTS: Subject[] = [
  { id: 'dung-sai', name: 'Dung sai & Đo lường', icon: Ruler, color: 'text-blue-500', bg: 'bg-blue-50 dark:bg-blue-900/20' },
  { id: 'co-ky-thuat', name: 'Cơ kỹ thuật', icon: Zap, color: 'text-orange-500', bg: 'bg-orange-50 dark:bg-orange-900/20' },
  { id: 've-ky-thuat', name: 'Vẽ kỹ thuật', icon: PencilRuler, color: 'text-green-500', bg: 'bg-green-50 dark:bg-green-900/20' },
  { id: 'vat-lieu', name: 'Vật liệu cơ khí', icon: Layers, color: 'text-purple-500', bg: 'bg-purple-50 dark:bg-purple-900/20' },
  { id: 'an-toan', name: 'An toàn lao động', icon: ShieldAlert, color: 'text-red-500', bg: 'bg-red-50 dark:bg-red-900/20' },
];

const STORAGE_KEYS = {
  MESSAGES: 'chat_messages',
  THEME: 'chat_theme',
  AUTO_SPEAK: 'chat_autoSpeak',
  STATS: 'ai_study_user_stats',
  STUDENT_INFO: 'chat_student_info'
};

export default function ChatInterface() {
  const [appMode, setAppMode] = useState<AppMode>('select-mode');
  const [messages, setMessages] = useState<Message[]>(() => {
    const saved = localStorage.getItem(STORAGE_KEYS.MESSAGES);
    const msgs = saved ? JSON.parse(saved) : [];
    return msgs;
  });

  const [stats, setStats] = useState<any>(() => {
    const saved = localStorage.getItem(STORAGE_KEYS.STATS);
    return saved ? JSON.parse(saved) : {};
  });

  const [studentInfo, setStudentInfo] = useState<StudentInfo>(() => {
    const saved = localStorage.getItem(STORAGE_KEYS.STUDENT_INFO);
    return saved ? JSON.parse(saved) : {};
  });

  // State in-memory cho luồng Kiểm tra chính thức (không lưu localStorage để tránh làm lại)
  const [officialTestParams, setOfficialTestParams] = useState<OfficialTestParams | null>(null);
  const [officialTestError, setOfficialTestError] = useState<string | null>(null);

  useEffect(() => {
    const handleStorageChange = () => {
        const saved = localStorage.getItem(STORAGE_KEYS.STATS);
        if (saved) setStats(JSON.parse(saved));
    };
    window.addEventListener('storage', handleStorageChange);
    return () => window.removeEventListener('storage', handleStorageChange);
  }, []);

  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isDarkMode, setIsDarkMode] = useState(() => {
    const saved = localStorage.getItem(STORAGE_KEYS.THEME);
    return saved ? JSON.parse(saved) : false;
  });
  const [isListening, setIsListening] = useState(false);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [autoSpeak, setAutoSpeak] = useState(() => {
    const saved = localStorage.getItem(STORAGE_KEYS.AUTO_SPEAK);
    return saved ? JSON.parse(saved) : false;
  });
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [isRagOpen, setIsRagOpen] = useState(false);

  const scrollRef = useRef<HTMLDivElement>(null);
  const recognitionRef = useRef<any>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const audioSourceRef = useRef<AudioBufferSourceNode | null>(null);

  // Persistence
  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEYS.MESSAGES, JSON.stringify(messages));
    } catch (e: any) {
      if (e.name === 'QuotaExceededError' || e.code === 22 || e.name === 'NS_ERROR_DOM_QUOTA_REACHED') {
        console.warn('LocalStorage quota exceeded. Thinning messages to save space...');
        try {
          // Giữ hình ảnh cho tin nhắn gần nhất, xóa hình ảnh nặng của các tin nhắn cũ hơn
          const optimizedMessages = messages.map((msg, index) => {
            if (index < messages.length - 1 && msg.images && msg.images.length > 0) {
              return { ...msg, images: [] }; // Strip bulky images from historical messages to save space
            }
            return msg;
          });
          localStorage.setItem(STORAGE_KEYS.MESSAGES, JSON.stringify(optimizedMessages));
        } catch (innerErr) {
          console.error('Vẫn vượt quá giới hạn bộ nhớ. Rút ngắn lịch sử tin nhắn...', innerErr);
          try {
            // Giữ lại 8 tin nhắn gần nhất và xóa hoàn toàn hình ảnh
            const prunedMessages = messages.slice(-8).map(msg => ({ ...msg, images: [] }));
            localStorage.setItem(STORAGE_KEYS.MESSAGES, JSON.stringify(prunedMessages));
          } catch (lastErr) {
            console.error('Tất cả các nỗ lực lưu tin nhắn vào localStorage đều thất bại:', lastErr);
          }
        }
      } else {
        console.error('Không thể lưu tin nhắn vào localStorage:', e);
      }
    }
  }, [messages]);

  useEffect(() => {
    localStorage.setItem(STORAGE_KEYS.THEME, JSON.stringify(isDarkMode));
    if (isDarkMode) {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
  }, [isDarkMode]);

  useEffect(() => {
    localStorage.setItem(STORAGE_KEYS.AUTO_SPEAK, JSON.stringify(autoSpeak));
  }, [autoSpeak]);

  const stopSpeaking = async () => {
    if (audioSourceRef.current) {
      try {
        audioSourceRef.current.stop();
      } catch (e) {}
      audioSourceRef.current = null;
    }
    if (audioContextRef.current) {
      try {
        await audioContextRef.current.close();
      } catch (e) {}
      audioContextRef.current = null;
    }
    if (window.speechSynthesis) {
      window.speechSynthesis.cancel();
    }
    setIsSpeaking(false);
  };

  const speakText = async (text: string) => {
    if (!text) return;
    
    // Stop any existing audio before starting new one (Memory Leak Fix)
    await stopSpeaking();
    
    setIsSpeaking(true);

    const cleanedText = text
      .replace(/[#*`_~]/g, '') 
      .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1')
      .replace(/(\r\n|\n|\r)/gm, " ")
      .replace(/\s+/g, ' ')
      .trim()
      .slice(0, 1500);

    try {
      const response = await fetch('/api/tts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text: cleanedText })
      });

      if (!response.ok) {
        let errMsg = 'Máy chủ phát âm giọng nói gặp lỗi kỹ thuật.';
        try {
          const errData = await response.json();
          errMsg = errData.error || errMsg;
        } catch (_) {}
        throw new Error(errMsg);
      }
      
      let base64Audio = '';
      try {
        const result = await response.json();
        base64Audio = result.audio;
      } catch (e) {
        throw new Error('Dữ liệu phát âm nhận được không đúng định dạng JSON.');
      }
      
      if (base64Audio) {
        const audioContext = new (window.AudioContext || (window as any).webkitAudioContext)({ sampleRate: 24000 });
        audioContextRef.current = audioContext;
        
        const binaryString = atob(base64Audio);
        const bytes = new Int16Array(binaryString.length / 2);
        for (let i = 0; i < binaryString.length; i += 2) {
          bytes[i / 2] = binaryString.charCodeAt(i) | (binaryString.charCodeAt(i + 1) << 8);
        }

        const audioBuffer = audioContext.createBuffer(1, bytes.length, 24000);
        const channelData = audioBuffer.getChannelData(0);
        for (let i = 0; i < bytes.length; i++) {
          channelData[i] = bytes[i] / 32768;
        }

        const source = audioContext.createBufferSource();
        source.buffer = audioBuffer;
        source.connect(audioContext.destination);
        source.onended = () => {
          setIsSpeaking(false);
          audioSourceRef.current = null;
          // Context cleanup
          audioContext.close().catch(() => {});
        };
        audioSourceRef.current = source;
        source.start();
      } else {
        throw new Error('No audio data received');
      }
    } catch (error) {
      console.error('TTS failed, falling back:', error);
      const utterance = new SpeechSynthesisUtterance(cleanedText);
      utterance.lang = 'vi-VN';
      utterance.onend = () => setIsSpeaking(false);
      utterance.onerror = () => setIsSpeaking(false);
      window.speechSynthesis.speak(utterance);
    }
  };

  useEffect(() => {
    if ('webkitSpeechRecognition' in window) {
      const SpeechRecognition = window.webkitSpeechRecognition;
      recognitionRef.current = new SpeechRecognition();
      recognitionRef.current.continuous = false;
      recognitionRef.current.interimResults = false;
      recognitionRef.current.lang = 'vi-VN';

      recognitionRef.current.onresult = (event: any) => {
        const transcript = event.results[0][0].transcript;
        setInput(transcript);
        setIsListening(false);
      };

      recognitionRef.current.onerror = () => setIsListening(false);
      recognitionRef.current.onend = () => setIsListening(false);
    }

    return () => {
      stopSpeaking();
    };
  }, []);

  const toggleListening = () => {
    if (isListening) {
      recognitionRef.current?.stop();
    } else {
      if (recognitionRef.current) {
        setIsListening(true);
        recognitionRef.current.start();
      } else {
        setErrorMsg('Trình duyệt của bạn không hỗ trợ nhận diện giọng nói.');
      }
    }
  };

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages]);

  const handleSend = async (text?: string, images?: string[]) => {
    const messageText = typeof text === 'string' ? text : input;
    const messageImages = Array.isArray(text) ? text : images;
    
    if (!messageText.trim() && (!messageImages || messageImages.length === 0)) return;
    if (isLoading) return;

    setErrorMsg(null);
    const userMessage: Message = { 
      role: 'user', 
      content: messageText, 
      images: messageImages,
      timestamp: Date.now() 
    };
    setMessages(prev => [...prev, userMessage]);
    setInput('');
    setIsLoading(true);

    let assistantMessage: Message = { role: 'model', content: '', timestamp: Date.now() };
    setMessages(prev => [...prev, assistantMessage]);

    try {
      const history = messages.map(m => ({
        role: m.role,
        parts: [{ text: m.content }]
      }));

      const stream = sendMessageStream(messageText, history, messageImages, studentInfo);
      let fullText = '';
      for await (const chunk of stream) {
        fullText += chunk;
        assistantMessage = { ...assistantMessage, content: fullText };
        setMessages(prev => {
          const newMessages = [...prev];
          newMessages[newMessages.length - 1] = assistantMessage;
          return newMessages;
        });
      }

      if (autoSpeak) {
        speakText(fullText);
      }
    } catch (error: any) {
      console.error('Chat Error:', error);
      
      let errorTypeHeader = "🛑 **Mất kết nối với máy chủ AI hoặc hệ thống đang gặp gián đoạn tạm thời.**";
      const errStr = String(error?.message || error).toLowerCase();

      if (errStr.includes("503") || errStr.includes("unavailable") || errStr.includes("high demand") || errStr.includes("busy") || errStr.includes("overloaded")) {
        errorTypeHeader = "⚠️ **Máy chủ AI hiện tại đang bận do quá tải (Lỗi 503 / Server Busy).**";
      } else if (errStr.includes("fetch") || errStr.includes("network") || errStr.includes("disconnected") || errStr.includes("offline") || errStr.includes("failed to fetch")) {
        errorTypeHeader = "📶 **Kết nối mạng bị yếu hoặc đường truyền internet bị gián đoạn.**";
      } else if (errStr.includes("timeout") || errStr.includes("time out") || errStr.includes("expired")) {
        errorTypeHeader = "⏳ **Phản hồi từ máy chủ bị hết thời gian chờ (Timeout).**";
      }

      const friendlyError = `${errorTypeHeader}

Các em vui lòng thực hiện các bước sau để tiếp tục học tập:
1. **Chờ khoảng 2-3 phút** để máy chủ ổn định tải hoặc kiểm tra kết nối thiết bị của các em.
2. **Thử gửi lại yêu cầu** (bằng cách nhấp gửi lại hoặc nhập lại câu hỏi).

*Cảm ơn sự kiên nhẫn của các em!*

---
*(Chi tiết mã lỗi: \`${error?.message || error}\`)*`;

      assistantMessage = { ...assistantMessage, content: friendlyError };
      setMessages(prev => {
        const newMessages = [...prev];
        newMessages[newMessages.length - 1] = assistantMessage;
        return newMessages;
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleReset = () => {
    setMessages([]);
    localStorage.removeItem(STORAGE_KEYS.MESSAGES);
    stopSpeaking();
  };

  // Nhận thông tin sinh viên từ link Sổ tay điểm danh (?name=...&lop=...&mon=...).
  // Nếu có ?officialTest=1, chuyển thẳng vào luồng Kiểm tra chính thức với testId và mssv.
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const isOfficialTest = params.get('officialTest') === '1' || params.get('officialTest') === 'true';
    const testId = params.get('testId');
    const mssv = params.get('mssv');
    const name = params.get('name');
    const className = params.get('lop');
    const mon = params.get('mon');

    if (name || className) {
      const merged: StudentInfo = {
        name: name || studentInfo.name,
        className: className || studentInfo.className
      };
      setStudentInfo(merged);
      localStorage.setItem(STORAGE_KEYS.STUDENT_INFO, JSON.stringify(merged));
    }

    // Kiểm tra luồng kiểm tra chính thức
    if (isOfficialTest) {
      if (!testId || !testId.trim() || !mssv || !mssv.trim()) {
        setOfficialTestError('Đường link kiểm tra không hợp lệ: Thiếu mã bài kiểm tra (testId) hoặc mã số sinh viên (mssv). Vui lòng mở lại link từ hệ thống Điểm danh.');
        setAppMode('official-test');
        return;
      }

      setOfficialTestParams({
        testId: testId.trim(),
        mssv: mssv.trim(),
        className: (className || studentInfo.className || 'Chưa rõ lớp').trim(),
        subjectId: (mon || 'vat-lieu').trim(),
        studentName: (name || studentInfo.name || '').trim(),
      });
      setOfficialTestError(null);
      setAppMode('official-test');
      return;
    }

    if (mon && messages.length === 0 && appMode === 'select-mode') {
      const subject = SUBJECTS.find(s => s.id === mon);
      if (subject) {
        setAppMode('chat');
        handleSend(`Thầy/Cô ơi, em muốn hỏi về môn ${subject.name}`);
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div className="flex flex-col h-screen relative overflow-hidden transition-colors duration-1000">
      <ThemeBackground isDarkMode={isDarkMode} />
      
      <ChatHeader 
        autoSpeak={autoSpeak}
        setAutoSpeak={setAutoSpeak}
        isDarkMode={isDarkMode}
        setIsDarkMode={setIsDarkMode}
        hasMessages={messages.length > 0 || appMode !== 'select-mode'}
        onHome={() => {
            handleReset();
            setAppMode('select-mode');
        }}
        isRagOpen={isRagOpen}
        setIsRagOpen={setIsRagOpen}
      />

      {/* Main Content */}
      <main 
        ref={scrollRef}
        className="flex-1 overflow-y-auto relative z-10 scroll-smooth"
      >
        {appMode === 'select-mode' ? (
          <div className="max-w-4xl mx-auto mt-6 sm:mt-12 p-4 space-y-8 sm:space-y-12 animate-in fade-in slide-in-from-bottom-6 duration-700">
            
             <div className="text-center space-y-3">
                <div className="w-24 h-24 sm:w-28 sm:h-28 mx-auto rounded-3xl overflow-hidden shadow-xl shadow-cyan-500/15 ring-2 ring-cyan-500/30 hover:scale-105 duration-300 transition-transform bg-gray-100 dark:bg-gray-800">
                    <img 
                        src={cyberHorseLogo} 
                        alt="Biểu trưng Lê Tuấn - Minh Vân"
                        className="w-full h-full object-cover"
                        loading="eager"
                        width={112}
                        height={112}
                        onError={(e) => {
                            const target = e.currentTarget;
                            if (target.src !== '/logo.webp' && target.src !== '/logo.png') {
                                target.src = '/logo.webp';
                            }
                        }}
                    />
                </div>
                <div className="space-y-1 max-w-md mx-auto">
                    <h2 className="text-lg sm:text-xl font-extrabold text-gray-900 dark:text-white">
                      Chào mừng các em đến với Không Gian Học Tập Kỹ Thuật
                    </h2>
                    <p className="text-xs sm:text-sm text-gray-600 dark:text-gray-400 font-medium">
                      Chọn một chế độ dưới đây để bắt đầu bài giảng hoặc thử thách kiến thức
                    </p>
                </div>
             </div>

             <div className="grid grid-cols-1 md:grid-cols-2 gap-5 sm:gap-8 px-2 sm:px-4">
                <button 
                    onClick={() => setAppMode('chat')}
                    className="group relative bg-white/90 dark:bg-gray-900/85 backdrop-blur-xl border border-gray-200 dark:border-gray-800 rounded-3xl p-6 sm:p-8 text-left hover:border-cyan-500 dark:hover:border-cyan-500 shadow-md hover:shadow-xl transition-all hover:-translate-y-1 cursor-pointer"
                >
                    <div className="absolute top-6 right-8 text-cyan-100 dark:text-cyan-950 group-hover:text-cyan-500/30 transition-colors">
                        <Layers size={44} />
                    </div>
                    <div className="w-13 h-13 bg-cyan-100 dark:bg-cyan-950/50 rounded-2xl flex items-center justify-center text-cyan-600 dark:text-cyan-400 mb-5 group-hover:scale-110 transition-transform">
                        <MessageSquare size={26} />
                    </div>
                    <h3 className="text-xl sm:text-2xl font-bold text-gray-900 dark:text-white mb-2">Hỏi đáp AI</h3>
                    <p className="text-gray-600 dark:text-gray-400 text-xs sm:text-sm leading-relaxed">
                        Tra cứu kiến thức, giải thích khái niệm bản chất, công thức và ứng dụng thực tế tại xưởng cùng Thầy/Cô.
                    </p>
                    <div className="mt-6 flex items-center gap-2 text-cyan-600 dark:text-cyan-400 font-bold text-xs uppercase tracking-wider">
                        Bắt đầu trao đổi <ChevronRight size={14} />
                    </div>
                </button>

                <button 
                    onClick={() => setAppMode('quiz')}
                    className="group relative bg-white/90 dark:bg-gray-900/85 backdrop-blur-xl border border-gray-200 dark:border-gray-800 rounded-3xl p-6 sm:p-8 text-left hover:border-indigo-500 dark:hover:border-indigo-500 shadow-md hover:shadow-xl transition-all hover:-translate-y-1 cursor-pointer"
                >
                    <div className="absolute top-6 right-8 text-indigo-100 dark:text-indigo-950 group-hover:text-indigo-500/30 transition-colors">
                        <Zap size={44} />
                    </div>
                    <div className="w-13 h-13 bg-indigo-100 dark:bg-indigo-950/50 rounded-2xl flex items-center justify-center text-indigo-600 dark:text-indigo-400 mb-5 group-hover:scale-110 transition-transform">
                        <Ruler size={26} />
                    </div>
                    <h3 className="text-xl sm:text-2xl font-bold text-gray-900 dark:text-white mb-2">Ôn tập Thông minh</h3>
                    <p className="text-gray-600 dark:text-gray-400 text-xs sm:text-sm leading-relaxed">
                        Tự kiểm tra kiến thức qua các bộ đề trắc nghiệm và tự luận được AI sinh ngẫu nhiên theo từng chủ đề.
                    </p>
                    <div className="mt-6 flex items-center gap-2 text-indigo-600 dark:text-indigo-400 font-bold text-xs uppercase tracking-wider">
                        Thử thách ngay <ChevronRight size={14} />
                    </div>
                </button>
             </div>

             <div className="text-center pt-2">
                 <p className="text-[10px] text-cyan-600 dark:text-cyan-400 font-bold uppercase tracking-[0.25em] mb-4">Học tập thực chất - Vững chắc tay nghề</p>
                 
                 {Object.keys(stats).length > 0 && (
                     <div className="inline-flex flex-wrap justify-center gap-3 p-3 sm:p-4 bg-white/80 dark:bg-gray-900/80 backdrop-blur-md rounded-2xl border border-gray-200 dark:border-gray-800 shadow-xs">
                        {SUBJECTS.filter(s => stats[s.name] || stats[s.id]).map(s => {
                            const subStats = stats[s.name] || stats[s.id];
                            const chapters = Object.keys(subStats);
                            const avg = chapters.reduce((acc, c) => acc + subStats[c].highestScore, 0) / chapters.length;
                            return (
                                <div key={s.id} className="flex items-center gap-2 px-3 py-1.5 bg-gray-50 dark:bg-gray-800 rounded-xl border border-gray-100 dark:border-gray-700 shadow-xs">
                                    <s.icon size={14} className={s.color} />
                                    <span className="text-xs font-bold text-gray-700 dark:text-gray-300">{s.name}: {Math.round(avg * 10)}%</span>
                                </div>
                            );
                        })}
                     </div>
                 )}
             </div>
          </div>
        ) : appMode === 'official-test' ? (
          officialTestError ? (
            <div className="max-w-md mx-auto mt-12 p-6 bg-white dark:bg-gray-900 rounded-3xl border border-red-200 dark:border-red-900/50 shadow-xl text-center space-y-4 animate-in fade-in duration-500">
              <div className="w-14 h-14 mx-auto bg-red-100 dark:bg-red-950/60 rounded-2xl flex items-center justify-center text-red-600 dark:text-red-400">
                <ShieldAlert size={28} />
              </div>
              <h3 className="text-base font-bold text-gray-900 dark:text-white">Lỗi truy cập bài kiểm tra chính thức</h3>
              <p className="text-xs text-red-600 dark:text-red-400 leading-relaxed font-medium">
                {officialTestError}
              </p>
              <button
                onClick={() => setAppMode('select-mode')}
                className="px-5 py-2 bg-gray-100 hover:bg-gray-200 dark:bg-gray-800 dark:hover:bg-gray-700 text-gray-800 dark:text-gray-200 rounded-xl text-xs font-bold transition-all cursor-pointer"
              >
                Quay về trang chính
              </button>
            </div>
          ) : officialTestParams ? (
            <div className="p-4 sm:p-6">
              <OfficialTest
                testId={officialTestParams.testId}
                mssv={officialTestParams.mssv}
                className={officialTestParams.className}
                subjectId={officialTestParams.subjectId}
                studentName={officialTestParams.studentName}
                subjectName={SUBJECTS.find(s => s.id === officialTestParams.subjectId)?.name}
                onExit={() => setAppMode('select-mode')}
              />
            </div>
          ) : null
        ) : appMode === 'quiz' ? (
          <QuizManager subjects={SUBJECTS} onBackToHome={() => setAppMode('select-mode')} />
        ) : (
          <div className="p-4 sm:p-6 space-y-6">
            {messages.length === 0 ? (
              <div className="max-w-2xl mx-auto mt-4 sm:mt-8 space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-700">
                <div className="text-center space-y-2">
                  <h2 className="text-xl sm:text-2xl font-bold text-gray-900 dark:text-white">Chào các em sinh viên! 👋</h2>
                  <p className="text-xs sm:text-sm text-gray-600 dark:text-gray-400">Thầy/Cô là trợ lý AI chuyên về các môn cơ sở kỹ thuật Cơ khí. Em cần Thầy/Cô giải thích hoặc hướng dẫn vấn đề gì hôm nay?</p>
                </div>
                
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
                  {SUBJECTS.map((subject) => (
                    <SubjectCard 
                      key={subject.id} 
                      subject={subject} 
                      onClick={() => handleSend(`Thầy/Cô ơi, em muốn hỏi về môn ${subject.name}`)} 
                    />
                  ))}
                </div>

                <div className="bg-cyan-50/80 dark:bg-cyan-950/30 backdrop-blur-sm border border-cyan-200/80 dark:border-cyan-800/50 rounded-2xl p-4 text-xs sm:text-sm text-cyan-900 dark:text-cyan-200 shadow-xs space-y-2.5">
                  <p className="font-bold flex items-center gap-2 text-cyan-800 dark:text-cyan-300">
                    <span className="flex h-2 w-2 rounded-full bg-cyan-500 animate-pulse" />
                    Gợi ý câu hỏi nhanh (nhấn để hỏi ngay):
                  </p>
                  <div className="flex flex-wrap gap-2">
                    {[
                      'Giải thích về lắp ghép lỏng và chặt?',
                      'Mô men lực là gì, ứng dụng khi dùng cờ lê?',
                      'Cách đọc ký hiệu độ nhám trên bản vẽ?',
                      'Quy tắc an toàn khi vận hành máy tiện?',
                    ].map((suggestion, idx) => (
                      <button
                        key={idx}
                        onClick={() => handleSend(suggestion)}
                        className="text-left text-xs bg-white dark:bg-gray-800 hover:bg-cyan-100 dark:hover:bg-cyan-900/60 text-gray-800 dark:text-gray-200 px-3 py-1.5 rounded-xl border border-cyan-200/80 dark:border-gray-700 transition-all shadow-2xs hover:shadow-xs cursor-pointer flex items-center gap-1.5"
                      >
                        <span className="text-cyan-500">👉</span> {suggestion}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            ) : (
              <AnimatePresence initial={false}>
                {messages.map((msg, idx) => (
                  <MessageItem 
                    key={idx}
                    message={msg}
                    isLast={idx === messages.length - 1}
                    isLoading={isLoading}
                    isSpeaking={isSpeaking}
                    onSpeak={speakText}
                    onStopSpeaking={stopSpeaking}
                  />
                ))}
              </AnimatePresence>
            )}
            {errorMsg && (
              <div className="max-w-md mx-auto p-3 bg-red-100 border border-red-200 text-red-600 rounded-lg text-sm text-center animate-bounce">
                {errorMsg}
              </div>
            )}
          </div>
        )}
      </main>

      {appMode === 'chat' && (
        <ChatInput 
          input={input}
          setInput={setInput}
          isLoading={isLoading}
          isListening={isListening}
          toggleListening={toggleListening}
          handleSend={handleSend}
        />
      )}

      <AdminPanel isOpen={isRagOpen} setIsOpen={setIsRagOpen} />
    </div>
  );
}