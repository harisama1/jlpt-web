# Ôn JLPT — web flashcard

Trang ôn tập JLPT theo cấp độ (hiện có N5–N3; N2, N1 đã có chỗ, hiện "Sắp có"). Mở trên điện thoại hoặc máy tính, không cần cài đặt.
Bố cục theo bản thiết kế `JLPT_Design.drawio` (4 trang: HOME, Từ mới, Kanji, Mục khác).

| Trang | Nội dung |
|---|---|
| Trang chủ | Số ngày còn lại tới kỳ thi, tiến độ đã thuộc / tổng, 4 ô: Từ mới · Kanji · Mẫu câu · Mục khác |
| Hôm nay (#/plan) | Kế hoạch học trong ngày: mỗi loại bài (mẫu ngữ pháp N4–N3, nhóm 10 từ N3, phần đề luyện) = ⌈số bài còn lại ÷ số ngày còn lại⌉, tính lại mỗi sáng (hôm nay chưa xong thì phần dư được chia cho các ngày sau). Mỗi ngày bắt buộc 1 lượt ôn ngữ pháp + 1 lượt ôn từ mới (ưu tiên lỗi sai, mục lâu chưa gặp) |
| Từ mới | Chọn cấp N5…N1 → lưới chủ đề có tiến độ → luyện (từ → nghĩa, kanji → cách đọc, nghĩa → từ, danh sách). Chủ đề **Từ bổ sung**: 361 từ ngoài giáo trình (nghĩa dịch máy, ghi chú trong phần xem thêm) |
| Kanji | Chọn cấp → lưới chữ (âm Hán Việt + từ ghép). Bấm một chữ để luyện các từ ghép của chữ đó; câu "cách đọc" có đáp án nhiễu đọc gần giống nhau. Có nút luyện cả cấp |
| Mẫu câu | 文脈規定 và 言い換え類義 |
| Mục khác | Luyện đề (chỉ trên máy, xem dưới) · Đọc hiểu · Từ đồng nghĩa · Ngữ pháp (theo nhóm; mỗi mẫu có trang riêng: lý thuyết + ví dụ + **luyện riêng mẫu đó**; mẫu có nhiều cách dùng thì luyện riêng **từng cách dùng**; tìm được bằng chữ Nhật, tiếng Việt hoặc romaji như "ni naru") · Nghe hiểu (phát triển sau) · Lỗi sai · Ôn nhanh · Giao diện & sao lưu |

Sau mỗi câu: dịch nghĩa câu, lý do đáp án đúng và nghĩa của cả 4 lựa chọn. Câu hỏi không lặp lại trong một phạm vi cho tới khi hết.
Tiến độ lưu trong trình duyệt (localStorage, giữ được tiến độ của bản cũ); xuất / nhập file JSON ở **Mục khác → Giao diện & sao lưu**.

**Đồng bộ nhiều thiết bị** (Mục khác → Giao diện & sao lưu): dán một token GitHub chỉ có quyền `gist` trên mỗi thiết bị; tiến độ được lưu vào
một Gist bí mật `jlpt-web-progress.json` trong tài khoản của bạn. Khi mở trang: kéo về và gộp (mỗi mục giữ bản mới hơn, lỗi sai đã xoá không sống lại,
số câu mỗi ngày lấy lớn hơn); vài giây sau mỗi câu trả lời và khi đóng tab: đẩy lên. Code: `js/core/sync.js`, gộp: `mergeProgress` trong `js/core/store.js`.

## Chạy trên máy

```bash
python3 -m http.server 8000      # trong thư mục này, rồi mở http://localhost:8000
```

## Kiến trúc (để nâng cấp)

Không cần bước build: ES modules chạy thẳng trên GitHub Pages.

```
index.html            khung trang (menu trái, thanh dưới), nạp js/main.js
style.css             toàn bộ giao diện; màu theo biến CSS (--c-<section>, --primary)
data/manifest.json    danh sách cấp độ (available) + các file dữ liệu → thêm dữ liệu không phải sửa code
js/main.js            khởi động, dựng menu từ registry, điều phối route  #/<section>/<tham số>…
js/core/              phần dùng chung
  util.js  store.js (tiến độ, lựa chọn, bộ bài)  data.js (nạp manifest + chỉ mục, meanOf)
  deck.js (không lặp, đáp án nhiễu, cách đọc gần giống)  quiz.js (lượt 10 câu + giải thích)
  router.js (registry section + hash router)  ui.js (tiêu đề, hàng cấp độ, lưới thẻ, danh sách)  speech.js
js/sections/          mỗi trang một file, tự register({...})
  home.js (Trang chủ + Mục khác)  vocab.js  kanji.js  practice.js (Mẫu câu, Ngữ pháp, Đồng nghĩa)
  reading.js (Đọc hiểu, Nghe hiểu)  review.js (Lỗi sai, Ôn nhanh, Giao diện)
tests/                quiz.html (logic) · routes.html (đi qua mọi trang)
tools/                sinh dữ liệu (build_data.py, check_data.py, extra_words.tsv)
```

**Thêm một trang mới**: tạo `js/sections/ten.js` gọi `register({ id, name, icon, parent: '' | 'more', order, tile: {sub, stat}, render(main, params) })`
rồi thêm một dòng `import './sections/ten.js'` trong `js/main.js`. Thẻ ở Trang chủ / Mục khác và menu tự xuất hiện. `soon: true` = hiện mờ "Sắp có".

**Thêm N2/N1**: thêm từ/kanji có `"lv": "N2"` vào `data/vocab.json`, `data/kanji.json` (hoặc file riêng rồi khai báo trong `files` của manifest),
đổi `"available": true` cho cấp đó trong `data/manifest.json`. Nguồn đã tải sẵn trong `tools/ext/` (không đưa lên git): `n1.csv`, `n2.csv`
(open-anki-jlpt-decks), `kanji-data.json`, `Unihan_Readings.txt` (âm Hán Việt `kVietnamese`).

**Nghe hiểu**: section `listen` trong `reading.js` đang là chỗ trống; thêm file dữ liệu bài nghe vào manifest và viết `render`.

## Đề luyện (chỉ trên máy)

Đề thi thử / đề JLPT là tài liệu có bản quyền, nên **không đưa lên git**: chúng nằm trong `local/exams/<id>/` (thư mục `local/` có trong `.gitignore`).
Mỗi đề: `exam.txt` (soạn tay, định dạng ghi ở đầu `tools/build_exams.py`), `audio/`, `img/`, `transcript.txt` (lời thoại chép bằng
`~/tools/stt/transcribe.py`, faster-whisper). `python3 tools/build_exams.py` sinh `exam.json` + `local/exams/index.json`; trang **Luyện đề**
(`js/sections/exam.js`, nạp qua `js/core/exams.js`) chỉ hiện đề khi chạy `python3 -m http.server` trên máy; trên GitHub Pages danh sách trống.

## Dữ liệu

- `vocab.json`, `kanji.json`, `grammar.json`: bóc từ bộ PDF ôn N5–N3 bằng `tools/parse_*.py` + danh sách JLPT của Jonathan Waller; nghĩa tiếng Việt trong `tools/vi_part*.txt`.
  Build lại: `python3 tools/build_data.py tools/src`.
- `sentences.json`, `synonyms.json`, `reading.json`, `gloss.json`: câu hỏi tự soạn theo dạng đề (không phải đề thi thật), có bản dịch và giải thích.
- Ngữ pháp: 368 mẫu (N5 83 · N4 92 · N3 190 · N2 3), 1478 câu điền chỗ trống, ≥ 4 câu cho hầu hết các mẫu. `tools/grammar_more.txt` (câu luyện + ví dụ thêm cho từng mẫu), `tools/grammar_fix.txt` (đáp án nhiễu viết lại cho câu sinh từ PDF), mẫu mới ở cuối `grammar_add.txt` + `grammar_theory.txt`.
- `tools/grammar_usage.txt`: mẫu có nhiều cách dùng (25 mẫu, 69 cách dùng, 207 câu tự soạn): `U|n|tên|giải thích`, `Q|n|câu【đáp án】|dịch|nhiễu`, `T|n|đoạn chữ` (gắn cách dùng cho câu cũ) → `g.uses`, `q.u`.
- `tools/exam_words.tsv`: từ gặp trong các đề luyện mà web chưa có (chủ đề "Từ trong đề luyện").
- Lưu ý: `build_data.py` không tái lập được y hệt (thứ tự `set` thay đổi mỗi lần chạy → đáp án nhiễu sinh tự động đổi). Khi chỉ thêm dữ liệu, giữ nguyên các file không liên quan (`git checkout data/sentences.json …`) để id/tiến độ không xáo trộn.
- `tools/extra_words.tsv`: từ bổ sung (từ, cách đọc, nghĩa Việt, nghĩa Anh JMdict, cấp), build_data.py nạp vào chủ đề "Từ bổ sung". Từ thuộc danh sách N2/N1 được gán N2/N1 và hiện khi mở cấp đó.

## Kiểm tra

- `python3 tools/check_grammar.py [data/grammar.json | file.txt]`: chính tả tiếng Việt (từng âm tiết: vần hợp lệ, một dấu thanh), một chỗ trống, 4 lựa chọn khác nhau, lựa chọn lặp chữ trước chỗ trống, đáp án nhiễu là biến thể của chính mẫu (cần xem lại).
- `python3 tests/run_browser_test.py quiz|routes`: chạy trang test trong một Firefox headless, tự thoát (không để tiến trình sót lại).
- `python3 tools/check_data.py`: dữ liệu (4 đáp án khác nhau, không rỗng, đúng 1 chỗ trống…).
- `tests/quiz.html` và `tests/routes.html` (mở qua `python3 -m http.server`): sinh câu ở mọi chế độ, kiểm không lặp, mọi đáp án có giải nghĩa, đi qua mọi trang; in số lỗi.
