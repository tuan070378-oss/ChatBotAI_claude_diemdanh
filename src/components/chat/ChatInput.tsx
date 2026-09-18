import React from 'react';
import { Send, Loader2, Mic, MicOff, Image as ImageIcon, X } from 'lucide-react';
import { cn } from '../../lib/utils';

interface ChatInputProps {
  input: string;
  setInput: (val: string) => void;
  isLoading: boolean;
  isListening: boolean;
  toggleListening: () => void;
  handleSend: (text?: string, images?: string[]) => void;
}

export const ChatInput: React.FC<ChatInputProps> = ({
  input,
  setInput,
  isLoading,
  isListening,
  toggleListening,
  handleSend
}) => {
  const [selectedImages, setSelectedImages] = React.useState<string[]>([]);
  const fileInputRef = React.useRef<HTMLInputElement>(null);

  const handleImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files) return;

    const newImages: string[] = [];
    const remainingSlots = 3 - selectedImages.length;
    const filesToProcess = Array.from(files).slice(0, remainingSlots);

    filesToProcess.forEach(file => {
      const reader = new FileReader();
      reader.onloadend = () => {
        newImages.push(reader.result as string);
        if (newImages.length === filesToProcess.length) {
          setSelectedImages(prev => [...prev, ...newImages]);
        }
      };
      reader.readAsDataURL(file);
    });
    
    // Reset input
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const removeImage = (index: number) => {
    setSelectedImages(prev => prev.filter((_, i) => i !== index));
  };

  const onSend = () => {
    if (!input.trim() && selectedImages.length === 0) return;
    handleSend(input, selectedImages);
    setSelectedImages([]);
  };

  return (
    <div className="bg-white/80 dark:bg-gray-900/80 backdrop-blur-2xl border-t border-gray-200/80 dark:border-gray-800/80 p-3 sm:p-4 transition-colors relative z-10 shadow-xs">
      <div className="max-w-4xl mx-auto space-y-3">
        {/* Image Preview Area */}
        {selectedImages.length > 0 && (
          <div className="flex gap-2.5 animate-in fade-in slide-in-from-bottom-2 duration-300">
            {selectedImages.map((img, idx) => (
              <div key={idx} className="relative group">
                <img 
                  src={img} 
                  alt={`Xem trước ảnh ${idx + 1}`} 
                  className="w-16 h-16 object-cover rounded-xl border-2 border-cyan-500 shadow-md"
                  referrerPolicy="no-referrer"
                />
                <button 
                  onClick={() => removeImage(idx)}
                  className="absolute -top-1.5 -right-1.5 p-1 bg-rose-600 hover:bg-rose-700 text-white rounded-full shadow-md transition-all cursor-pointer"
                  aria-label="Xóa ảnh này"
                  title="Xóa ảnh"
                >
                  <X size={13} />
                </button>
              </div>
            ))}
          </div>
        )}

        <div className="relative flex gap-2 items-center">
          <input 
            type="file" 
            ref={fileInputRef}
            onChange={handleImageChange}
            accept="image/*"
            multiple
            className="hidden"
            aria-label="Tải lên ảnh"
          />
          
          <button
            onClick={() => fileInputRef.current?.click()}
            disabled={selectedImages.length >= 3}
            className={cn(
              "h-12 w-12 rounded-2xl bg-gray-100 dark:bg-gray-800 hover:bg-gray-200 dark:hover:bg-gray-700/80 text-gray-600 dark:text-gray-300 hover:text-cyan-600 dark:hover:text-cyan-400 border border-gray-200 dark:border-gray-700/60 transition-all flex items-center justify-center shrink-0 focus-visible:ring-2 focus-visible:ring-cyan-500 outline-none disabled:opacity-40 cursor-pointer",
            )}
            aria-label="Tải lên ảnh bài tập hoặc bản vẽ kỹ thuật (Tối đa 3 ảnh)"
            title="Tải lên ảnh (Tối đa 3)"
          >
            <ImageIcon size={20} />
          </button>

          <button
            onClick={toggleListening}
            className={cn(
              "h-12 w-12 rounded-2xl transition-all flex items-center justify-center shrink-0 focus-visible:ring-2 focus-visible:ring-cyan-500 outline-none cursor-pointer",
              isListening 
                ? "bg-rose-600 text-white shadow-md shadow-rose-500/30 animate-pulse" 
                : "bg-gray-100 dark:bg-gray-800 hover:bg-gray-200 dark:hover:bg-gray-700/80 text-gray-600 dark:text-gray-300 hover:text-cyan-600 dark:hover:text-cyan-400 border border-gray-200 dark:border-gray-700/60"
            )}
            aria-label={isListening ? "Dừng nghe giọng nói" : "Bắt đầu nói để nhập liệu"}
            title={isListening ? "Đang nghe... Bấm để dừng" : "Nói để nhập liệu"}
          >
            {isListening ? <MicOff size={20} /> : <Mic size={20} />}
          </button>

          <div className="relative flex-1">
            <textarea
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault();
                  onSend();
                }
              }}
              placeholder={selectedImages.length > 0 ? "Thêm mô tả cho ảnh..." : "Đặt câu hỏi hoặc gõ công thức..."}
              aria-label="Nội dung câu hỏi gửi AI"
              className="w-full pl-4 pr-12 py-3.5 bg-white dark:bg-gray-900 border border-gray-300 dark:border-gray-700/80 rounded-2xl focus-visible:ring-2 focus-visible:ring-cyan-500 focus-visible:border-cyan-500 outline-none resize-none min-h-[48px] max-h-32 transition-all text-sm text-gray-900 dark:text-white placeholder:text-gray-400 dark:placeholder:text-gray-500 shadow-xs"
              rows={1}
            />
            <button
              onClick={onSend}
              disabled={isLoading || (!input.trim() && selectedImages.length === 0)}
              className="absolute right-2 top-1/2 -translate-y-1/2 w-8 h-8 flex items-center justify-center text-white bg-cyan-600 hover:bg-cyan-700 dark:bg-cyan-500 dark:hover:bg-cyan-600 rounded-xl disabled:opacity-40 disabled:hover:bg-cyan-600 transition-all focus-visible:ring-2 focus-visible:ring-cyan-500 outline-none cursor-pointer"
              aria-label="Gửi tin nhắn"
              title="Gửi"
            >
              {isLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
            </button>
          </div>
        </div>
      </div>
      <p className="text-[10px] text-center text-cyan-600 dark:text-cyan-400 mt-2 uppercase tracking-widest font-bold">
        Học tập thực chất - Vững chắc tay nghề
      </p>
    </div>
  );
};
