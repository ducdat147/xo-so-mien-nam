# Phát hành bản mới

Mỗi bản phát hành là một tag `v<số phiên bản>` trên GitHub. Đẩy tag lên là GitHub Actions tự build
đủ bộ cài cho mọi hệ điều hành và gắn vào trang Releases.

## Đánh số phiên bản

Số phiên bản có dạng `LỚN.VỪA.NHỎ`:

| Thay đổi | Tăng số | Ví dụ |
|---|---|---|
| Chỉ sửa lỗi | NHỎ | 1.1.0 → 1.1.1 |
| Thêm tính năng, cài đặt cũ vẫn dùng được | VỪA | 1.1.1 → 1.2.0 |
| Thay đổi lớn, người dùng có thể phải chỉnh lại cài đặt | LỚN | 1.2.0 → 2.0.0 |

## Các bước

1. Chạy `make check`, bảo đảm test qua hết.
2. Đặt số phiên bản mới:
   ```bash
   make version V=1.2.0
   ```
3. Thêm mục `## 1.2.0 — <ngày>` lên đầu `CHANGELOG.md`. Đã có mục **Chưa phát hành** thì chỉ cần đổi
   tiêu đề của nó. Ghi thay đổi bằng lời người dùng hiểu được.
4. Commit, tạo tag rồi đẩy lên:
   ```bash
   git commit -am "chore(release): 1.2.0"
   git tag v1.2.0
   git push && git push origin v1.2.0
   ```

## GitHub Actions làm gì

Workflow `.github/workflows/release.yml` chạy bốn job song song, mỗi job trên một máy của GitHub:

| Job | Máy | Ra file |
|---|---|---|
| mac | macOS | `.dmg` cho chip Apple và chip Intel |
| windows | Windows | `.exe` cho Windows 10, 11 |
| win7 | Windows | `.exe` gộp 32 và 64-bit cho Windows 7, 8, 8.1 |
| linux | Ubuntu | `.AppImage` và `.deb` |

Mỗi job lấy đúng commit của tag và kiểm tra tag trùng số phiên bản trong `app/package.json`. Lệch
là dừng, tránh phát hành nhầm số. Sau đó job chạy `npm test`, đóng gói, rồi gắn file vào Release.
Job xong đầu tiên tạo Release, phần ghi chú lấy từ mục của bản đó trong `CHANGELOG.md`.

Muốn build lại riêng một hệ điều hành, vào **Actions → Release → Run workflow**, chọn hệ điều hành và
nhập tag. File mới ghi đè file cũ trên Release.

## Bật trang tài liệu lần đầu

Trang tài liệu do workflow `.github/workflows/docs.yml` build và đăng. Lần đầu cần bật GitHub Pages
một lần: vào **Settings → Pages**, mục **Source** chọn **GitHub Actions**. Từ đó, mỗi lần đẩy thay đổi
trong `website/` hoặc `CHANGELOG.md` lên `master`, trang tự cập nhật.
