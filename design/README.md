# Thiết kế giao diện (đã duyệt 27-10-2026)

Ba file `.dc.html` lấy từ canvas thiết kế "XSMN - Giao diện app" trên claude.ai:

| File | Nội dung |
|---|---|
| `Main.dc.html` | Màn **Kết quả**: chọn ngày, khổ giấy, định dạng, trạng thái, In/Lưu, xem trước bản in / bảng kết quả |
| `CaiDat.dc.html` | Màn **Cài đặt**: thông tin đại lý (con mắt ẩn/hiện + cỡ chữ), đài cần in (kéo thả thứ tự), bản in, máy in (sắp có), lưu file; xem trước phiếu bên phải |
| `Phieu.dc.html` | Thành phần **phiếu kết quả** dùng chung cho cả hai màn |

Cách đọc: đây là HTML với vài thẻ riêng của canvas, không mở thẳng bằng trình duyệt được
(cần runtime `support.js` của canvas). Đọc như mã nguồn:

- `{{ten}}`: giá trị lấy từ hàm `renderVals()` trong khối `<script>` cuối file.
- `<sc-for list="{{ds}}" as="x">`: vòng lặp. `<sc-if value="{{dk}}">`: điều kiện.
- `<dc-import name="Phieu" card="…">`: nhúng thành phần `Phieu.dc.html`.
- `onClick="{{ham}}"`: sự kiện, hàm định nghĩa trong `renderVals()`.
- Khối `<script>`: dữ liệu mẫu (kết quả thật ngày 26-10-2026) và hành vi (chọn khổ,
  ẩn/hiện, kéo thả…). Kích thước trong phiếu xem trước dùng px theo 96 dpi
  (1 cm ≈ 37,8 px). Số đo **thật** của bản in lấy theo `docs/SPEC.md` §6.

Xem bản tương tác: mở canvas trên claude.ai, bấm Play trên từng khung.

`reference/`: PDF in mẫu do `cli/xsmn.sh` tạo, dùng để so bản in của app:
- `xsmn_26-10-2026_A4.pdf`, `_A5.pdf`, `_A6.pdf`: Thứ Hai, 3 đài.
- `xsmn_24-10-2026_A4_4dai.pdf`: Thứ Bảy, 4 đài (cột hẹp nhất).

`logo/`: 4 mẫu logo đã đưa chủ dự án chọn (`mau-logo.png` là trang so sánh). Đã chọn
**C · Phiếu dò** (`C-phieu-do.svg`), dùng cho biểu tượng app, thanh trên cùng và màn hình chào.
