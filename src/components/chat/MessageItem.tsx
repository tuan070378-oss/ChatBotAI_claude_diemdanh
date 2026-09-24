import React, { useState } from 'react';
import { User, Bot, Loader2, Volume2, VolumeX, Copy, Check } from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import { motion } from 'motion/react';
import { cn, cleanMathText } from '../../lib/utils';
import { Message } from '../../types';

interface MessageItemProps {
  message: Message;
  isLast: boolean;
  isLoading: boolean;
  isSpeaking: boolean;
  onSpeak: (content: string) => void;
  onStopSpeaking: () => void;
}

export const MessageItem: React.FC<MessageItemProps> = ({
  message,
  isLast,
  isLoading,
  isSpeaking,
  onSpeak,
  onStopSpeaking
}) => {
  const isUser = message.role === 'user';
  const [copied, setCopied] = useState(false);
  const [previewImg, setPreviewImg] = useState<string | null>(null);

  const handleCopy = async () => {
    if (!message.content) return;
    try {
      await navigator.clipboard.writeText(cleanMathText(message.content));
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Fallback
    }
  };

  return (
    <>
      <motion.div
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        className={cn(
          "flex gap-2.5 sm:gap-3 max-w-4xl mx-auto w-full",
          isUser ? "flex-row-reverse" : "flex-row"
        )}
      >
        <div className={cn(
          "w-8 h-8 sm:w-9 sm:h-9 rounded-xl flex items-center justify-center shrink-0 shadow-xs transition-all",
          isUser 
            ? "fire-gradient-bg text-white" 
            : "bg-white dark:bg-navy-panel border border-gray-200 dark:border-steel text-fire-1 dark:text-fire-2"
        )}>
          {isUser ? <User size={17} /> : <Bot size={17} />}
        </div>
        
        <div className={cn(
          "px-4 sm:px-5 py-3.5 rounded-2xl shadow-xs max-w-[88%] sm:max-w-[82%] transition-all border",
          isUser 
            ? "bg-fire-1 border-transparent text-white rounded-tr-xs" 
            : "bg-white/95 dark:bg-gray-900/90 border-gray-200 dark:border-gray-800 text-gray-900 dark:text-gray-100 rounded-tl-xs shadow-sm"
        )}>
          <div className={cn(
            "prose prose-sm max-w-none dark:prose-invert leading-relaxed break-words",
            isUser ? "prose-invert text-white [&_p]:text-white [&_a]:text-white font-medium" : "[&_p]:text-gray-800 dark:[&_p]:text-gray-200"
          )}>
            <ReactMarkdown>{cleanMathText(message.content)}</ReactMarkdown>
          </div>
          
          {message.images && message.images.length > 0 && (
            <div className="mt-3 flex flex-wrap gap-2">
              {message.images.map((img, idx) => (
                <img 
                  key={idx} 
                  src={img} 
                  alt="Ảnh đính kèm" 
                  className="max-w-[180px] max-h-[180px] sm:max-w-[220px] sm:max-h-[220px] object-cover rounded-xl border border-gray-200 dark:border-gray-700 shadow-xs cursor-pointer hover:opacity-90 transition-opacity"
                  onClick={() => setPreviewImg(img)}
                  referrerPolicy="no-referrer"
                  title="Nhấn để phóng to ảnh"
                />
              ))}
            </div>
          )}

          {!isUser && message.content && (
            <div className="mt-2.5 pt-2 border-t border-gray-100 dark:border-gray-800 flex items-center gap-1.5 flex-wrap">
              <button
                onClick={() => isSpeaking ? onStopSpeaking() : onSpeak(cleanMathText(message.content))}
                className={cn(
                  "px-2.5 py-1 rounded-lg text-[11px] font-bold transition-colors flex items-center gap-1.5 focus-visible:ring-2 focus-visible:ring-fire-2 outline-none cursor-pointer",
                  isSpeaking 
                    ? "bg-rose-100 dark:bg-rose-950/50 text-rose-700 dark:text-rose-300" 
                    : "bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-300 hover:text-fire-1 dark:hover:text-fire-2"
                )}
                aria-label={isSpeaking ? "Dừng đọc phản hồi" : "Nghe đọc phản hồi bằng giọng nói"}
                title={isSpeaking ? "Dừng đọc" : "Nghe đọc"}
              >
                {isSpeaking ? (
                  <>
                    <VolumeX size={13} className="animate-pulse" />
                    <span>Dừng đọc</span>
                  </>
                ) : (
                  <>
                    <Volume2 size={13} />
                    <span>Nghe đọc</span>
                  </>
                )}
              </button>

              <button
                onClick={handleCopy}
                className="px-2.5 py-1 rounded-lg bg-gray-100 dark:bg-gray-800 hover:bg-gray-200 dark:hover:bg-gray-700 text-gray-600 dark:text-gray-300 hover:text-fire-1 dark:hover:text-fire-2 text-[11px] font-bold transition-colors flex items-center gap-1.5 focus-visible:ring-2 focus-visible:ring-fire-2 outline-none cursor-pointer"
                aria-label="Sao chép nội dung câu trả lời"
                title="Sao chép văn bản"
              >
                {copied ? (
                  <>
                    <Check size={13} className="text-emerald-500" />
                    <span className="text-emerald-600 dark:text-emerald-400">Đã chép!</span>
                  </>
                ) : (
                  <>
                    <Copy size={13} />
                    <span>Sao chép</span>
                  </>
                )}
              </button>
            </div>
          )}

          {isLast && isLoading && !isUser && !message.content && (
            <div className="flex items-center gap-2 py-1">
              <Loader2 className="w-4 h-4 animate-spin text-fire-1 dark:text-fire-2" />
              <span className="text-xs text-gray-500 dark:text-gray-400 font-medium animate-pulse">Thầy/Cô đang suy nghĩ & soạn câu trả lời...</span>
            </div>
          )}
        </div>
      </motion.div>

      {/* Iframe-Safe In-App Image Modal Preview */}
      {previewImg && (
        <div 
          className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4"
          onClick={() => setPreviewImg(null)}
        >
          <div className="relative max-w-2xl w-full max-h-[85vh] flex flex-col items-center" onClick={e => e.stopPropagation()}>
            <img 
              src={previewImg} 
              alt="Phóng to ảnh" 
              className="max-w-full max-h-[80vh] object-contain rounded-2xl shadow-2xl border border-white/20"
              referrerPolicy="no-referrer"
            />
            <button 
              onClick={() => setPreviewImg(null)}
              className="mt-3 px-4 py-1.5 bg-white/20 hover:bg-white/30 text-white rounded-full text-xs font-bold transition-colors cursor-pointer"
            >
              Đóng xem ảnh
            </button>
          </div>
        </div>
      )}
    </>
  );
};