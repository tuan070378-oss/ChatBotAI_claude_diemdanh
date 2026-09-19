"""
Import ngân hàng câu hỏi trắc nghiệm (.xlsx) vào Firestore collection `question_bank`.

CÁCH DÙNG:
  python import_question_bank.py <file.xlsx> --subject an-toan --service-account serviceAccountKey.json

Yêu cầu định dạng Excel (đúng theo mẫu "Ngân hàng câu hỏi trắc nghiệm" của trường):
  - Dữ liệu bắt đầu từ dòng 10 (9 dòng đầu là tiêu đề/metadata)
  - Cột A: TT (bỏ qua)
  - Cột B: Mã hóa môn học/mô đun (bỏ qua, dùng --subject để gán môn)
  - Cột C: Mã hóa câu hỏi (ID duy nhất) — vd ATLD_CH01_001. Số sau "CH" là số chương.
  - Cột D: Nội dung câu hỏi
  - Cột E, F, G, H: Phương án trả lời A, B, C, D
  - Cột I: Đáp án đúng (chữ cái A/B/C/D)
  - Cột J: Mức độ nhận thức Bloom (NB/TH/VD) — map: NB=easy, TH=medium, VD=hard

Document ID trên Firestore = chính "Mã hóa câu hỏi" (vd ATLD_CH01_001), nên chạy lại script
nhiều lần với cùng file sẽ CẬP NHẬT đè lên câu cũ, không tạo trùng lặp (an toàn khi re-import).
"""
import argparse
import re
import sys
from datetime import datetime, timezone

import openpyxl

BLOOM_TO_DIFFICULTY = {"NB": "easy", "TH": "medium", "VD": "hard"}
ANSWER_COL_BY_LETTER = {"A": 4, "B": 5, "C": 6, "D": 7}  # 0-based offset from column E


def parse_excel(path):
    wb = openpyxl.load_workbook(path, data_only=True)
    ws = wb.active

    questions = []
    errors = []

    for r in range(10, ws.max_row + 1):
        row = [ws.cell(row=r, column=c).value for c in range(1, 11)]
        _tt, _mamon, qid, content, a, b, c, d, correct_letter, bloom = row

        if content is None and qid is None:
            continue  # dòng trống, bỏ qua

        options = [a, b, c, d]
        missing = [name for name, val in
                   [("qid", qid), ("content", content), ("A", a), ("B", b), ("C", c), ("D", d),
                    ("đáp án đúng", correct_letter)]
                   if val is None or str(val).strip() == ""]
        if missing:
            errors.append(f"Dòng {r}: thiếu {', '.join(missing)}")
            continue

        correct_letter = str(correct_letter).strip().upper()
        if correct_letter not in ("A", "B", "C", "D"):
            errors.append(f"Dòng {r} ({qid}): đáp án đúng '{correct_letter}' không hợp lệ (phải là A/B/C/D)")
            continue

        m = re.search(r"CH(\d+)", str(qid))
        chapter = m.group(1) if m else "00"

        correct_text = options[ord(correct_letter) - ord("A")]
        bloom_key = str(bloom).strip().upper() if bloom else "TH"
        difficulty = BLOOM_TO_DIFFICULTY.get(bloom_key, "medium")

        questions.append({
            "questionId": str(qid).strip(),
            "chapter": chapter,
            "question": str(content).strip(),
            "options": [str(o).strip() for o in options],
            "correctAnswer": str(correct_text).strip(),
            "bloomLevel": bloom_key,
            "difficulty": difficulty,
        })

    return questions, errors


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("excel_path")
    ap.add_argument("--subject", required=True, help="subjectId khớp với SUBJECTS trong Remix AI, vd: an-toan")
    ap.add_argument("--service-account", required=True, help="Đường dẫn tới file JSON service account Firebase")
    ap.add_argument("--database-id", default="ai-studio-f2041446-8ec2-4f07-8161-37c5c86a9887",
                     help="Firestore database ID (mặc định lấy từ firebase-applet-config.json của project)")
    ap.add_argument("--dry-run", action="store_true", help="Chỉ đọc và kiểm tra, không ghi vào Firestore")
    args = ap.parse_args()

    questions, errors = parse_excel(args.excel_path)

    print(f"Đọc được {len(questions)} câu hỏi hợp lệ.")
    if errors:
        print(f"\n⚠️  {len(errors)} dòng bị bỏ qua do lỗi dữ liệu:")
        for e in errors:
            print("  -", e)

    if not questions:
        print("Không có câu hỏi hợp lệ nào để import. Dừng.")
        sys.exit(1)

    by_chapter = {}
    for q in questions:
        by_chapter[q["chapter"]] = by_chapter.get(q["chapter"], 0) + 1
    print("Phân bố theo chương:", dict(sorted(by_chapter.items())))

    if args.dry_run:
        print("\n[--dry-run] Không ghi vào Firestore. Xem 1 câu mẫu:")
        print(questions[0])
        return

    import firebase_admin
    from firebase_admin import credentials, firestore

    cred = credentials.Certificate(args.service_account)
    firebase_admin.initialize_app(cred)
    db = firestore.client(database_id=args.database_id)

    batch = db.batch()
    count = 0
    for q in questions:
        doc_ref = db.collection("question_bank").document(q["questionId"])
        batch.set(doc_ref, {
            "subjectId": args.subject,
            "chapter": q["chapter"],
            "questionId": q["questionId"],
            "question": q["question"],
            "options": q["options"],
            "correctAnswer": q["correctAnswer"],
            "difficulty": q["difficulty"],
            "bloomLevel": q["bloomLevel"],
            "createdAt": datetime.now(timezone.utc),
        })
        count += 1
        if count % 400 == 0:  # Firestore batch limit là 500 thao tác
            batch.commit()
            batch = db.batch()
            print(f"  ... đã ghi {count}/{len(questions)}")

    batch.commit()
    print(f"\n✅ Đã import xong {count} câu hỏi vào question_bank (subjectId='{args.subject}').")


if __name__ == "__main__":
    main()
