
export async function* sendMessageStream(
  message: string, 
  history: { role: 'user' | 'model', parts: { text: string }[] }[] = [],
  images?: string[]
) {
  const response = await fetch('/api/chat', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ message, history, images }),
  });

  if (!response.ok) {
    let errorMessage = 'Gặp lỗi trong quá trình kết nối với AI';
    try {
      const errorData = await response.json();
      errorMessage = errorData.error || errorData.message || errorMessage;
    } catch (_) {
      try {
        const text = await response.text();
        if (text && !text.startsWith('<')) {
          errorMessage = text;
        }
      } catch (__) {}
    }
    throw new Error(errorMessage);
  }

  const reader = response.body?.getReader();
  if (!reader) return;

  const decoder = new TextDecoder();
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    yield decoder.decode(value);
  }
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
Mỗi đối tượng trong mảng có cấu trúc:
{
  "id": "chuỗi ngẫu nhiên",
  "type": "mcq" | "essay",
  "question": "Nội dung câu hỏi...",
  "options": ["A...", "B...", "C...", "D..."], // Chỉ có nếu type là mcq
  "correctAnswer": "Đáp án đúng hoặc gợi ý ý chính",
  "explanation": "Giải thích chi tiết tại sao đúng/sai và liên hệ thực tế",
  "difficulty": "easy" | "medium" | "hard"
}
`;

export async function generateQuiz(subject: string, chapter: string, difficulty: string, count: number) {
  const response = await fetch('/api/quiz', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ subject, chapter, difficulty, count }),
  });
  if (!response.ok) {
    let errMsg = "Không thể khởi tạo bộ câu hỏi ôn tập lúc này.";
    try {
      const errData = await response.json();
      errMsg = errData.error || errMsg;
    } catch (_) {}
    throw new Error(errMsg);
  }
  try {
    return await response.json();
  } catch (e) {
    throw new Error("Phản hồi câu hỏi từ máy chủ không đúng định dạng dữ liệu.");
  }
}

export async function gradeEssay(question: string, correctAnswer: string, studentAnswer: string) {
  const response = await fetch('/api/grade', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ question, correctAnswer, studentAnswer }),
  });
  if (!response.ok) {
    let errMsg = "Không thể chấm điểm tự động lúc này.";
    try {
      const errData = await response.json();
      errMsg = errData.error || errMsg;
    } catch (_) {}
    throw new Error(errMsg);
  }
  try {
    return await response.json();
  } catch (e) {
    throw new Error("Phản hồi chấm điểm từ máy chủ không đúng định dạng dữ liệu.");
  }
}
