# Xổ Số Đại Lý

App máy tính cho đại lý vé số: lấy kết quả xổ số miền Nam từ minhngoc.net.vn, xem trước và in
phiếu dò theo mẫu của đại lý (A4 = 4 phiếu/tờ, A5 = 2, A6 = 1), lưu PDF hoặc Word.

Phiên bản hiện tại: xem `app/package.json` hoặc gõ `make version`. Thay đổi từng bản: [CHANGELOG.md](CHANGELOG.md).

## Cài đặt

Tải file cài ở mục **Releases** của repo:

| Máy | File |
|---|---|
| macOS chip Apple (M1, M2…) | `xo-so-dai-ly-<phiên bản>-mac-arm64.dmg` |
| macOS chip Intel | `xo-so-dai-ly-<phiên bản>-mac-x64.dmg` |
| Windows 10, 11 | `xo-so-dai-ly-<phiên bản>-win-x64.exe` |
| Windows 7, 8, 8.1 (32 hoặc 64-bit) | `xo-so-dai-ly-win7-<phiên bản>.exe` |
| Linux | `.AppImage` (chạy thẳng) hoặc `.deb` (Ubuntu, Debian) |

### Mở lần đầu

App chưa có chữ ký số nên hệ điều hành sẽ cảnh báo ở lần mở đầu tiên. Chỉ cần làm một lần.

- **macOS**: mở file `.dmg`, kéo app vào thư mục Applications. Lần đầu mở, **chuột phải vào app →
  Open → Open**. Nếu macOS báo "đã hỏng, không mở được": mở Terminal, gõ
  `xattr -cr "/Applications/Xo So Dai Ly.app"` rồi mở lại.
- **Windows**: chạy file `.exe`. Gặp màn hình xanh "Windows protected your PC" thì bấm
  **More info → Run anyway**, rồi cài như bình thường.
- **Linux**: `.AppImage` cần cấp quyền chạy (`chmod +x <file>.AppImage`).
  `.deb`: `sudo apt install ./xo-so-dai-ly-<phiên bản>-linux-amd64.deb`.

### Bản Windows 7

Bản Win7 dùng Electron 22, phiên bản cuối còn chạy trên Windows 7/8/8.1. Electron 22 đã ngừng
nhận bản vá bảo mật từ tháng 10-2023. Với app này rủi ro thấp vì app không mở trang web nào: nội
dung tải từ minhngoc chỉ được đọc để lấy số, không hiển thị. Máy chạy được Windows 10 thì nên dùng
bản Windows 10/11.

### Cập nhật bản mới

Tải file cài bản mới và cài đè lên. Cài đặt đã lưu (thông tin đại lý, đài, bố cục) được giữ nguyên.

## Phát triển

Cần Node.js 24 trở lên. Gõ `make` để xem đủ danh sách lệnh.

```bash
make install     # cài thư viện
make dev         # chạy app, tự nạp lại khi sửa code
make check       # kiểm tra kiểu + unit test
make dist-mac    # đóng gói trên máy (dist-win, dist-win7, dist-linux tương tự) → app/release/
```

Tài liệu: [docs/SPEC.md](docs/SPEC.md) (đặc tả), [design/](design/) (giao diện đã duyệt),
[CLAUDE.md](CLAUDE.md) (các quyết định đã chốt). Bản dòng lệnh bash cũ đã bỏ (còn trong lịch sử git);
cài đặt nhập/xuất được bằng file `.conf` ở màn Cài đặt, nhận cả file `xsmn.conf` của bản cũ.

## Phát hành phiên bản mới

1. Đặt số phiên bản mới: `make version V=1.1.0` (sửa lỗi tăng số cuối, thêm tính năng tăng số
   giữa; xem đầu [CHANGELOG.md](CHANGELOG.md)).
2. Thêm mục `## 1.1.0 — <ngày>` lên đầu CHANGELOG.md, ghi các thay đổi.
3. Commit, tạo tag và đẩy lên GitHub:
   ```bash
   git commit -am "Phiên bản 1.1.0"
   git tag v1.1.0
   git push && git push --tags
   ```
4. GitHub Actions (`.github/workflows/release.yml`) tự build đủ 4 loại, tạo Release `v1.1.0`
   với ghi chú lấy từ CHANGELOG và gắn các file cài vào. Muốn build lại riêng một hệ điều hành:
   **Actions → Release → Run workflow**, chọn hệ điều hành và nhập tag.

Workflow dừng nếu tag không khớp version trong `app/package.json`, để tránh phát hành nhầm số.
