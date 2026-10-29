# Xổ Số Đại Lý (XSMN) — app lấy & in kết quả xổ số miền Nam

App desktop (Electron, release riêng cho macOS / Windows / Linux) cho đại lý vé số:
lấy kết quả XSMN theo ngày từ minhngoc.net.vn, xem trước và in phiếu theo mẫu đại lý
(A4 = 4 bản, A5 = 2, A6 = 1), lưu PDF hoặc Word. Giao diện và thông báo: **tiếng Việt**.

## Đọc trước khi làm

1. `docs/SPEC.md`: đặc tả đầy đủ (nguồn dữ liệu, cài đặt, **số đo bố cục phiếu**, UI,
   xuất file, đóng gói, nghiệm thu). Đây là nguồn sự thật.
2. `design/`: giao diện đã được chủ dự án duyệt (Main = màn Kết quả, CaiDat = màn Cài
   đặt, Phieu = phiếu in). Làm UI bám sát bản này.
3. `app/test/golden/*.document.xml`: bản chụp file Word chuẩn, chụp từ bản bash cũ (đã bỏ
   ngày 29-10-2026). App phải ra giống hệt; `design/reference/*.pdf` là bản in mẫu cùng nguồn.

## Thư mục

```
design/     thiết kế UI đã duyệt (.dc.html) + reference/ PDF mẫu
docs/       SPEC.md
app/        app Electron (core/ = logic thuần có test, main/, preload/, renderer/)
  test/fixtures/   HTML minhngoc mẫu + xsmn.conf.example (file cấu hình kiểu cũ, vẫn phải nhập được)
  test/golden/     bản chụp file Word chuẩn
```

Bản dòng lệnh bash (`cli/`) đã bỏ ngày 29-10-2026 (lấy lại được trong git nếu cần). App vẫn
nhập/xuất cấu hình bằng file `.conf` (KEY=VALUE), nhận cả khoá kiểu cũ của bản bash.

## Quyết định đã chốt (đừng đổi khi chưa hỏi)

- Tên kỹ thuật khi đóng gói phải **không dấu** (`Xo So Dai Ly`), tên có dấu chỉ để hiển thị
  (xem SPEC §9: có dấu thì app mac sập).
- Tên sản phẩm **Xổ Số Đại Lý**, logo mẫu C "Phiếu dò" (`design/logo/`); tên + logo ở
  `app/src/shared/brand.ts`. Thư mục dữ liệu vẫn là `XSMN`.
- Electron (không Tauri); release **từng OS riêng**; chưa ký số.
- Thêm **bản Windows 7** (đại lý đang dùng Win7, chốt 28-10-2026): build bằng Electron 22.3.27
  (bản cuối chạy Win7), một bộ cài cho cả 32-bit lẫn 64-bit. Vì vậy code main/core phải chạy
  được trên **Node 16**: không dùng `AbortSignal.any`, `structuredClone`, `fetch`/`Response`
  toàn cục; tải trang qua `main/http.ts` (có `net.fetch` thì dùng, không thì `https` của Node);
  cheerio import từ `cheerio/slim`. Renderer phải chạy trên Chromium 108.
- PDF bằng `webContents.printToPDF` từ HTML; Word bằng tự sinh OOXML + jszip.
  **Không** dùng LibreOffice, **không** gọi bash.
- Một layout engine (`core/layout`) tính bằng twips, dùng chung cho HTML và DOCX.
- Font phiếu: **chỉ dùng font đã cài trên máy** (chốt 29-10-2026, bỏ Tinos/Arimo nhúng sẵn).
  Danh sách lấy bằng `queryLocalFonts`, mặc định Times New Roman. PDF nhúng font máy khi xuất;
  máy khác thiếu font thì in bằng font thay thế. Layout tính theo Times; font rộng hơn thì
  renderer đo tỉ lệ (`FontScale`) gửi kèm yêu cầu để main tính cùng một layout.
- Thông tin đại lý mặc định để trống. Ngày mở sẵn: trước 16h (giờ VN) là hôm qua.
- Mặc định: PDF, khổ A4, phiếu rộng 8 cm, cách nhau 0,6 cm, cụm phiếu căn trái, chữ
  trong bảng căn giữa, số căn phải cách lề ô 0,3 cm, cỡ số tự động, toàn màu đen.
- Màn chính là Kết quả, không có tab; Cài đặt mở bằng nút bánh răng góc trên bên phải.
  Màn Kết quả có ô "Số bản in" cạnh nút In… (cả hai do chủ dự án thêm 28-10-2026).
- In: bấm In mở **bước xem trước khi in** trong app (không dựa vào hộp thoại hệ thống vì Windows
  không có xem trước, máy chưa cài máy in thì hộp thoại không mở). Có máy in cụ thể → in thẳng;
  không → hộp thoại hệ thống. In lỗi thì báo lỗi, **không** tự xuất/mở file PDF.
  Cột trái màn Kết quả chia nhóm **In phiếu** và **Lưu file** riêng; Khổ giấy và "In phiếu trống"
  nằm đầu nhóm In phiếu. Dải trạng thái kết quả nằm bên phải, trên khung xem trước (chủ dự án
  chuyển cả ba 29-10-2026). Code in ở `main/print.ts`.

## Lưu ý kỹ thuật

- HTML minhngoc **thiếu `</td>`** giữa các cột đài; chỉ lấy bảng `table.bkqmiennam`
  ĐẦU TIÊN; mã đài lấy từ `href` (`/xo-so-mien-nam/<slug>.html`); kiểm tra `td.ngay`
  đúng ngày yêu cầu, sai ngày nghĩa là chưa có kết quả.
- Đang quay thì trang kết quả theo ngày còn hiện bảng hôm qua; số mới chỉ có ở bảng trực tiếp
  (`core/live.ts`, file `js_m1.js` trên `server-liveNN`, SPEC §3). Chỉ hỏi trong 16h–17h của hôm
  nay. Không parse số từ HTML trang trực tiếp: ô đang quay là chữ số chạy ngẫu nhiên.
- Ngày/thứ luôn tính theo giờ Việt Nam (Asia/Ho_Chi_Minh), không theo múi giờ máy.
- DOCX: trong `w:tblPr` thứ tự phải là `tblW, jc, tblBorders, tblLayout, tblCellMar`.
- Electron: `contextIsolation` bật, `nodeIntegration` tắt; mạng và file chỉ ở main process.

## Lệnh

Dùng `make` ở gốc repo (gõ `make` để xem đủ danh sách).

```bash
make install    # npm install trong app/
make dev        # chạy app, tự nạp lại khi sửa code
make check      # typecheck + unit test
make build      # build vào app/out
make build-win7 # build cho Electron 22 (Node 16, Chromium 108) — bản Win7
make golden     # cập nhật bản chụp file Word chuẩn — chỉ khi CỐ Ý đổi bố cục, xem diff trước khi commit
make dist-mac   # đóng gói (dist-win, dist-win7, dist-linux) → app/release/
make version V=1.1.0   # đặt phiên bản mới; nhớ thêm mục vào CHANGELOG.md rồi tag v1.1.0
```

Terminal của VS Code đặt sẵn `ELECTRON_RUN_AS_NODE=1` làm Electron chạy như Node;
Makefile đã gỡ biến này. Chạy thử với dữ liệu riêng: `XSMN_USER_DATA=/thư/mục make dev`.
