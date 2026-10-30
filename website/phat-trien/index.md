# Chạy từ mã nguồn

App viết bằng Electron, React và TypeScript, build bằng electron-vite. Mã nguồn ở
[github.com/ducdat147/xo-so-mien-nam](https://github.com/ducdat147/xo-so-mien-nam), giấy phép MIT.

## Cần có

- [Node.js](https://nodejs.org) 24 trở lên, kèm npm.
- git.
- `make`. macOS và Linux có sẵn. Trên Windows, dùng Git Bash hoặc chạy thẳng các lệnh `npm` trong
  thư mục `app/`.

## Lấy mã và chạy

```bash
git clone https://github.com/ducdat147/xo-so-mien-nam.git
cd xo-so-mien-nam
make install   # npm install trong app/
make dev       # mở app, sửa code là tự nạp lại
```

Muốn chạy thử mà không đụng cài đặt thật trên máy, trỏ app sang một thư mục dữ liệu riêng:

```bash
XSMN_USER_DATA=/tmp/xsmn-thu make dev
```

::: warning Chạy trong terminal của VS Code
Terminal của VS Code đặt sẵn `ELECTRON_RUN_AS_NODE=1`, làm Electron chạy như Node thường và app không
mở được cửa sổ. Các lệnh `make` đã gỡ biến này. Gọi thẳng `npm run dev` thì chạy
`unset ELECTRON_RUN_AS_NODE` trước.
:::

## Các lệnh `make`

Gõ `make` ở gốc repo để xem đủ danh sách.

| Lệnh | Việc |
|---|---|
| `make install` | Cài thư viện cho app |
| `make dev` | Chạy app ở chế độ phát triển |
| `make start` | Build rồi chạy bản build, giống bản phát hành |
| `make check` | Kiểm tra kiểu TypeScript và chạy unit test |
| `make test-watch` | Chạy test, sửa code là chạy lại |
| `make build-win7` | Build cho Electron 22 (Node 16, Chromium 108) để thử bản Windows 7 |
| `make golden` | Cập nhật bản chụp file Word chuẩn |
| `make dist-mac` | Đóng gói macOS vào `app/release/` (tương tự `dist-win`, `dist-win7`, `dist-linux`) |
| `make docs` | Chạy trang tài liệu này ở máy |

## Cấu trúc thư mục

```text
app/
  src/core/        logic thuần, không import electron, có unit test
                   (lấy và đọc kết quả, lịch đài, cài đặt, tính bố cục phiếu, xuất HTML/Word)
  src/main/        tiến trình chính: cửa sổ, mạng, file, lệnh in
  src/preload/     cầu nối window.xsmn giữa giao diện và tiến trình chính
  src/renderer/    giao diện React (screens/ cho từng màn, components/ cho phần dùng chung)
  src/shared/      tên và logo app
  test/fixtures/   trang minhngoc mẫu, file xsmn.conf kiểu cũ
  test/golden/     bản chụp file Word chuẩn
design/            thiết kế giao diện đã duyệt, PDF in mẫu
docs/SPEC.md       đặc tả đầy đủ, là nguồn sự thật khi code
website/           trang tài liệu này (VitePress)
```

Đọc [docs/SPEC.md](https://github.com/ducdat147/xo-so-mien-nam/blob/master/docs/SPEC.md) trước khi
sửa. Các quyết định đã chốt với chủ dự án nằm trong
[CLAUDE.md](https://github.com/ducdat147/xo-so-mien-nam/blob/master/CLAUDE.md).

## Quy ước cần giữ

- Code trong `main/` và `core/` phải chạy được trên **Node 16** vì bản Windows 7 dùng Electron 22.
  Không dùng `structuredClone`, `AbortSignal.any`, `fetch` toàn cục. Tải trang qua `main/http.ts`.
  Giao diện phải chạy được trên Chromium 108.
- Một bộ tính bố cục duy nhất (`core/layout.ts`, đơn vị twips) dùng chung cho xem trước, PDF và Word.
- PDF tạo bằng `printToPDF` từ HTML. Word tự sinh OOXML bằng jszip. Không dùng LibreOffice, không
  gọi bash.
- Mạng và file chỉ đi qua tiến trình chính. Cửa sổ bật `contextIsolation`, tắt `nodeIntegration`.
- Ngày, thứ luôn tính theo giờ Việt Nam (Asia/Ho_Chi_Minh), không theo múi giờ máy.
- Giao diện và thông báo viết bằng tiếng Việt.
- Đổi giao diện hoặc thêm tính năng có phần giao diện thì dựng bản thiết kế trên Figma, chờ chủ dự
  án duyệt rồi mới code.

## Kiểm thử

```bash
make check
```

Test so file Word app xuất ra với bản chụp trong `app/test/golden/`, từng ký tự. Lệch một ký tự là
hỏng. Chỉ chạy `make golden` khi cố ý đổi bố cục phiếu, và xem kỹ diff trước khi commit.

Repo ép mọi file chữ dùng xuống dòng LF (`.gitattributes`). Thiếu nó, máy Windows checkout ra CRLF
và test so bản chụp hỏng.

## Sửa trang tài liệu

Trang này nằm trong thư mục `website/`, viết bằng Markdown.

```bash
make docs        # mở http://localhost:5173/xo-so-mien-nam/
```

Đẩy lên nhánh `master` là GitHub Actions tự build và đăng lại trang. Trang
[Thay đổi](/thay-doi) lấy thẳng nội dung từ `CHANGELOG.md`, không cần chép tay.

Ảnh chụp màn hình nằm ở `website/public/images/`, định dạng WebP. Chụp lại khi giao diện đổi, dùng
thông tin đại lý mẫu, không dùng số điện thoại thật.
