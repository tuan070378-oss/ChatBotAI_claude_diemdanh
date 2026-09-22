import React from 'react';
import { Home, Moon, Sun, Volume2, VolumeX, Database } from 'lucide-react';
import { cn } from '../../lib/utils';

interface ChatHeaderProps {
  autoSpeak: boolean;
  setAutoSpeak: (val: boolean) => void;
  isDarkMode: boolean;
  setIsDarkMode: (val: boolean) => void;
  hasMessages: boolean;
  onHome: () => void;
  isRagOpen: boolean;
  setIsRagOpen: (val: boolean) => void;
}

export const ChatHeader: React.FC<ChatHeaderProps> = ({
  autoSpeak,
  setAutoSpeak,
  isDarkMode,
  setIsDarkMode,
  hasMessages,
  onHome,
  isRagOpen,
  setIsRagOpen
}) => {
  return (
    <header className="relative z-20 bg-white/80 dark:bg-gray-900/80 backdrop-blur-xl border-b border-gray-200/80 dark:border-gray-800/80 px-4 sm:px-6 py-3.5 flex items-center justify-between shadow-xs transition-colors">
      <div className="flex items-center gap-3 min-w-0">
        <div className="min-w-0">
          <h1 className="font-heading font-extrabold text-gray-900 dark:text-white text-sm sm:text-base leading-tight tracking-tight truncate">
            AI <span className="text-fire-2 font-bold">•</span> Trợ lý Học tập
          </h1>
          <p className="text-[10px] text-gray-500 dark:text-gray-400 font-semibold uppercase tracking-wider truncate">
            Lê Tuấn | Cơ Khí Kỹ Thuật Thực Tiễn
          </p>
        </div>
      </div>
      <div className="flex items-center gap-1.5 sm:gap-2 shrink-0">
        <button
          onClick={() => setIsRagOpen(!isRagOpen)}
          className={cn(
            "h-9 px-2.5 sm:px-3 rounded-xl transition-all flex items-center gap-1.5 text-xs font-bold focus-visible:ring-2 focus-visible:ring-fire-2 outline-none border cursor-pointer",
            isRagOpen 
              ? "bg-orange-50 dark:bg-navy-panel text-fire-1 dark:text-fire-2 border-fire-2/50 dark:border-fire-2/40 shadow-xs" 
              : "text-gray-700 dark:text-gray-300 hover:text-gray-900 dark:hover:text-white bg-gray-100/80 dark:bg-gray-800/80 hover:bg-gray-200/80 dark:hover:bg-gray-700/80 border-gray-200 dark:border-gray-700/60"
          )}
          aria-label={isRagOpen ? "Đóng kho RAG" : "Quản trị kho RAG"}
          title={isRagOpen ? "Đóng kho RAG" : "Quản trị kho RAG"}
        >
          <Database size={15} className={cn(isRagOpen && "text-fire-2")} />
          <span className="hidden md:inline">Kho RAG</span>
        </button>
        <button
          onClick={() => setAutoSpeak(!autoSpeak)}
          className={cn(
            "h-9 px-2.5 sm:px-3 rounded-xl transition-all flex items-center gap-1.5 text-xs font-bold focus-visible:ring-2 focus-visible:ring-fire-2 outline-none border cursor-pointer",
            autoSpeak 
              ? "bg-orange-50 dark:bg-navy-panel text-fire-1 dark:text-fire-2 border-fire-2/50 dark:border-fire-2/40 shadow-xs" 
              : "text-gray-700 dark:text-gray-300 hover:text-gray-900 dark:hover:text-white bg-gray-100/80 dark:bg-gray-800/80 hover:bg-gray-200/80 dark:hover:bg-gray-700/80 border-gray-200 dark:border-gray-700/60"
          )}
          aria-label={autoSpeak ? "Tắt tự động đọc" : "Bật tự động đọc"}
          title={autoSpeak ? "Tắt tự động đọc giọng nói" : "Bật tự động đọc giọng nói"}
        >
          {autoSpeak ? <Volume2 size={15} className="text-fire-2" /> : <VolumeX size={15} />}
          <span className="hidden md:inline">Đọc phản hồi</span>
        </button>
        <button
          onClick={() => setIsDarkMode(!isDarkMode)}
          className="h-9 w-9 flex items-center justify-center text-gray-700 dark:text-gray-300 hover:text-gray-900 dark:hover:text-white bg-gray-100/80 dark:bg-gray-800/80 hover:bg-gray-200/80 dark:hover:bg-gray-700/80 border border-gray-200 dark:border-gray-700/60 rounded-xl transition-all focus-visible:ring-2 focus-visible:ring-fire-2 outline-none cursor-pointer"
          aria-label={isDarkMode ? "Chuyển sang chế độ sáng" : "Chuyển sang chế độ tối"}
          title={isDarkMode ? "Chuyển sang chế độ sáng" : "Chuyển sang chế độ tối"}
        >
          {isDarkMode ? <Sun size={16} className="text-amber-400" /> : <Moon size={16} />}
        </button>
        {hasMessages && (
          <button 
            onClick={onHome}
            className="h-9 px-2.5 sm:px-3 text-gray-700 dark:text-gray-300 hover:text-gray-900 dark:hover:text-white bg-gray-100/80 dark:bg-gray-800/80 hover:bg-gray-200/80 dark:hover:bg-gray-700/80 border border-gray-200 dark:border-gray-700/60 rounded-xl transition-all flex items-center gap-1.5 text-xs font-bold focus-visible:ring-2 focus-visible:ring-fire-2 outline-none cursor-pointer"
            aria-label="Quay về màn hình chọn chế độ"
            title="Quay về màn hình chính"
          >
            <Home size={15} />
            <span className="hidden sm:inline">Trang chủ</span>
          </button>
        )}
        <span className="hidden lg:inline-flex items-center px-2.5 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider bg-emerald-100 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-400 border border-emerald-300 dark:border-emerald-800">
          <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 mr-1.5 animate-pulse" />
          Trực tuyến
        </span>
      </div>
    </header>
  );
};