# Tải và cài app

## Chọn file cài

<DownloadTable />

Chưa rõ máy Mac dùng chip gì thì bấm logo Apple ở góc trên bên trái, chọn **Giới thiệu về máy Mac
này**. Dòng "Chip" ghi Apple M1, M2… là chip Apple. Dòng "Bộ xử lý" ghi Intel là chip Intel.

Chưa rõ máy Windows bản nào thì bấm phím <kbd>Windows</kbd> + <kbd>R</kbd>, gõ `winver` rồi Enter.

## Cài trên Windows 10, 11

1. Chạy file `.exe` vừa tải.
2. Windows hiện khung xanh **Windows đã bảo vệ PC của bạn** (Windows protected your PC). App chưa có
   chữ ký số nên Windows chưa nhận ra, file vẫn an toàn. Bấm **Thông tin thêm** (More info), rồi
   **Vẫn chạy** (Run anyway).
3. Trình cài đặt bằng tiếng Việt. Chọn cài cho riêng bạn hay cho mọi người dùng máy, đổi thư mục
   cài nếu muốn, rồi bấm Cài đặt.
4. Cài xong, màn hình nền và menu Start có biểu tượng **Xổ Số Đại Lý**.

Bước 2 chỉ gặp ở lần cài đầu tiên.

## Cài trên Windows 7, 8, 8.1

Dùng file có chữ `win7` trong tên. Một bộ cài chạy được cả máy 32-bit lẫn 64-bit, tự chọn theo máy.
Các bước giống hệt Windows 10. Windows hỏi có chạy file không thì bấm **Chạy** (Run).

::: warning Về bản Windows 7
Bản này dựng trên Electron 22, phiên bản cuối còn chạy được Windows 7. Electron 22 đã ngừng nhận
bản vá bảo mật từ tháng 10-2023. Với app này rủi ro thấp: app không mở trang web nào, nội dung tải
về chỉ được đọc để lấy số. Máy chạy được Windows 10 thì nên dùng bản Windows 10, 11.
:::

## Cài trên macOS

1. Mở file `.dmg`, kéo biểu tượng app vào thư mục **Applications**.
2. Mở app lần đầu. macOS báo không kiểm tra được nhà phát triển, bấm **Xong** (Done). Đừng bấm
   Chuyển vào Thùng rác.
3. Mở **Cài đặt hệ thống** (System Settings), vào **Quyền riêng tư & Bảo mật** (Privacy &
   Security). Kéo xuống cuối sẽ thấy dòng nhắc tới "Xo So Dai Ly". Bấm **Vẫn mở** (Open Anyway),
   nhập mật khẩu máy.
4. Từ lần sau, app mở như mọi app khác.

Máy chạy macOS 14 trở về trước thì làm gọn hơn: chuột phải vào app, chọn **Mở** (Open), rồi bấm
**Mở** lần nữa.

macOS báo app "đã hỏng, nên chuyển vào Thùng rác" thì mở Terminal, gõ lệnh dưới rồi mở lại app:

```bash
xattr -cr "/Applications/Xo So Dai Ly.app"
```

App chưa có chứng chỉ của Apple nên macOS chặn ở lần đầu. File cài vẫn là file build thẳng từ mã
nguồn trên GitHub.

## Cài trên Linux

File `.AppImage` chạy được trên hầu hết các bản Linux. Cấp quyền chạy rồi mở:

```bash
chmod +x xo-so-dai-ly-*.AppImage
./xo-so-dai-ly-*.AppImage
```

Ubuntu 22.04 trở lên có thể báo thiếu FUSE. Khi đó cài thêm `libfuse2` (Ubuntu 24.04 là
`libfuse2t64`).

Ubuntu, Debian dùng file `.deb` thì app có sẵn trong menu:

```bash
sudo apt install ./xo-so-dai-ly-*-linux-amd64.deb
```

## Cập nhật bản mới

App không tự cập nhật. Tải file cài bản mới ở bảng trên rồi cài đè lên bản cũ. Thông tin đại lý,
đài và mẫu phiếu đã lưu vẫn giữ nguyên.

Phiên bản đang dùng ghi ở thanh dưới cùng màn Cài đặt. Mỗi bản có gì mới, xem trang
[Thay đổi](/thay-doi).

## Gỡ app

| Máy | Cách gỡ |
|---|---|
| Windows 10, 11 | Cài đặt → Ứng dụng → Xổ Số Đại Lý → Gỡ cài đặt |
| Windows 7, 8 | Control Panel → Programs and Features → Xổ Số Đại Lý → Uninstall |
| macOS | Kéo app trong Applications vào Thùng rác |
| Linux (.deb) | `sudo apt remove xo-so-dai-ly` |
| Linux (.AppImage) | Xoá file `.AppImage` |

Gỡ app không xoá cài đặt và các file PDF, Word đã lưu. Muốn xoá sạch thì xoá thêm thư mục dữ liệu:

| Máy | Thư mục dữ liệu (cài đặt, kết quả đã tải) |
|---|---|
| Windows | `%APPDATA%\XSMN` |
| macOS | `~/Library/Application Support/XSMN` |
| Linux | `~/.config/XSMN` |

File PDF, Word mặc định nằm trong thư mục **Tài liệu/XSMN** (Documents/XSMN).
