# Ôn JLPT N3 — web flashcard

Trang ôn tập nhanh cho JLPT N5–N3 (kỳ thi 06/12/2026). Mở trên điện thoại hoặc máy tính, không cần cài đặt.

| Tab | Nội dung | Cách ôn |
|---|---|---|
| Trang chủ | Đếm ngày đến kỳ thi, mục tiêu câu mỗi ngày, tiến độ từng phần và theo cấp độ | Ôn nhanh 10 câu trộn mọi phần |
| Từ vựng | 3.819 từ, 43 chủ đề (28 chủ đề, màu sắc, kính ngữ, tiền tố – hậu tố, 12 nhóm N3 trọng tâm) | Flashcard chọn đáp án: từ → nghĩa, Kanji → cách đọc, nghĩa → từ; danh sách |
| Kanji | 754 chữ N5–N3, âm Hán Việt, On/Kun, câu chuyện ghi nhớ, các từ ghép tạo thành từ mỗi chữ | Chữ → Hán Việt, từ ghép → nghĩa, từ ghép → cách đọc |
| Ngữ pháp | 306 mẫu N5–N3 (có bổ sung N5, N4 và các mẫu N3 còn thiếu) | Điền vào chỗ trống |
| Đồng nghĩa | 175 cặp từ đồng nghĩa N3 (danh từ, động từ, tính từ, phó từ) | Chọn từ gần nghĩa nhất trong 4 đáp án (dạng 言い換え類義) |
| Mẫu câu | 文脈規定 và 言い換え類義 | Điền vào chỗ trống / chọn từ gần nghĩa |
| Đọc hiểu | 10 bài (thư, thông báo, email, bài luận, bài báo) | Điền chỗ trống kiểu 文章の文法 + câu hỏi nội dung |
| Lỗi sai | Mọi câu trả lời sai được lưu lại; đúng 2 lần liên tiếp thì xoá | Ôn lại theo từng phần; xuất / nhập tiến độ dạng file JSON |

Tiến độ lưu trong trình duyệt (localStorage). Muốn chuyển sang máy khác: tab **Lỗi sai → Xuất file JSON**, rồi **Nhập file JSON** ở máy kia.

## Chạy trên máy

```bash
python3 -m http.server 8000      # trong thư mục này
# mở http://localhost:8000
```

(Mở thẳng file `index.html` không chạy được vì trình duyệt chặn đọc file JSON từ ổ đĩa.)

## Dữ liệu (`data/*.json`)

- `vocab.json`, `kanji.json`, `grammar.json`: bóc từ bộ PDF ôn N5–N3 (`~/workspace/Japanese`) bằng `tools/parse_*.py`,
  cộng 1.287 từ còn thiếu so với danh sách JLPT của Jonathan Waller (tanos.co.uk, bản CSV của open-anki-jlpt-decks), nghĩa tiếng Việt trong `tools/vi_part*.txt`.
- Từ ghép của mỗi Kanji được tìm tự động trong kho từ vựng.
- `tools/grammar_add.txt`, `tools/sentences.txt`, `data/reading.json`: câu hỏi tự soạn theo dạng đề N3 (không phải đề thi thật).

Build lại: `python3 tools/build_data.py tools/src`

## Kiểm tra lỗi

- `python3 tools/check_data.py`: kiểm tra dữ liệu (mỗi câu có đủ 4 đáp án khác nhau, không rỗng, đúng 1 chỗ trống, không dòng rác…).
- `test.html` (mở qua `python3 -m http.server`): sinh khoảng 5.800 câu hỏi ở mọi chế độ, bấm thử mọi tab, làm hết bài đọc hiểu, ôn lỗi sai; in số lỗi logic và lỗi JavaScript.

Giao diện: ôn theo lượt 10 câu (thanh tiến độ, màn kết quả liệt kê câu sai), nút nghe phát âm tiếng Nhật, sáng/tối.
Điện thoại: thanh điều hướng dưới đáy, bộ lọc thu gọn. Máy tính (từ 1000px): menu bên trái, bộ lọc cạnh câu hỏi; đọc hiểu chia đôi đoạn văn / câu hỏi.
