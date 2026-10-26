# Ôn JLPT — web flashcard

Trang ôn tập JLPT theo cấp độ (hiện có N5–N3; N2, N1 đã có chỗ, hiện "Sắp có"). Mở trên điện thoại hoặc máy tính, không cần cài đặt.
Bố cục theo bản thiết kế `JLPT_Design.drawio` (4 trang: HOME, Từ mới, Kanji, Mục khác).

| Trang | Nội dung |
|---|---|
| Trang chủ | Số ngày còn lại tới kỳ thi, tiến độ đã thuộc / tổng, 4 ô: Từ mới · Kanji · Mẫu câu · Mục khác |
| Từ mới | Chọn cấp N5…N1 → lưới chủ đề có tiến độ → luyện (từ → nghĩa, kanji → cách đọc, nghĩa → từ, danh sách). Chủ đề **Từ bổ sung**: 361 từ ngoài giáo trình (nghĩa dịch máy, ghi chú trong phần xem thêm) |
| Kanji | Chọn cấp → lưới chữ (âm Hán Việt + từ ghép). Bấm một chữ để luyện các từ ghép của chữ đó; câu "cách đọc" có đáp án nhiễu đọc gần giống nhau. Có nút luyện cả cấp |
| Mẫu câu | 文脈規定 và 言い換え類義 |
| Mục khác | Đọc hiểu · Từ đồng nghĩa · Ngữ pháp (theo nhóm) · Nghe hiểu (phát triển sau) · Lỗi sai · Ôn nhanh · Giao diện & sao lưu |

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

## Dữ liệu

- `vocab.json`, `kanji.json`, `grammar.json`: bóc từ bộ PDF ôn N5–N3 bằng `tools/parse_*.py` + danh sách JLPT của Jonathan Waller; nghĩa tiếng Việt trong `tools/vi_part*.txt`.
  Build lại: `python3 tools/build_data.py tools/src`.
- `sentences.json`, `synonyms.json`, `reading.json`, `gloss.json`: câu hỏi tự soạn theo dạng đề (không phải đề thi thật), có bản dịch và giải thích.
- `tools/extra_words.tsv`: từ bổ sung (từ, cách đọc, nghĩa Việt, nghĩa Anh JMdict, cấp), build_data.py nạp vào chủ đề "Từ bổ sung". Từ thuộc danh sách N2/N1 được gán N2/N1 và hiện khi mở cấp đó.

## Kiểm tra

- `python3 tools/check_data.py`: dữ liệu (4 đáp án khác nhau, không rỗng, đúng 1 chỗ trống…).
- `tests/quiz.html` và `tests/routes.html` (mở qua `python3 -m http.server`): sinh câu ở mọi chế độ, kiểm không lặp, mọi đáp án có giải nghĩa, đi qua mọi trang; in số lỗi.
