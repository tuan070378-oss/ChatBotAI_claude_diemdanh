import React, { useState, useEffect } from 'react';
import { Database, Plus, Trash2, X, Loader2, FileText, CheckCircle, AlertCircle, Search, Check, Info, ArrowRight } from 'lucide-react';
import { db, collection, addDoc, serverTimestamp, query, orderBy, getDocs, deleteDoc, doc, isFirebaseConfigured } from '../../lib/firebase';
import { cn } from '../../lib/utils';

const SUBJECTS = [
  { id: 'dung-sai', name: 'Dung sai & Đo lường' },
  { id: 'co-ky-thuat', name: 'Cơ kỹ thuật' },
  { id: 've-ky-thuat', name: 'Vẽ kỹ thuật' },
  { id: 'vat-lieu', name: 'Vật liệu cơ khí' },
  { id: 'an-toan', name: 'An toàn lao động' },
];

const ADMIN_PASSWORD = '1210';

interface AdminPanelProps {
  isOpen: boolean;
  setIsOpen: (isOpen: boolean) => void;
}

export const AdminPanel: React.FC<AdminPanelProps> = ({ isOpen, setIsOpen }) => {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [enteredPassword, setEnteredPassword] = useState('');
  const [activeSubject, setActiveSubject] = useState(SUBJECTS[0].id);
  const [chapter, setChapter] = useState('');
  const [content, setContent] = useState('');
  const [items, setItems] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');

  // Dual-tab Control: 'import' for importing content/files, 'browse' for checking existing knowledge base
  const [adminTab, setAdminTab] = useState<'import' | 'browse'>('import');
  
  // Sub-toggle for import tab: 'file' for PDF/DOCX/TXT uploads, 'manual' for typed content
  const [importMode, setImportMode] = useState<'file' | 'manual'>('file');

  // Custom Notifications / Toast State
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' | 'info' } | null>(null);

  // Custom Iframe-Safe Confirmation State
  const [confirmDialog, setConfirmDialog] = useState<{
    title: string;
    message: string;
    onConfirm: () => void;
    onCancel: () => void;
  } | null>(null);

  // Custom Detailed File Indexing Workflow Steps State
  const [uploadSteps, setUploadSteps] = useState<{
    currentStep: number;
    steps: { label: string; desc: string }[];
  } | null>(null);

  // Show customized toast helper
  const showToast = (message: string, type: 'success' | 'error' | 'info' = 'success') => {
    setToast({ message, type });
  };

  useEffect(() => {
    if (toast) {
      const timer = setTimeout(() => {
        setToast(null);
      }, 3500);
      return () => clearTimeout(timer);
    }
  }, [toast]);

  // Fetch Items from Firestore
  const fetchItems = async () => {
    if (!isFirebaseConfigured || !db) return;
    setLoading(true);
    try {
      const q = query(collection(db, 'knowledge'), orderBy('createdAt', 'desc'));
      const snapshot = await getDocs(q);
      setItems(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
    } catch (e) {
      console.error(e);
      showToast('Không thể kết nối đến Firestore. Vui lòng kiểm tra cấu hình.', 'error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (isOpen && isAuthenticated) {
      fetchItems();
    }
  }, [isOpen, isAuthenticated]);

  const handleLogin = (e: React.FormEvent) => {
    e.preventDefault();
    if (enteredPassword === ADMIN_PASSWORD) {
      setIsAuthenticated(true);
      setEnteredPassword('');
      showToast('Đăng nhập quản trị viên thành công', 'success');
    } else {
      showToast('Mật khẩu quản trị viên không chính xác!', 'error');
    }
  };

  // Safe file upload confirm trigger
  const triggerFileUpload = (file: File) => {
    setConfirmDialog({
      title: 'Xác nhận nạp tài liệu',
      message: `Tải lên và xử lý "${file.name}"? Hệ thống sẽ bóc tách văn bản, tự động cắt thành các phân đoạn 800 ký tự và tạo AI vector nhúng qua Gemini API để nạp vào kho RAG.`,
      onConfirm: () => {
        setConfirmDialog(null);
        executeFileUpload(file);
      },
      onCancel: () => {
        setConfirmDialog(null);
      }
    });
  };

  const executeFileUpload = async (file: File) => {
    setIsUploading(true);
    
    // Define the visual indexing steps for the RAG workflow
    const fileRAGSteps = [
      { label: 'Bóc tách tài liệu', desc: `Đang trích xuất nội dung văn bản từ file ${file.name}...` },
      { label: 'Phân tích & Cắt nhỏ', desc: 'Đang chia nhỏ nội dung thành các mảnh thông tin tối ưu (800 kí tự)...' },
      { label: 'AI Vectorization (Gemini)', desc: 'Đang khởi tạo mảng vector nhúng với model gemini-embedding-2-preview...' },
      { label: 'Đồng bộ Kho RAG', desc: 'Đang lưu trữ dữ liệu vĩnh viễn và liên kết chỉ mục vào cơ sở dữ liệu Firestore...' },
      { label: 'Hoàn tất!', desc: 'Tài liệu đã được biên dịch và nạp thành công vào hệ thống học tập AI.' }
    ];

    setUploadSteps({ currentStep: 0, steps: fileRAGSteps });

    const formData = new FormData();
    formData.append('file', file);
    formData.append('subjectId', activeSubject);
    formData.append('chapter', chapter.trim() || 'Tài liệu tải lên');

    try {
      // Simulate frontend steps for first two rapid processing stages (parsing file and chunking locally)
      setTimeout(() => {
        setUploadSteps(prev => prev ? { ...prev, currentStep: 1 } : null);
      }, 1200);

      setTimeout(() => {
        setUploadSteps(prev => prev ? { ...prev, currentStep: 2 } : null);
      }, 2500);

      const response = await fetch('/api/upload', {
        method: 'POST',
        body: formData,
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || 'Lỗi xử lý file từ phía máy chủ');
      }
      
      let result;
      try {
        result = await response.json();
      } catch (jsonErr) {
        throw new Error('Máy chủ phản hồi dữ liệu không đúng định dạng JSON.');
      }
      
      // Stage 3 & 4: Received embedding response, writing to Firebase
      setUploadSteps(prev => prev ? { ...prev, currentStep: 3 } : null);
      
      setTimeout(() => {
        setUploadSteps(prev => prev ? { ...prev, currentStep: 4 } : null);
      }, 1000);

      setTimeout(() => {
        setUploadSteps(null);
        showToast(`Tuyệt vời! Đã nạp thành công ${result.chunks} đoạn tri thức từ file vào kho RAG.`, 'success');
        setChapter('');
        fetchItems();
      }, 2500);

    } catch (e: any) {
      console.error(e);
      setUploadSteps(null);
      showToast(e.message || 'Lỗi xử lý file. Vui lòng đảm bảo cấu hình API Key và thử lại.', 'error');
    } finally {
      setIsUploading(false);
    }
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !isFirebaseConfigured || !db) return;
    
    // Trigger file checking / confirmation
    triggerFileUpload(file);
    if (e.target) e.target.value = '';
  };

  const handleManualAdd = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!content.trim() || !isFirebaseConfigured || !db) return;

    setSubmitting(true);
    try {
      // Since it is manual, we save it directly
      await addDoc(collection(db, 'knowledge'), {
        subjectId: activeSubject,
        chapter: chapter.trim() || 'Chương chung',
        content: content.trim(),
        createdAt: serverTimestamp(),
      });
      setContent('');
      setChapter('');
      showToast('Đã thêm một khối kiến thức trực tiếp vào kho RAG!', 'success');
      fetchItems();
    } catch (e) {
      console.error(e);
      showToast('Có lỗi xảy ra khi đồng bộ tài liệu thủ công.', 'error');
    } finally {
      setSubmitting(false);
    }
  };

  const triggerDelete = (id: string) => {
    setConfirmDialog({
      title: 'Xác nhận xóa tri thức',
      message: 'Bạn có chắc chắn muốn xóa vĩnh viễn mảnh tri thức này ra khỏi kho cơ sở dữ liệu RAG? AI sẽ không thể truy xuất thông tin này nữa.',
      onConfirm: () => {
        setConfirmDialog(null);
        executeDelete(id);
      },
      onCancel: () => {
        setConfirmDialog(null);
      }
    });
  };

  const executeDelete = async (id: string) => {
    if (!isFirebaseConfigured || !db) return;
    try {
      await deleteDoc(doc(db, 'knowledge', id));
      showToast('Đã gỡ bỏ tài liệu thành công!', 'success');
      fetchItems();
    } catch (e) {
      console.error(e);
      showToast('Không thể gỡ bỏ tài liệu.', 'error');
    }
  };

  const filteredItems = items.filter(item => {
    const term = searchQuery.toLowerCase();
    const contentMatch = item.content?.toLowerCase().includes(term);
    const chapterMatch = item.chapter?.toLowerCase().includes(term);
    const subMatch = SUBJECTS.find(s => s.id === item.subjectId)?.name.toLowerCase().includes(term);
    return contentMatch || chapterMatch || subMatch;
  });

  return (
    <div className="fixed bottom-4 right-4 z-50 flex flex-col items-end">
      {isOpen && (
        <div className="mb-4 w-[460px] max-w-[92vw] h-[82vh] max-h-[750px] bg-white dark:bg-gray-900 rounded-[2.5rem] shadow-2xl border border-gray-100 dark:border-gray-800/80 flex flex-col overflow-hidden animate-in slide-in-from-bottom-5 duration-300 relative">
          
          {/* Top Header */}
          <div className="px-6 py-4.5 border-b border-gray-100 dark:border-gray-800/60 flex items-center justify-between bg-blue-50/50 dark:bg-blue-950/20">
            <div className="flex items-center gap-2.5">
              <div className="p-2 bg-blue-500/10 dark:bg-blue-400/10 rounded-xl">
                <Database className="w-5 h-5 text-blue-600 dark:text-blue-400" />
              </div>
              <div>
                <h3 className="font-bold text-gray-900 dark:text-white text-base">Quản trị: Kho RAG</h3>
                <p className="text-[10px] text-gray-400 dark:text-gray-500 font-medium">Bơm tri thức & tài liệu kỹ thuật cho AI</p>
              </div>
            </div>
            <button 
              onClick={() => {
                setIsOpen(false);
                setIsAuthenticated(false);
              }}
              className="p-1.5 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-full text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 transition-colors"
            >
              <X size={18} />
            </button>
          </div>

          {!isFirebaseConfigured ? (
            <div className="p-8 text-center space-y-4 flex flex-col items-center justify-center flex-1">
              <div className="w-16 h-16 bg-amber-50 dark:bg-amber-950/20 rounded-full flex items-center justify-center mb-2 animate-pulse">
                <Database className="w-8 h-8 text-amber-500" />
              </div>
              <h4 className="font-bold text-gray-900 dark:text-white">Firestore Chưa Được Thiết Lập</h4>
              <p className="text-xs text-gray-500 dark:text-gray-400 max-w-sm leading-relaxed">
                Hệ thống RAG cần một cơ sở dữ liệu để tìm kiếm ngữ cảnh. Vui lòng nhấn nút <b className="text-blue-600 dark:text-blue-400">"Set up Firebase"</b> trong bảng điều khiển AI Studio của bạn để cấu hình.
              </p>
            </div>
          ) : !isAuthenticated ? (
            /* Secure Passcode Screen */
            <div className="p-8 flex flex-col justify-center flex-1 space-y-5">
              <div className="text-center">
                <div className="w-16 h-16 bg-blue-50 dark:bg-blue-950/20 rounded-3xl flex items-center justify-center mx-auto mb-4 rotate-3">
                  <Database className="w-8 h-8 text-blue-600 dark:text-blue-400" />
                </div>
                <h4 className="font-extrabold text-lg text-gray-900 dark:text-white tracking-tight">Khu Vực Hạn Chế</h4>
                <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">Xác minh mã nhận diện chuyên gia thiết kế</p>
              </div>
              <form onSubmit={handleLogin} className="space-y-4">
                <input 
                  type="password"
                  value={enteredPassword}
                  onChange={(e) => setEnteredPassword(e.target.value)}
                  placeholder="Nhập mã bảo mật..."
                  className="w-full p-3 px-4 rounded-2xl bg-gray-50 dark:bg-gray-800 text-gray-900 dark:text-white border-none text-sm focus:ring-2 focus:ring-blue-500/50 outline-none text-center font-mono placeholder:text-gray-400"
                  autoFocus
                />
                <button 
                  type="submit"
                  className="w-full py-3 bg-blue-600 hover:bg-blue-700 text-white rounded-2xl font-bold transition-all shadow-lg shadow-blue-500/10 hover:shadow-blue-500/20 cursor-pointer"
                >
                  Xác Thực Quản Trị
                </button>
              </form>
            </div>
          ) : (
            /* Admin Layout Console */
            <div className="flex flex-col flex-1 min-h-0 overflow-hidden bg-gray-50/30 dark:bg-gray-950/20">
              
              {/* Dual Tab Switcher */}
              <div className="flex border-b border-gray-100 dark:border-gray-800/50 bg-white/50 dark:bg-gray-900/40 p-2 gap-2">
                <button
                  type="button"
                  onClick={() => setAdminTab('import')}
                  className={cn(
                    "flex-1 py-2 text-xs font-bold rounded-xl transition-all cursor-pointer text-center",
                    adminTab === 'import' 
                      ? "bg-blue-600 text-white shadow-md shadow-blue-500/10" 
                      : "text-gray-500 hover:text-gray-900 dark:hover:text-white hover:bg-gray-100 dark:hover:bg-gray-800/40"
                  )}
                >
                  Nạp Tri Thức Mới
                </button>
                <button
                  type="button"
                  onClick={() => setAdminTab('browse')}
                  className={cn(
                    "flex-1 py-2 text-xs font-bold rounded-xl transition-all cursor-pointer text-center",
                    adminTab === 'browse' 
                      ? "bg-blue-600 text-white shadow-md shadow-blue-500/10" 
                      : "text-gray-500 hover:text-gray-900 dark:hover:text-white hover:bg-gray-100 dark:hover:bg-gray-800/40"
                  )}
                >
                  Duyệt Kho RAG ({items.length})
                </button>
              </div>

              {/* Scrollable Work Area */}
              <div className="flex-1 overflow-y-auto p-5 space-y-5 min-h-0">
                {adminTab === 'import' ? (
                  /* TAB 1: INNER WORKSPACE (IMPORT) */
                  <div className="space-y-4">
                    
                    {/* Choose Subject */}
                    <div>
                      <label className="block text-[10px] font-black text-gray-400 dark:text-gray-500 uppercase tracking-widest mb-1.5">Môn học áp dụng</label>
                      <select 
                        value={activeSubject}
                        onChange={(e) => setActiveSubject(e.target.value)}
                        className="w-full p-2.5 rounded-xl bg-white dark:bg-gray-800 border-none text-xs text-gray-700 dark:text-gray-300 font-medium shadow-sm ring-1 ring-gray-100 dark:ring-gray-800 outline-none focus:ring-2 focus:ring-blue-500/40"
                      >
                        {SUBJECTS.map(s => (
                          <option key={s.id} value={s.id}>{s.name}</option>
                        ))}
                      </select>
                    </div>

                    {/* Chapter / Topic Index */}
                    <div>
                      <label className="block text-[10px] font-black text-gray-400 dark:text-gray-500 uppercase tracking-widest mb-1.5">Phân loại chương / chủ đề</label>
                      <input 
                        value={chapter}
                        onChange={(e) => setChapter(e.target.value)}
                        placeholder="VD: Chương 1 - Dung sai hình học"
                        className="w-full p-2.5 rounded-xl bg-white dark:bg-gray-800 border-none text-xs text-gray-950 dark:text-white font-medium shadow-sm ring-1 ring-gray-100 dark:ring-gray-800 outline-none focus:ring-2 focus:ring-blue-500/40 placeholder:text-gray-400"
                      />
                    </div>

                    {/* Toggle Sub-input: File Upload vs Manual Copy-paste Text */}
                    <div className="pt-2 border-t border-gray-100 dark:border-gray-800/50">
                      <div className="flex justify-between items-center mb-3">
                        <span className="text-[10px] font-black text-gray-400 dark:text-gray-500 uppercase tracking-widest">Phương thức nạp</span>
                        <div className="flex gap-1 bg-gray-100/70 dark:bg-gray-800/50 p-0.5 rounded-lg text-[9px] font-bold">
                          <button
                            type="button"
                            onClick={() => setImportMode('file')}
                            className={cn("px-2 py-1 rounded-md transition-all cursor-pointer", importMode === 'file' ? "bg-white dark:bg-gray-700 text-blue-600 dark:text-white shadow-xs" : "text-gray-500")}
                          >
                            Tải file PDF/TXT
                          </button>
                          <button
                            type="button"
                            onClick={() => setImportMode('manual')}
                            className={cn("px-2 py-1 rounded-md transition-all cursor-pointer", importMode === 'manual' ? "bg-white dark:bg-gray-700 text-blue-600 dark:text-white shadow-xs" : "text-gray-500")}
                          >
                            Dán văn bản
                          </button>
                        </div>
                      </div>

                      {importMode === 'file' ? (
                        /* Drag and Drop style file upload box */
                        <div className="relative group">
                          <input 
                            type="file"
                            accept=".pdf,.docx,.txt"
                            onChange={handleFileUpload}
                            disabled={isUploading}
                            className="absolute inset-0 w-full h-full opacity-0 cursor-pointer disabled:cursor-not-allowed z-15"
                            title="Chọn file tài liệu"
                          />
                          <div className={cn(
                            "py-6 px-4 border-2 border-dashed rounded-2xl flex flex-col items-center justify-center gap-2 text-center transition-all",
                            isUploading 
                              ? "bg-blue-50/50 dark:bg-blue-950/20 border-blue-400/50" 
                              : "bg-white dark:bg-gray-800/30 border-gray-200 dark:border-gray-800 group-hover:border-blue-400 dark:group-hover:border-blue-800 cursor-pointer"
                          )}>
                            <div className="p-2 bg-gray-100 dark:bg-gray-800 rounded-xl text-gray-400 group-hover:text-blue-500 group-hover:scale-105 transition-all">
                              <FileText className="w-6 h-6" />
                            </div>
                            <div>
                              <span className="text-xs font-bold text-gray-700 dark:text-gray-300">Nhấn để chọn tập tin tài liệu</span>
                              <p className="text-[10px] text-gray-400 dark:text-gray-500 mt-1 font-medium">Hỗ trợ định dạng PDF, DOCX, TXT (Tối đa 10MB)</p>
                            </div>
                          </div>
                        </div>
                      ) : (
                        /* Manual Text Form input */
                        <form onSubmit={handleManualAdd} className="space-y-3">
                          <textarea 
                            value={content}
                            onChange={(e) => setContent(e.target.value)}
                            placeholder="Dán hoặc gõ nội dung tài liệu kỹ thuật dài cần ghi nhớ hoặc đồng bộ RAG..."
                            className="w-full p-3 h-28 rounded-2xl bg-white dark:bg-gray-800 border-none text-xs text-gray-950 dark:text-white font-medium shadow-sm ring-1 ring-gray-100 dark:ring-gray-800 outline-none focus:ring-2 focus:ring-blue-500/40 resize-none placeholder:text-gray-400"
                          />
                          <button 
                            type="submit"
                            disabled={submitting || !content.trim()}
                            className="w-full py-2.5 bg-blue-600 hover:bg-blue-700 disabled:opacity-40 disabled:hover:bg-blue-600 text-white rounded-xl text-xs font-extrabold flex items-center justify-center gap-2 transition-all shadow-md shadow-blue-500/10 cursor-pointer"
                          >
                            {submitting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus size={14} />}
                            Nạp trực tiếp vào kho
                          </button>
                        </form>
                      )}
                    </div>

                    <div className="p-3.5 bg-blue-50/50 dark:bg-blue-950/10 border border-blue-100/30 dark:border-blue-800/10 rounded-2xl flex items-start gap-2.5">
                      <Info className="w-4 h-4 text-blue-500 shrink-0 mt-0.5" />
                      <div className="text-[10px] text-gray-500 dark:text-gray-400 leading-relaxed font-semibold">
                        💡 Tài liệu nạp qua file sẽ được hệ thống băm nhỏ tự động để lưu trữ hiệu quả. Trợ lý AI sẽ tự động phân tích và lấy dữ liệu này làm cơ sở ưu tiên khi các bạn học sinh đặt câu hỏi kỹ thuật bên ngoài.
                      </div>
                    </div>

                  </div>
                ) : (
                  /* TAB 2: DATA BROWSER (BROWSE) */
                  <div className="space-y-3">
                    
                    {/* Search Field */}
                    <div className="relative">
                      <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                      <input 
                        type="text"
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        placeholder="Tìm kiếm tài liệu nạp..."
                        className="w-full pl-9 pr-4 py-2 bg-white dark:bg-gray-800 rounded-xl text-xs text-gray-900 dark:text-white border-none shadow-sm ring-1 ring-gray-100 dark:ring-gray-800 outline-none focus:ring-2 focus:ring-blue-500/40 font-semibold"
                      />
                      {searchQuery && (
                        <button 
                          onClick={() => setSearchQuery('')}
                          className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 rounded-full"
                        >
                          <X size={12} />
                        </button>
                      )}
                    </div>

                    {/* Scrolling Collection View */}
                    <div className="space-y-2.5">
                      {loading ? (
                        <div className="flex flex-col items-center justify-center py-12 gap-2">
                          <Loader2 className="w-6 h-6 animate-spin text-blue-600 dark:text-blue-400" />
                          <span className="text-xs text-gray-400 font-semibold tracking-wide uppercase">Đang đồng bộ...</span>
                        </div>
                      ) : filteredItems.length === 0 ? (
                        <div className="text-center py-12 px-4 border border-dashed border-gray-100 dark:border-gray-800 rounded-2xl">
                          <p className="text-gray-400 dark:text-gray-500 text-xs italic font-medium">
                            {searchQuery ? 'Không tìm thấy tài liệu phù hợp trong kho.' : 'Kho trống hoặc chưa có dữ liệu nào.'}
                          </p>
                        </div>
                      ) : (
                        filteredItems.map(item => (
                          <div key={item.id} className="p-4 bg-white dark:bg-gray-800 rounded-2xl shadow-sm hover:shadow-md border border-gray-100 dark:border-gray-800/80 group hover:border-blue-200 dark:hover:border-blue-900/40 transition-all flex flex-col gap-2 relative">
                            <div className="flex justify-between items-start gap-3">
                              <div className="flex flex-wrap gap-1.5 leading-none">
                                <span className="px-2 py-1 bg-blue-50 dark:bg-blue-950/40 text-blue-600 dark:text-blue-400 text-[8px] font-black rounded-lg uppercase tracking-wider">
                                  {SUBJECTS.find(s => s.id === item.subjectId)?.name || item.subjectId}
                                </span>
                                {item.chapter && (
                                  <span className="px-2 py-1 bg-gray-100 dark:bg-gray-700/60 text-gray-500 dark:text-gray-400 text-[8px] font-bold rounded-lg uppercase tracking-wide">
                                    {item.chapter}
                                  </span>
                                )}
                              </div>
                              <button 
                                onClick={() => triggerDelete(item.id)}
                                className="p-1 hover:bg-red-50 dark:hover:bg-red-950/20 rounded-md text-gray-400 hover:text-red-500 focus:text-red-500 sm:opacity-0 group-hover:opacity-100 transition-all cursor-pointer"
                                title="Xóa tài liệu"
                              >
                                <Trash2 size={13} />
                              </button>
                            </div>
                            <p className="text-xs text-gray-600 dark:text-gray-300 leading-relaxed font-medium line-clamp-4">
                              {item.content}
                            </p>
                            {item.embedding && (
                              <div className="flex items-center gap-1 mt-1 text-[8px] text-green-600 dark:text-green-400 font-bold uppercase tracking-widest">
                                <Check size={10} className="stroke-[3px]" /> Đã Nhúng Embedding ({item.embedding.length}D)
                              </div>
                            )}
                          </div>
                        ))
                      )}
                    </div>

                  </div>
                )}
              </div>

            </div>
          )}

          {/* CUSTOM MODAL OVERLAYS */}
          
          {/* Custom Confirmation / Alert */}
          {confirmDialog && (
            <div className="absolute inset-0 bg-black/60 backdrop-blur-xs flex items-center justify-center p-6 z-40 animate-in fade-in duration-250">
              <div className="bg-white dark:bg-gray-900 rounded-[2rem] p-6 max-w-[360px] w-full shadow-2xl space-y-4 border border-gray-100 dark:border-gray-800 scale-in duration-200">
                <div className="w-12 h-12 bg-blue-50 dark:bg-blue-950/20 rounded-2xl flex items-center justify-center text-blue-600 dark:text-blue-400">
                  <Database size={24} />
                </div>
                <div className="space-y-1">
                  <h4 className="font-extrabold text-gray-900 dark:text-white text-base tracking-tight">{confirmDialog.title}</h4>
                  <p className="text-xs text-gray-500 dark:text-gray-400 leading-relaxed font-semibold">{confirmDialog.message}</p>
                </div>
                <div className="flex gap-2.5 pt-2">
                  <button 
                    type="button"
                    onClick={confirmDialog.onCancel}
                    className="flex-1 py-2.5 bg-gray-100 hover:bg-gray-200 dark:bg-gray-800 dark:hover:bg-gray-700/80 text-gray-700 dark:text-gray-300 rounded-xl font-bold text-xs cursor-pointer transition-colors"
                  >
                    Hủy
                  </button>
                  <button 
                    type="button"
                    onClick={confirmDialog.onConfirm}
                    className="flex-1 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl font-bold text-xs cursor-pointer transition-colors"
                  >
                    Xác Nhận
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* CUSTOM STEPS / WORKFLOW INDEXING INDICATOR */}
          {uploadSteps && (
            <div className="absolute inset-0 bg-white/95 dark:bg-gray-950/95 flex flex-col justify-center p-8 z-30 animate-in fade-in duration-300">
              <div className="space-y-6 max-w-sm mx-auto w-full">
                <div className="space-y-2 text-center">
                  <div className="inline-flex p-3 bg-blue-500/10 rounded-2xl text-blue-600 animate-bounce mb-1">
                    <Database size={28} />
                  </div>
                  <h3 className="font-extrabold text-lg text-gray-900 dark:text-white tracking-tight">RAG WORKFLOW ENGINES</h3>
                  <p className="text-[10px] text-blue-600 dark:text-blue-400 uppercase tracking-[0.2em] font-black">Hồ sơ tiến trình số hóa dữ liệu</p>
                </div>

                {/* Progress Steps List */}
                <div className="space-y-4">
                  {uploadSteps.steps.map((step, idx) => {
                    const isDone = idx < uploadSteps.currentStep;
                    const isActive = idx === uploadSteps.currentStep;
                    const isLast = idx === uploadSteps.steps.length - 1;
                    return (
                      <div key={idx} className="flex gap-3 relative items-start">
                        {/* Vertical line connector */}
                        {!isLast && (
                          <div className={cn(
                            "absolute left-2.5 top-6 w-[2px] h-8 -ml-[1px]",
                            isDone ? "bg-green-500" : "bg-gray-100 dark:bg-gray-800"
                          )} />
                        )}
                        <div className={cn(
                          "w-5 h-5 rounded-full shrink-0 flex items-center justify-center text-[10px] font-bold transition-all relative z-10",
                          isDone ? "bg-green-500 text-white" : isActive ? "bg-blue-600 text-white shadow-md shadow-blue-500/20" : "bg-gray-100 dark:bg-gray-850 text-gray-400"
                        )}>
                          {isDone ? <Check size={10} className="stroke-[3px]" /> : idx + 1}
                        </div>
                        <div className="space-y-0.5">
                          <h4 className={cn(
                            "text-xs font-bold transition-colors leading-none",
                            isDone ? "text-green-500" : isActive ? "text-blue-600 dark:text-blue-400" : "text-gray-400"
                          )}>
                            {step.label}
                          </h4>
                          {(isActive || isDone) && (
                            <p className="text-[9px] text-gray-400 leading-normal animate-in fade-in duration-300">
                              {step.desc}
                            </p>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>

                {/* Simulated active workflow action loader */}
                <div className="pt-2 flex items-center justify-center gap-2">
                  {uploadSteps.currentStep < 4 ? (
                    <>
                      <Loader2 className="w-3.5 h-3.5 animate-spin text-blue-500" />
                      <span className="text-[10px] font-bold text-gray-500 animate-pulse tracking-wide uppercase">Cấu trúc nhúng đang chạy...</span>
                    </>
                  ) : (
                    <div className="flex items-center gap-1.5 text-green-500 text-[10px] font-extrabold tracking-wide uppercase">
                      <CheckCircle size={14} /> Quy trình hoàn thiện thành công!
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* Real-time custom Toast styling */}
          {toast && (
            <div className="absolute top-4 left-4 right-4 z-55 animate-in slide-in-from-top-4 duration-300">
              <div className={cn(
                "p-3.5 px-4 rounded-2xl shadow-xl border flex items-center gap-3",
                toast.type === 'success' && "bg-emerald-50 dark:bg-emerald-950/90 border-emerald-100 dark:border-emerald-800/50 text-emerald-800 dark:text-emerald-300",
                toast.type === 'error' && "bg-rose-50 dark:bg-rose-950/90 border-rose-100 dark:border-rose-900/50 text-rose-800 dark:text-rose-300",
                toast.type === 'info' && "bg-blue-50 dark:bg-blue-950/90 border-blue-100 dark:border-blue-900/50 text-blue-800 dark:text-blue-300"
              )}>
                {toast.type === 'success' && <CheckCircle className="w-4 h-4 shrink-0" />}
                {toast.type === 'error' && <AlertCircle className="w-4 h-4 shrink-0 animate-bounce" />}
                {toast.type === 'info' && <Info className="w-4 h-4 shrink-0" />}
                <p className="text-xs font-bold leading-normal">{toast.message}</p>
              </div>
            </div>
          )}

        </div>
      )}
    </div>
  );
};
