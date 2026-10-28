# Nhật ký thay đổi — Xổ Số Đại Lý

Đánh số phiên bản theo dạng `LỚN.VỪA.NHỎ` (semver):

- **NHỎ** (1.0.0 → 1.0.1): sửa lỗi, không thêm tính năng.
- **VỪA** (1.0.1 → 1.1.0): thêm tính năng mới, cài đặt cũ vẫn dùng được.
- **LỚN** (1.1.0 → 2.0.0): thay đổi lớn, có thể phải chỉnh lại cài đặt.

Mỗi lần phát hành, thêm một mục mới lên trên cùng.

## Chưa phát hành

Đổi tiêu đề mục này thành số phiên bản mới (ví dụ `## 1.1.0 — <ngày>`) khi phát hành.

- Bấm In giờ mở bước **Xem trước khi in**: trang in đúng như ra giấy, chọn máy in và số tờ ngay
  trong đó. Chạy được cả trên máy chưa cài máy in (khi đó gợi ý lưu PDF).
- Chọn được máy in; đã chọn máy in thì in thẳng, không hỏi lại. Tuỳ chọn "In nhanh" bỏ qua bước
  xem trước.
- In lỗi thì báo rõ lý do bằng tiếng Việt, không còn tự xuất và mở file PDF.
- Cột trái màn Kết quả chia hai nhóm riêng: **In phiếu** và **Lưu file** (loại file, vị trí lưu
  chọn ngay tại chỗ, tên file sẽ lưu, một nút Lưu theo loại file).
- Khung xem trước phóng to được: nút − / + / Vừa khung / Cỡ thật, Ctrl/⌘ + con lăn hoặc chụm
  hai ngón, nhấp đúp, kéo chuột để di chuyển.
- Cỡ chữ mặc định của các dòng đầu phiếu tăng lên 10 pt.
- Mục **Kích thước phiếu** trong Cài đặt: hai ô Rộng / Cao. Ô nào để **Auto** thì lấy kích
  thước lớn nhất vừa khổ giấy; nhấp đúp chữ "Rộng"/"Cao" (hoặc xoá số) để về Auto, gõ số để cố
  định. Phiếu thấp hơn thì bảng và cỡ số tự co cho vừa.
- **Khoảng cách giữa các phiếu** tách thành ngang (giữa 2 cột) và dọc (giữa 2 hàng). Cài đặt cũ
  và `CARD_GAP_CM` trong xsmn.conf áp cho cả hai chiều.
- Các ô số trên nhập gọn kiểu Figma: gõ số, phím mũi tên, hoặc kéo chuột trên phần đầu ô.
- Mục **Chữ trong bảng** thay cho "Căn chữ trong bảng", "Căn số kết quả", "Khoảng cách số tới lề
  phải ô": hai dòng Chữ và Số kết quả, mỗi dòng có Padding ngang/dọc và ô Align 3×3 (chọn 1 trong 9
  vị trí). Cài đặt cũ tự chuyển sang; mặc định bản in không đổi.
- **Vị trí cụm phiếu trên trang** chọn bằng ba hình trang giấy nhỏ (Trái / Giữa / Phải) vẽ đúng khổ
  giấy, thay cho ô chọn chữ.
- Font chữ và cỡ số kết quả gộp thành một mục **Font chữ & cỡ số** (một hàng hai ô chọn).
- Nhóm **Cấu hình** (nhập / xuất file .conf) ở thanh dưới màn Cài đặt: xuất thông tin đại lý, đài
  và bố cục bản in ra file chữ có chú thích, nhập lại ra y nguyên (sao lưu hoặc chép sang máy khác).
  Máy in và thư mục lưu không nằm trong file (riêng từng máy). File `xsmn.conf` của bản dòng lệnh
  cũ vẫn nhập được.
- Lịch chọn ngày chỉ cho chọn tới hôm nay.
- Bỏ bản dòng lệnh bash (`cli/`); app là bản duy nhất.
- Bỏ dòng **Fax** và **ghi chú dưới chữ "Tư"** khỏi phiếu và màn Cài đặt. Dòng liên hệ chỉ còn các
  số điện thoại (DĐ). Nhập `xsmn.conf` có `AGENT_FAX` / `NOTE` thì hai khoá này được báo bỏ qua.

## 1.0.0 — 28-10-2026

Bản đầu tiên.

- Lấy kết quả xổ số miền Nam theo ngày từ minhngoc.net.vn. Trước 16h mở sẵn ngày hôm qua.
- Báo rõ trạng thái: đủ kết quả, đang quay trực tiếp (tự lấy lại mỗi 2 phút), chưa có kết quả,
  mất mạng (chờ kết nối rồi tự lấy), máy chủ minhngoc gặp sự cố (tự thử lại).
- Xem trước bản in và bảng kết quả chữ lớn.
- In qua hộp thoại in của hệ thống, chọn số bản (tờ). Khổ A4 (4 phiếu/tờ), A5 (2), A6 (1).
- Lưu PDF hoặc Word (.docx); bố cục phiếu giống bản `xsmn.sh` cũ.
- Màn Cài đặt: thông tin đại lý (ẩn/hiện từng dòng, cỡ chữ), đài cần in theo thứ (kéo thả đổi
  thứ tự), tên viết tắt đài, bố cục bản in, số bản in mặc định, thư mục lưu, nhập từ `xsmn.conf`.
- Bộ cài cho macOS (Apple Silicon, Intel), Windows 10/11, Windows 7 (32 và 64-bit), Linux.
