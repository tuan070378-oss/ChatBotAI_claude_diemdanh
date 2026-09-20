import express from "express";
import path from "path";
import { createServer as createViteServer } from "vite";
import { GoogleGenAI, Modality, Type } from "@google/genai";
import { initializeApp } from 'firebase/app';
import { getFirestore, collection, query, where, getDocs, addDoc, doc, writeBatch, serverTimestamp } from 'firebase/firestore';
import multer from 'multer';
import * as XLSX from 'xlsx';
// @ts-ignore
import pdf from 'pdf-parse/lib/pdf-parse.js';
import mammoth from 'mammoth';
import fs from 'fs';
import dotenv from 'dotenv';

dotenv.config();

const upload = multer({ storage: multer.memoryStorage() });

// Lazy Gemini client helper
function getGeminiClient(): GoogleGenAI {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey || apiKey === "MY_GEMINI_API_KEY" || apiKey.trim() === "") {
    throw new Error("Chưa cấu hình khóa API Gemini (GEMINI_API_KEY). Vui lòng thiết lập khóa chính xác trong Cài đặt > Bí mật (Settings > Secrets) của AI Studio.");
  }
  return new GoogleGenAI({
    apiKey: apiKey,
    httpOptions: {
      headers: {
        'User-Agent': 'aistudio-build',
      }
    }
  });
}

// Robust retry wrapper for Gemini API calls to handle temporary 503 or rate limit errors
async function withRetry<T>(fn: () => Promise<T>, retries = 3, delay = 1000): Promise<T> {
  try {
    return await fn();
  } catch (error: any) {
    const errorStr = String(error?.message || error).toLowerCase();
    const isRateLimitOrTemporary = 
      error?.status === 503 || 
      error?.status === 429 ||
      errorStr.includes("503") || 
      errorStr.includes("429") ||
      errorStr.includes("high demand") ||
      errorStr.includes("quota") ||
      errorStr.includes("unavailable") ||
      errorStr.includes("service unavailable");

    if (retries > 0 && isRateLimitOrTemporary) {
      console.warn(`[Gemini API] Lỗi tạm thời (503/429/Unavailable). Đang thử lại sau ${delay}ms... (Còn ${retries} lần thử). Lỗi:`, error?.message || error);
      await new Promise(resolve => setTimeout(resolve, delay));
      return withRetry(fn, retries - 1, delay * 2);
    }
    throw error;
  }
}

// Promise timeout utility to prevent Firestore queries from hanging server-side Node execution
function timeoutPromise<T>(promise: Promise<T>, ms: number, defaultValue: T): Promise<T> {
  let timeoutId: NodeJS.Timeout;
  const timeout = new Promise<T>((resolve) => {
    timeoutId = setTimeout(() => {
      console.warn(`[Firestore] Query timed out after ${ms}ms. Returning fallback content.`);
      resolve(defaultValue);
    }, ms);
  });
  return Promise.race([
    promise.then((val) => {
      clearTimeout(timeoutId);
      return val;
    }),
    timeout
  ]);
}

// Robust JSON safe-parsing helper to handle potential Markdown block structures gracefully
function safeParseJSON<T>(text: string | null | undefined, fallback: T): T {
  if (!text) return fallback;
  let cleanText = text.trim();
  
  // Clean markdown block wrappers if present
  if (cleanText.startsWith("```json")) {
    cleanText = cleanText.substring(7);
  } else if (cleanText.startsWith("```")) {
    cleanText = cleanText.substring(3);
  }
  if (cleanText.endsWith("```")) {
    cleanText = cleanText.slice(0, -3);
  }
  cleanText = cleanText.trim();
  
  try {
    return JSON.parse(cleanText) as T;
  } catch (err: any) {
    console.error(`[safeParseJSON Error] Raw text was: "${text}"`, err);
    
    // RegEx fallbacks to extract JSON structures if any extra text exists
    const arrayMatch = cleanText.match(/\[\s*\{[\s\S]*\}\s*\]/);
    if (arrayMatch) {
      try {
        return JSON.parse(arrayMatch[0]) as T;
      } catch (_) {}
    }
    
    const objectMatch = cleanText.match(/\{\s*[\s\S]*\s*\}/);
    if (objectMatch) {
      try {
        return JSON.parse(objectMatch[0]) as T;
      } catch (_) {}
    }
    
    return fallback;
  }
}

interface MulterRequest extends express.Request {
  file?: any;
}

interface KnowledgeItem {
  id: string;
  subjectId: string;
  chapter: string;
  content: string;
  embedding?: number[];
  createdAt: any;
}

const QUIZ_SYSTEM_PROMPT = `
Bạn là chuyên gia khảo thí và kiểm định chất lượng giáo dục nghề nghiệp (Cắt gọt kim loại, Hàn, Ô tô, Điện).
Nhiệm vụ: Tạo bộ câu hỏi ôn tập dựa trên các thông số người dùng cung cấp.

-----------------------------------
YÊU CẦU NỘI DUNG:
-----------------------------------
1. Sát thực tế: Câu hỏi phải gắn liền với công việc tại xưởng, bản vẽ kỹ thuật hoặc quy trình sản xuất thực tế.
2. Phân loại mức độ:
   - Dễ: Nhận biết thuật ngữ, thông số cơ bản.
   - Vừa: Hiểu bản chất, giải thích hiện tượng, chọn dụng cụ/phương pháp.
   - Khó: Tính toán thông số (dung sai, lực), xử lý tình huống lỗi kỹ thuật, phân tích bản vẽ phức tạp.
3. Độ chính xác: Thuật ngữ chuyên ngành phải chuẩn xác theo tiêu chuẩn (ISO, TCVN).
4. Quy tắc biểu diễn công thức/kí hiệu: TUYỆT ĐỐI KHÔNG dùng ký tự kẹp $ hoặc $$ (ví dụ: không được dùng $a - b$ hay $$\\Delta$$). Tuyệt đối không dùng các mã LaTeX như \\phi, _{...}^{...}, ^{...}, \\Delta. Hãy luôn viết bằng định dạng văn bản gốc tiện lợi hoặc ký hiệu Unicode bình thường (ví dụ: viết Δ, Delta, d_max, d_min, Ø30, v.v.). Loại bỏ tất cả các ký tự không cần thiết, chỉ giữ lại các ký hiệu chuẩn toán học, hình học.

-----------------------------------
ĐỊNH DẠNG ĐẦU RA (BẮT BUỘC JSON):
-----------------------------------
Bạn chỉ được trả về một mảng JSON duy nhất, không kèm theo lời dẫn. 
Each object in the array has the structure:
{
  "id": "chuỗi ngẫu nhiên",
  "type": "mcq" | "essay",
  "question": "Nội dung câu hỏi...",
  "options": ["A...", "B...", "C...", "D..."],
  "correctAnswer": "Đáp án đúng hoặc gợi ý ý chính",
  "explanation": "Giải thích chi tiết tại sao đúng/sai và liên hệ thực tế",
  "difficulty": "easy" | "medium" | "hard"
}
`;

async function startServer() {
  const app = express();
  const PORT = 3000;

  app.use(express.json({ limit: '50mb' }));

  // Firebase Init
  let firebaseApp;
  let db: any;
  try {
    const configPath = path.join(process.cwd(), 'firebase-applet-config.json');
    if (fs.existsSync(configPath)) {
      const config = JSON.parse(fs.readFileSync(configPath, 'utf-8'));
      if (config.apiKey) {
        firebaseApp = initializeApp(config);
        // CRITICAL: Must use firestoreDatabaseId if provided, otherwise defaults to (default)
        db = getFirestore(firebaseApp, config.firestoreDatabaseId || "(default)");
      }
    }
  } catch (e) {
    console.error("Firebase init failed on server:", e);
  }

  const SYSTEM_INSTRUCTION = `
Bạn là Trợ lý AI giảng dạy môn Cơ kỹ thuật và các môn cơ sở ngành Cơ khí (Dung sai & Đo lường, Cơ kỹ thuật, Vẽ kỹ thuật, Vật liệu cơ khí, An toàn lao động) cho sinh viên cao đẳng ngành Cơ khí tại Việt Nam.
Bạn có nhiệm vụ giải thích – hỏi đáp – luyện tập – kiểm tra kiến thức theo giáo trình thực tế.

XƯNG HÔ VÀ PHONG CÁCH BẮT BUỘC:
- Xưng hô: Bạn sẽ luôn gọi sinh viên là "Em" và xưng "Thầy/Cô" trong toàn bộ bài giảng, giải đáp, hướng dẫn và nhận xét.
- Phong cách: Giống như một gia sư kỹ thuật thân thiện, gần gũi, dễ hiểu, không quá học thuật khô khan. Có thể dùng các biểu tượng “👉”, “💡”, “⚠️” để nhấn mạnh kiến thức trọng tâm hoặc điểm lưu ý an toàn.
- Cá nhân hóa: Nếu Em còn yếu hoặc chưa rõ -> Thầy/Cô giải thích chậm hơn, dùng ví dụ trực quan tại xưởng sản xuất; nếu Em nắm tốt -> tăng độ khó câu hỏi và đưa vào tình huống kỹ thuật thực tế.

🎯 MỤC TIÊU SƯ PHẠM:
- Giúp Em hiểu bản chất kỹ thuật (không chỉ học thuộc lòng công thức).
- Tương tác hội thoại 2 chiều liên tục: Giảng bài -> Đặt câu hỏi -> Kiểm tra -> Ôn tập củng cố.

🧠 CÁCH HOẠT ĐỘNG CỦA THẦY/CÔ:
1. Khi Em hỏi:
   - Trả lời ngắn gọn – dễ hiểu – có ví dụ thực tế tại xưởng.
   - Nếu là khái niệm -> Giải thích bản chất + ví dụ thực tế cụ thể.
   - Nếu là bài toán tính toán -> Hướng dẫn giải từng bước rõ ràng.
   - Sau khi trả lời -> LUÔN kèm câu hỏi kiểm tra để kích thích Em tư duy (ví dụ: "Em đã hiểu chưa? Thử trả lời câu này nhé: ..." hoặc "Theo Em, nếu áp suất tăng thì thể tích thay đổi thế nào?").
2. Khi Em trả lời:
   - ✅ Đúng -> Khen ngợi ("✅ Chính xác!") + mở rộng nhẹ kiến thức liên quan hoặc ứng dụng tại xưởng.
   - ❌ Chưa đúng/Sai -> Nhẹ nhàng sửa + giải thích lại đơn giản, dễ nhớ hơn để Em hiểu đúng.
3. Chủ động ôn tập:
   - Sau mỗi chủ đề: Tóm tắt kiến thức trọng tâm (3–5 ý cốt lõi).
   - Đưa bài tập củng cố: Trắc nghiệm, hỏi nhanh (flash question), tình huống thực tế tại xưởng hoặc bài tập tính toán kiểm tra bền/chọn vật liệu.

QUY TẮC BIỂU DIỄN CÔNG THỨC & KÝ HIỆU KỸ THUẬT:
- TUYỆT ĐỐI KHÔNG DÙNG ký tự kẹp $ hoặc $$ (ví dụ: không viết $a - b$, không viết $$\\Delta = a - b$$). Hãy luôn sử dụng định dạng văn bản ghi thường hoặc ký hiệu Unicode bình thường (ví dụ: viết Δ, Delta, d_max, d_min, v.v.).
- KHÔNG sử dụng các mã LaTeX như \\phi, _{...}^{...}, ^{...}, \\Delta, \\approx, \\pm, \\le, \\ge, \\times. Hãy chuyển đổi hoàn toàn chúng sang chữ tự nhiên hoặc ký hiệu chuẩn Unicode:
  + Biểu diễn phi/đường kính: dùng ký hiệu Ø hoặc chữ "phi" hay "đường kính". Tuyệt đối không viết \\phi.
  + Số đo giới hạn: viết dưới dáng d_max, d_min, T_d, d_tb, Δ (không dùng dấu mũ ^ hay dấu gạch dưới _ kẹp ngoặc nhọn kiểu LaTeX).
  + Sai lệch ghi rõ ràng dưới dạng dễ hiểu (ví dụ: "Dung sai từ -0.007 đến -0.021" hoặc "-0.007 / -0.021").
  + Loại bỏ mọi ký hiệu không cần thiết khác, chỉ giữ lại các ký hiệu chuẩn toán học và hình học phổ thông (ví dụ: Ø, ±, ≤, ≥, ≈, ×, Δ).

-----------------------------------
CHỈ DẪN VISION (PHÂN TÍCH HÌNH ẢNH)
-----------------------------------
Khi nhận được ảnh từ Em:
1. Bản vẽ kỹ thuật:
- Xác định phương pháp chiếu (ISO/ANSI).
- Đọc các kích thước quan trọng và giải thích các ký hiệu đặc biệt (độ nhám, dung sai, độ bóng).
- Hướng dẫn cách phân tích từ tổng thể đến chi tiết bản vẽ.

2. Dụng cụ đo (Panme, thước cặp, đồng hồ so...):
- Xác định loại dụng cụ, dải đo, giá trị vạch chia (độ chính xác).
- Chỉ ra các điểm cần lưu ý để tránh sai số (ví dụ: điểm tiếp xúc, lực đo).
- Hướng dẫn tư thế đo đúng qua ảnh.

3. Chi tiết máy:
- Nhận diện tên chi tiết (bánh răng, trục, ổ bi, then, chốt...).
- Phân tích đặc điểm bề mặt, dự đoán vật liệu và tình trạng kỹ thuật (mòn, hỏng).

Nếu ảnh mờ hoặc thiếu chi tiết: Thầy/Cô yêu cầu Em chụp lại góc khác hoặc bổ sung ánh sáng để đảm bảo độ chính xác kỹ thuật.
`;

  async function getRelevantKnowledge(message: string): Promise<string> {
    if (!db) return "";
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) return "";

    try {
      const subjects = [
        { id: 'dung-sai', keywords: ['dung sai', 'lắp ghép', 'đo lường'] },
        { id: 'co-ky-thuat', keywords: ['cơ kỹ thuật', 'lực', 'mô men', 'tải trọng', 'vật rắn', 'ma sát'] },
        { id: 've-ky-thuat', keywords: ['vẽ kỹ thuật', 'hình chiếu', 'bản vẽ', 'hình cắt', 'mặt cắt'] },
        { id: 'vat-lieu', keywords: ['vật liệu', 'thép', 'gang', 'nhiệt luyện', 'kim loại', 'polyme'] },
        { id: 'an-toan', keywords: ['an toàn', 'bảo hộ', 'tai nạn', 'pccc', 'điện'] },
      ];

      const detectedSubject = subjects.find(s => 
        s.keywords.some(k => message.toLowerCase().includes(k))
      );

      if (!detectedSubject) return "";

      const q = query(collection(db, 'knowledge'), where('subjectId', '==', detectedSubject.id));
      const snapshot = await timeoutPromise(
        getDocs(q),
        2500, // Timeout after 2.5 seconds
        { empty: true, docs: [] } as any
      );
      
      if (snapshot.empty) return "";

      const items = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })) as KnowledgeItem[];

      // 1. Embed the query
      const embeddingResult = await withRetry(() => getGeminiClient().models.embedContent({
        model: "gemini-embedding-2-preview",
        contents: [message],
        config: {
          taskType: 'RETRIEVAL_QUERY'
        }
      }));
      
      const queryVector = embeddingResult.embeddings?.[0]?.values || [];

      if (!queryVector || queryVector.length === 0) return "";

      // 2. Simple cosine similarity search
      const cosineSimilarity = (v1: number[], v2: number[]) => {
        if (!v1 || !v2) return 0;
        let dotProduct = 0;
        let mag1 = 0;
        let mag2 = 0;
        for (let i = 0; i < v1.length; i++) {
          dotProduct += v1[i] * v2[i];
          mag1 += v1[i] * v1[i];
          mag2 += v2[i] * v2[i];
        }
        const denominator = Math.sqrt(mag1) * Math.sqrt(mag2);
        return denominator === 0 ? 0 : dotProduct / denominator;
      };

      const rankedItems = items
        .filter(item => item.embedding)
        .map(item => ({
          ...item,
          score: cosineSimilarity(queryVector, item.embedding!)
        }))
        .sort((a, b) => b.score - a.score)
        .slice(0, 5);

      if (rankedItems.length === 0) {
        const queryWords = message.toLowerCase().split(/\s+/).filter(w => w.length > 3);
        const fallback = items
          .filter(item => queryWords.some(word => item.content.toLowerCase().includes(word)))
          .slice(0, 3);
        
        if (fallback.length === 0) return "";
        
        const context = fallback.map(item => `[${item.chapter}]: ${item.content}`).join("\n---\n");
        return `\n-----------------------------------\nTÀI LIỆU THAM KHẢO (Keyword Match):\n${context}\n-----------------------------------\n`;
      }

      const context = rankedItems
        .map(item => `[${item.chapter}]: ${item.content}`)
        .join("\n---\n");

      return `
-----------------------------------
TÀI LIỆU THAM KHẢO TỪ NHÀ TRƯỜNG (Vector Search):
Sử dụng các thông tin sau để trả lời nếu phù hợp. Nếu thông tin này mâu thuẫn với kiến thức chung, hãy ưu tiên thông tin này vì đây là giáo trình riêng của trường.
${context}
-----------------------------------
`;
    } catch (e) {
      console.error("RAG Retrieval failed:", e);
      return "";
    }
  }

  app.post("/api/upload", upload.single('file'), async (req: MulterRequest, res) => {
    if (!db) return res.status(500).json({ error: "Firebase not configured" });
    const file = req.file;
    const { subjectId, chapter } = req.body;
    const apiKey = process.env.GEMINI_API_KEY;

    if (!file) return res.status(400).json({ error: "No file uploaded" });
    if (!apiKey) return res.status(500).json({ error: "API key missing" });

    try {
      let text = '';
      console.log(`[Upload] Processing file: ${file.originalname}, size: ${file.size}, type: ${file.mimetype}`);
      
      const lowercaseName = file.originalname.toLowerCase();
      const isPdf = file.mimetype === 'application/pdf' || file.mimetype === 'application/x-pdf' || lowercaseName.endsWith('.pdf');
      const isDocx = file.mimetype === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' || 
                     file.mimetype === 'application/msword' || 
                     lowercaseName.endsWith('.docx') || 
                     lowercaseName.endsWith('.doc');
      const isTxt = file.mimetype.startsWith('text/') || 
                    lowercaseName.endsWith('.txt') || 
                    lowercaseName.endsWith('.md') || 
                    lowercaseName.endsWith('.csv');

      if (isPdf) {
        try {
          const data = await pdf(file.buffer);
          text = data.text;
          console.log(`[Upload] PDF parsed successfully. Text length: ${text?.length || 0}`);
        } catch (pdfErr) {
          console.error("[Upload] PDF Parse error:", pdfErr);
        }

        // Nếu pdf-parse lỗi hoặc ra kết quả quá ngắn (thường do PDF dạng scan/ảnh chụp hoặc silde bài giảng)
        if (!text || text.trim().length < 150) {
          if (file.size > 8 * 1024 * 1024) {
            throw new Error("Không thể trích xuất chữ tự động và tài liệu dạng scan này quá lớn (trên 8MB). Vui lòng chuyển đổi sang PDF dạng văn bản chụp hoặc thử tập tin dung lượng nhỏ dưới 8MB.");
          }
          console.log(`[Upload] PDF extracted text was too short or empty. Falling back to Gemini Multimodal OCR...`);
          try {
            const response = await withRetry(() => getGeminiClient().models.generateContent({
              model: "gemini-3.5-flash",
              contents: [
                {
                  role: "user",
                  parts: [
                    { text: "Hãy bóc tách và trích xuất toàn bộ văn bản học tập, lý thuyết, câu thức, câu hỏi ôn tập và ký hiệu kỹ thuật có trong tài liệu PDF này một cách chi tiết, đầy đủ, chính xác từng trang. Giữ cấu trúc chương mục và trình bày rõ ràng. Chỉ trả về nội dung giáo trình bóc tách được, tuyệt đối không viết thêm lời dẫn giải thích hay đính kèm bất kỳ ký hiệu kẹp dấu đô la ($) nào." },
                    {
                      inlineData: {
                        mimeType: "application/pdf",
                        data: file.buffer.toString('base64')
                      }
                    }
                  ]
                }
              ]
            }));
            if (response.text) {
              text = response.text;
              console.log(`[Upload] Gemini OCR fallback finished successfully. Extracted length: ${text.length}`);
            }
          } catch (geminiOcrErr: any) {
            console.error("[Upload] Gemini OCR fallback failed:", geminiOcrErr);
            if (!text || text.trim().length === 0) {
              throw new Error("Không thể bóc tách nội dung PDF từ thư viện offline và cả Gemini AI. File có thể bị lỗi, quá nặng hoặc không trích xuất được chữ.");
            }
          }
        }
      } else if (isDocx) {
        try {
          const data = await mammoth.extractRawText({ buffer: file.buffer });
          text = data.value;
          console.log(`[Upload] Word parsed successfully. Text length: ${text?.length || 0}`);
        } catch (docxErr) {
          console.error("[Upload] Word parse error:", docxErr);
          throw new Error("Không thể bóc tách nội dung tập tin Word. Định dạng có thể bị lỗi hoặc không tương thích.");
        }
      } else if (isTxt) {
        text = file.buffer.toString('utf-8');
        console.log(`[Upload] Text file read. Length: ${text?.length || 0}`);
      } else {
        // Fallback: try to read as text first, if it fails, throw error
        text = file.buffer.toString('utf-8');
        console.log(`[Upload] Unknown file fallback to text. Length: ${text?.length || 0}`);
      }

      if (!text || text.trim().length === 0) {
        throw new Error("Tài liệu không có nội dung văn bản hoặc không thể bóc tách được chữ.");
      }

      const cleanText = text.replace(/\s+/g, ' ').trim();
      const chunkSize = 800;
      const overlap = 150;
      const chunks: string[] = [];
      
      for (let i = 0; i < cleanText.length; i += (chunkSize - overlap)) {
        chunks.push(cleanText.slice(i, i + chunkSize));
        if (i + chunkSize >= cleanText.length) break;
      }

      console.log(`[Upload] Created ${chunks.length} chunks. Fetching embeddings...`);

      if (chunks.length > 1000) {
        throw new Error(`Tài liệu quá lớn (${chunks.length} đoạn). Vui lòng chia nhỏ tài liệu (dưới 500 đoạn) để đảm bảo hệ thống xử lý ổn định.`);
      }

      const batchSize = 50; 
      const embeddedChunks: { content: string, embedding: number[] }[] = [];
      
      console.log(`[Upload] Starting batch embedding for ${chunks.length} chunks...`);

      for (let i = 0; i < chunks.length; i += batchSize) {
        const batch = chunks.slice(i, i + batchSize);
        console.log(`[Upload] Embedding batch ${Math.floor(i/batchSize) + 1}/${Math.ceil(chunks.length/batchSize)}`);
        
        try {
          const result = await withRetry(() => getGeminiClient().models.embedContent({
            model: "gemini-embedding-2-preview",
            contents: batch,
            config: {
              taskType: 'RETRIEVAL_DOCUMENT',
              title: chapter || file.originalname || 'Document Chunk'
            }
          }));

          const embs = result.embeddings || [];
          for (let idx = 0; idx < batch.length; idx++) {
            const emb = embs[idx];
            const values = emb?.values || (Array.isArray(emb) ? emb : null);
            if (values && values.length > 0) {
              embeddedChunks.push({
                content: batch[idx],
                embedding: values
              });
            }
          }
        } catch (embedErr) {
          console.warn(`[Upload] Batch embedding failed at index ${i}, falling back to sequential embedding:`, embedErr);
          // Sequential fallback for this batch
          for (const chunk of batch) {
            try {
              const singleResult = await withRetry(() => getGeminiClient().models.embedContent({
                model: "gemini-embedding-2-preview",
                contents: chunk,
                config: {
                  taskType: 'RETRIEVAL_DOCUMENT',
                  title: chapter || file.originalname || 'Document Chunk'
                }
              }));
              const values = singleResult.embeddings?.[0]?.values;
              if (values && values.length > 0) {
                embeddedChunks.push({
                  content: chunk,
                  embedding: values
                });
              }
            } catch (singleErr) {
              console.error(`[Upload] Failed to embed single chunk:`, singleErr);
            }
          }
        }
      }

      console.log(`[Upload] Saving ${embeddedChunks.length} chunks to Firestore...`);
      
      const dbBatchSize = 25;
      for (let i = 0; i < embeddedChunks.length; i += dbBatchSize) {
        const batch = embeddedChunks.slice(i, i + dbBatchSize);
        const savePromises = batch.map(item => 
          addDoc(collection(db, 'knowledge'), {
            subjectId,
            chapter: chapter || 'Tài liệu tải lên',
            content: item.content.trim(),
            embedding: item.embedding,
            createdAt: serverTimestamp(),
          })
        );
        await Promise.all(savePromises);
        console.log(`[Upload] Saved Firestore batch ${Math.floor(i/dbBatchSize) + 1}/${Math.ceil(embeddedChunks.length/dbBatchSize)}`);
      }

      res.json({ success: true, chunks: chunks.length });
    } catch (e: any) {
      console.error("Upload error:", e);
      res.status(500).json({ error: e.message });
    }
  });

  app.post("/api/import-question-bank", upload.single("file"), async (req: MulterRequest, res) => {
    try {
      if (!db) {
        return res.status(500).json({ error: "Firebase Firestore chưa được cấu hình trên máy chủ." });
      }

      const file = req.file;
      const { subjectId } = req.body;

      if (!file) {
        return res.status(400).json({ error: "Vui lòng chọn file Excel (.xlsx) để tải lên." });
      }

      if (!subjectId || !String(subjectId).trim()) {
        return res.status(400).json({ error: "Vui lòng chọn môn học tương ứng với ngân hàng đề." });
      }

      // Đọc file Excel từ buffer
      const workbook = XLSX.read(file.buffer, { type: 'buffer' });
      const firstSheetName = workbook.SheetNames[0];
      if (!firstSheetName) {
        return res.status(400).json({ error: "File Excel không có trang tính (sheet) nào." });
      }

      const worksheet = workbook.Sheets[firstSheetName];
      const rows = XLSX.utils.sheet_to_json<any[]>(worksheet, { header: 1, defval: null });

      const BLOOM_MAP: Record<string, 'easy' | 'medium' | 'hard'> = {
        'NB': 'easy',
        'TH': 'medium',
        'VD': 'hard',
      };

      const questions: Array<{
        subjectId: string;
        chapter: string;
        questionId: string;
        question: string;
        options: string[];
        correctAnswer: string;
        difficulty: 'easy' | 'medium' | 'hard';
        bloomLevel: 'NB' | 'TH' | 'VD';
        createdAt: any;
      }> = [];

      let skipped = 0;
      const chapters: Record<string, number> = {};

      // Bắt đầu từ dòng 10 trong Excel (index 9 trong mảng 0-indexed)
      for (let r = 9; r < rows.length; r++) {
        const row = rows[r];
        if (!row || !Array.isArray(row)) {
          continue;
        }

        const qid = row[2];
        const content = row[3];
        const a = row[4];
        const b = row[5];
        const c = row[6];
        const d = row[7];
        const correctLetter = row[8];
        const bloom = row[9];

        // Nếu cả mã câu và nội dung đều trống -> dòng trống cuối bảng, bỏ qua không tính lỗi
        if ((qid === null || qid === undefined || String(qid).trim() === '') &&
            (content === null || content === undefined || String(content).trim() === '')) {
          continue;
        }

        // Kiểm tra thiếu trường bắt buộc
        if (
          qid === null || qid === undefined || String(qid).trim() === '' ||
          content === null || content === undefined || String(content).trim() === '' ||
          a === null || a === undefined || String(a).trim() === '' ||
          b === null || b === undefined || String(b).trim() === '' ||
          c === null || c === undefined || String(c).trim() === '' ||
          d === null || d === undefined || String(d).trim() === '' ||
          correctLetter === null || correctLetter === undefined || String(correctLetter).trim() === ''
        ) {
          skipped++;
          continue;
        }

        const letter = String(correctLetter).trim().toUpperCase();
        if (!['A', 'B', 'C', 'D'].includes(letter)) {
          skipped++;
          continue;
        }

        const options = [
          String(a).trim(),
          String(b).trim(),
          String(c).trim(),
          String(d).trim()
        ];

        const letterIndex = letter.charCodeAt(0) - 65; // A=0, B=1, C=2, D=3
        const correctAnswer = options[letterIndex];
        if (!correctAnswer) {
          skipped++;
          continue;
        }

        const qidStr = String(qid).trim();
        const m = qidStr.match(/CH(\d+)/i);
        const chapter = m ? m[1] : "00";

        const rawBloom = bloom ? String(bloom).trim().toUpperCase() : 'TH';
        const bloomLevel: 'NB' | 'TH' | 'VD' = (rawBloom === 'NB' || rawBloom === 'TH' || rawBloom === 'VD') ? rawBloom : 'TH';
        const difficulty = BLOOM_MAP[bloomLevel] || 'medium';

        questions.push({
          subjectId: String(subjectId).trim(),
          chapter,
          questionId: qidStr,
          question: String(content).trim(),
          options,
          correctAnswer,
          difficulty,
          bloomLevel,
          createdAt: serverTimestamp(),
        });

        chapters[chapter] = (chapters[chapter] || 0) + 1;
      }

      if (questions.length === 0) {
        return res.json({
          success: true,
          imported: 0,
          skipped,
          chapters: {},
          message: "Không tìm thấy câu hỏi hợp lệ nào trong file (từ dòng 10 trở đi)."
        });
      }

      // Ghi vào Firestore collection `question_bank` theo batch (tối đa 400 câu / batch)
      let batch = writeBatch(db);
      let batchOpCount = 0;

      for (const q of questions) {
        const docRef = doc(db, 'question_bank', q.questionId);
        batch.set(docRef, q);
        batchOpCount++;

        if (batchOpCount % 400 === 0) {
          await batch.commit();
          batch = writeBatch(db);
        }
      }

      if (batchOpCount % 400 !== 0) {
        await batch.commit();
      }

      console.log(`[QuestionBank] Đã import thành công ${questions.length} câu vào Firestore (bỏ qua ${skipped} dòng).`);
      return res.json({
        success: true,
        imported: questions.length,
        skipped,
        chapters
      });
    } catch (err: any) {
      console.error("[QuestionBank] Import error:", err);
      return res.status(500).json({ error: err.message || "Lỗi xử lý file Excel phía máy chủ." });
    }
  });

  app.post("/api/chat", async (req, res) => {
    const { message, history, images, studentName, studentClass } = req.body;
    const apiKey = process.env.GEMINI_API_KEY;

    if (!apiKey) {
      return res.status(500).json({ error: "Gemini API key not configured" });
    }

    try {
      const ragContext = await getRelevantKnowledge(message);

      // Cá nhân hóa (không bắt buộc): nếu sinh viên vào từ link Sổ tay điểm danh kèm tên/lớp,
      // chèn 1 dòng ngắn để Thầy/Cô AI biết đang nói chuyện với ai. Không có thì bỏ qua, hành vi giữ nguyên.
      let personalization = "";
      if (studentName || studentClass) {
        personalization = `\n\nTHÔNG TIN SINH VIÊN ĐANG TRÒ CHUYỆN: ${studentName ? `Tên: ${studentName}. ` : ""}${studentClass ? `Lớp: ${studentClass}.` : ""}\nHãy gọi đúng tên Em (nếu có) một cách tự nhiên, không cần lặp lại ở mọi câu trả lời.`;
      }

      const stream = await withRetry(() => getGeminiClient().models.generateContentStream({
        model: "gemini-3.5-flash", 
        contents: [
            ... (history || []).map((h: any) => ({
                role: h.role === 'model' ? 'model' : 'user',
                parts: Array.isArray(h.parts)
                  ? h.parts.map((p: any) => ({ text: p?.text || p || "" }))
                  : [{ text: h.content || "" }]
            })),
            {
                role: 'user',
                parts: [
                    { text: message },
                    ...(images || []).map((img: string) => ({
                        inlineData: {
                            mimeType: img.match(/^data:([^;]+);base64,/)?.[1] || "image/png",
                            data: img.replace(/^data:[^;]+;base64,/, "")
                        }
                    }))
                ]
            }
        ],
        config: {
            systemInstruction: SYSTEM_INSTRUCTION + personalization + ragContext,
        }
      }));
      
      res.setHeader('Content-Type', 'text/plain; charset=utf-8');
      res.setHeader('Transfer-Encoding', 'chunked');

      for await (const chunk of stream) {
        const text = chunk.text;
        if (text) res.write(text);
      }
      res.end();
    } catch (error: any) {
      console.error("Chat error:", error);
      if (res.headersSent) {
        res.write(`\n\n[Lỗi hệ thống]: ${error.message || "Đã xảy ra lỗi kết nối với máy chủ AI."}`);
        res.end();
      } else {
        res.status(500).json({ error: error.message });
      }
    }
  });

  app.post("/api/tts", async (req, res) => {
    const { text } = req.body;
    if (!text) return res.status(400).json({ error: "No text provided" });

    try {
      const response = await withRetry(() => getGeminiClient().models.generateContent({
        model: "gemini-3.1-flash-tts-preview",
        contents: [{ parts: [{ text }] }],
        config: {
          responseModalities: [Modality.AUDIO],
          speechConfig: {
            voiceConfig: {
              prebuiltVoiceConfig: { voiceName: 'Kore' },
            },
          },
        },
      }));

      const audioData = response.candidates?.[0]?.content?.parts?.[0]?.inlineData?.data;
      if (audioData) {
        res.json({ audio: audioData });
      } else {
        res.status(500).json({ error: "No audio data returned" });
      }
    } catch (e: any) {
      console.error("TTS error:", e);
      res.status(500).json({ error: e.message });
    }
  });

  app.post("/api/quiz", async (req, res) => {
    const { subject, chapter, difficulty, count } = req.body;
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) return res.status(500).json({ error: "API key missing" });

    try {
      const prompt = `${QUIZ_SYSTEM_PROMPT}\n\nHãy tạo ${count} câu hỏi ôn tập cho môn ${subject}, chương/chủ đề: ${chapter}, mức độ: ${difficulty}.`;
      const result = await withRetry(() => getGeminiClient().models.generateContent({
        model: "gemini-3.5-flash",
        contents: [{ role: 'user', parts: [{ text: prompt }] }],
        config: {
          responseMimeType: "application/json",
          responseSchema: {
            type: Type.ARRAY,
            items: {
              type: Type.OBJECT,
              properties: {
                id: { type: Type.STRING },
                type: { type: Type.STRING, description: "Bắt buộc là 'mcq' hoặc 'essay'" },
                question: { type: Type.STRING },
                options: { type: Type.ARRAY, items: { type: Type.STRING }, description: "Mảng chứa đúng 4 lựa chọn nếu là mcq, hoặc một mảng rỗng [] nếu là essay" },
                correctAnswer: { type: Type.STRING },
                explanation: { type: Type.STRING },
                difficulty: { type: Type.STRING, description: "easy, medium hoặc hard" }
              },
              required: ["id", "type", "question", "correctAnswer", "explanation", "difficulty"]
            }
          }
        }
      }));

      res.json(safeParseJSON(result.text, []));
    } catch (e: any) {
      console.error("Quiz generation error:", e);
      res.status(500).json({ error: e.message });
    }
  });

  app.post("/api/grade", async (req, res) => {
    const { question, correctAnswer, studentAnswer } = req.body;
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) return res.status(500).json({ error: "API key missing" });

    try {
      const prompt = `
Bạn là giảng viên / Thầy/Cô kỹ thuật cơ khí. Hãy chấm điểm câu trả lời của sinh viên.
XƯNG HÔ BẮT BUỘC: Bạn sẽ xưng là "Thầy/Cô" và gọi sinh viên là "Em". Nhận xét khách quan, khích lệ và chỉ rõ điểm cần hoàn thiện tại xưởng.
Câu hỏi: ${question}
Đáp án chuẩn (ý chính): ${correctAnswer}
Câu trả lời của sinh viên: ${studentAnswer}

Yêu cầu phản hồi:
1. Điểm số (thang điểm 10).
2. Nhận xét: Những ý nào Em đã trả lời đúng/đạt, ý nào Em còn thiếu hoặc cần bổ sung.
3. Hướng dẫn thêm để Em nắm chắc bản chất kỹ thuật và vận dụng chính xác.
`;
      const result = await withRetry(() => getGeminiClient().models.generateContent({
        model: "gemini-3.5-flash",
        contents: [{ role: 'user', parts: [{ text: prompt }] }],
        config: {
          responseMimeType: "application/json",
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              score: { type: Type.NUMBER, description: "Điểm số từ 0 đến 10" },
              feedback: { type: Type.STRING },
              missingPoints: { type: Type.ARRAY, items: { type: Type.STRING }, description: "Các ý chính còn thiếu" }
            },
            required: ["score", "feedback", "missingPoints"]
          }
        }
      }));

      res.json(safeParseJSON(result.text, { score: 0, feedback: "Không thể tự động chấm điểm lúc này.", missingPoints: [] }));
    } catch (e: any) {
      console.error("Grading error:", e);
      res.status(500).json({ error: e.message });
    }
  });

  // Global JSON Error Handler
  app.use((err: any, req: express.Request, res: express.Response, next: express.NextFunction) => {
    console.error("Global Error Handled:", err);
    if (res.headersSent) {
      return next(err);
    }
    res.status(err.status || 500).json({
      error: err.message || "Đã xảy ra lỗi hệ thống khi xử lý yêu cầu."
    });
  });

  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();