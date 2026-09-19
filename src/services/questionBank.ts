/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */
import { db, collection, query, where, getDocs, isFirebaseConfigured } from '../lib/firebase';
import { QuizQuestion } from '../types';

/**
 * Tải đề cố định (do giáo viên soạn) từ Firestore collection `question_bank`.
 * Khác với generateQuiz() (gemini.ts) — không gọi AI, không sinh ngẫu nhiên,
 * trả về đúng những câu đã được import sẵn cho môn học (và chương, nếu chỉ định).
 *
 * QUAN TRỌNG: hàm này KHÔNG có dữ liệu dự phòng bịa ra. Nếu Firestore chưa cấu hình,
 * lỗi mạng, hoặc chưa có câu hỏi nào cho môn học, hàm sẽ ném lỗi rõ ràng để
 * QuizManager hiển thị thông báo cho người dùng — không bao giờ âm thầm trả về
 * nội dung không phải do giáo viên soạn (rủi ro nghiêm trọng nếu dùng cho kiểm tra tính điểm).
 */
export async function fetchQuestionBank(
  subjectId: string,
  chapter?: string
): Promise<QuizQuestion[]> {
  if (!isFirebaseConfigured || !db) {
    throw new Error('Firestore chưa được cấu hình cho ứng dụng này.');
  }

  const constraints = [where('subjectId', '==', subjectId)];
  if (chapter) constraints.push(where('chapter', '==', chapter));

  const snapshot = await getDocs(query(collection(db, 'question_bank'), ...constraints));

  const questions: QuizQuestion[] = snapshot.docs.map((docSnap) => {
    const d = docSnap.data() as any;
    const options = Array.isArray(d.options) ? d.options : [];
    return {
      id: d.questionId || docSnap.id,
      type: 'mcq',
      question: d.question || '',
      options,
      correctAnswer: d.correctAnswer || '',
      explanation: `Mức độ: ${d.bloomLevel || ''}`.trim(),
      difficulty: (d.difficulty as 'easy' | 'medium' | 'hard') || 'medium',
    };
  });

  return questions;
}

/** Trộn ngẫu nhiên thứ tự câu hỏi (Fisher–Yates) — không đổi nội dung/đáp án từng câu. */
export function shuffleQuestions<T>(questions: T[]): T[] {
  const result = [...questions];
  for (let i = result.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [result[i], result[j]] = [result[j], result[i]];
  }
  return result;
}