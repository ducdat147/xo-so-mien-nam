# xsmn.sh - Kết quả xổ số miền Nam ra file PDF / Word

Script bash lấy kết quả XSMN từ minhngoc.net.vn và xuất file **PDF** (mặc định)
hoặc **Word .docx**. Bố cục theo mẫu đại lý vé số: thông tin đại lý, ngày,
bảng Giải × Đài từ giải Tám đến ĐB. Mỗi phiếu rộng 8 cm; cỡ số tự co giãn
để luôn vừa phiếu.

| Khổ giấy | Số bản / tờ | Cách xếp |
|---|---|---|
| A4 (mặc định) | 4 | A4 đứng, lưới 2×2, phiếu cao ~13,6 cm |
| A5 | 2 | A5 nằm ngang, 2 bản cạnh nhau, phiếu cao ~13,2 cm |
| A6 | 1 | A6 đứng, phiếu cao ~13,2 cm |

## Cài đặt

Cần: `bash`, `curl`, `xmllint`, `zip` (hoặc `python3`), và **LibreOffice** để xuất PDF.

- macOS: có sẵn hết trừ LibreOffice → `brew install --cask libreoffice`
- Ubuntu/Debian: `sudo apt install curl libxml2-utils zip libreoffice-writer`

Không có LibreOffice thì vẫn xuất được `.docx` (`-f docx`). Nếu đòi PDF mà
máy chưa có LibreOffice, script lưu bản `.docx` thay thế và báo cách cài.

```bash
chmod +x xsmn.sh
cp xsmn.conf.example xsmn.conf   # rồi sửa thông tin đại lý
```

## Cách dùng

```bash
./xsmn.sh                         # kết quả hôm nay -> xsmn_DD-MM-YYYY_A4.pdf
./xsmn.sh -d 25-10-2026           # ngày khác
./xsmn.sh -c ~/dai-ly.conf        # chỉ định file config
./xsmn.sh -p A5                   # khổ A5, 2 bản/tờ (A4 = 4 bản, A6 = 1 bản)
./xsmn.sh -f docx                 # xuất Word thay vì PDF (both = cả hai)
./xsmn.sh -o ~/Desktop/kq.pdf     # chỉ định file xuất (đuôi .pdf/.docx quyết định định dạng)
./xsmn.sh --blank                 # phiếu trống theo lịch quay (in trước giờ xổ)
./xsmn.sh --text                  # chỉ in ra màn hình
./xsmn.sh --html trang.html       # parse file HTML đã lưu, không tải mạng
```

XSMN quay khoảng 16h15-16h35. Chạy sớm hơn, script báo chưa có kết quả.
Nếu đang quay dở, script vẫn xuất file nhưng để trống ô chưa có số và cảnh báo.

Kết quả đầy đủ được cache ở `~/.cache/xsmn/` để lần sau không tải lại
(`--no-cache` để bỏ qua).

## File config

Tìm lần lượt: `./xsmn.conf`, cạnh script, `~/.config/xsmn/xsmn.conf`.
Không có config: lấy đủ các đài quay trong ngày, phiếu không in thông tin đại lý.

| Khoá | Ý nghĩa |
|---|---|
| `AGENT_NAME`, `AGENT_LABEL` | Tên đại lý, nhãn trước tên |
| `AGENT_ADDRESS` | Địa chỉ (tự thêm "ĐC: ") |
| `AGENT_FAX`, `AGENT_PHONES` | Fax; nhiều số DĐ cách nhau bằng `\|` |
| `AGENT_CONTACT` | Tự viết nguyên dòng liên hệ (ghi đè 2 khoá trên) |
| `NOTE` | Ghi chú chữ đỏ dưới chữ "Tư" |
| `STATIONS` | Đài quan tâm cho mọi ngày |
| `STATIONS_T2` … `STATIONS_T7`, `STATIONS_CN` | Đài riêng cho từng thứ |
| `NAME_<mã-đài>` | Tên in trên phiếu, ví dụ `NAME_dong-thap="Đ.Tháp"` |
| `OUTPUT_FORMAT` | `pdf` (mặc định), `docx` hoặc `both` |
| `PAPER` | `A4` (4 bản, mặc định), `A5` (2 bản), `A6` (1 bản) |
| `SOFFICE` | Đường dẫn LibreOffice nếu script không tự tìm thấy |
| `CARD_WIDTH_CM` | Bề ngang mỗi phiếu, mặc định 8 (tối đa ~9,3 với A4/A5, ~8,9 với A6) |
| `CARD_GAP_CM` | Khoảng cách giữa các phiếu, mặc định 0,6 cm (0 = dính sát) |
| `CARD_ALIGN` | Vị trí cụm phiếu trên trang (mặc định trái) |
| `ALIGN_TEXT`, `ALIGN_NUMBER` | Căn chữ trong bảng (mặc định giữa) và các số (mặc định phải) |
| `NUMBER_PAD_RIGHT_CM` | Khoảng cách từ số tới đường kẻ phải của ô, mặc định 0,3 cm |
| `NUMBER_FONT_PT` | Cỡ chữ số kết quả; bỏ trống = tự chọn cỡ lớn nhất vừa phiếu |
| `OUTPUT_DIR`, `FONT`, `COLOR_*` | Thư mục xuất, font, màu |

Mã đài: `tp-hcm dong-thap ca-mau ben-tre vung-tau bac-lieu dong-nai can-tho
soc-trang tay-ninh an-giang binh-thuan vinh-long binh-duong tra-vinh long-an
binh-phuoc hau-giang tien-giang kien-giang da-lat`

## Chạy tự động mỗi ngày (tuỳ chọn)

```cron
# 16h45 hằng ngày, giờ Việt Nam
45 16 * * * cd /đường/dẫn/xsmn && ./xsmn.sh -q
```

## Khi web đổi giao diện

Parser dựa vào cấu trúc: bảng `table.bkqmiennam` đầu tiên → mỗi đài là
`table.rightcl` → ô `td.giai8` … `td.giaidb` chứa các `<div>` số.
Lưu trang lỗi bằng `curl -o trang.html <url>` rồi chạy `--html trang.html`
để thử; file mẫu nằm trong `tests/`.
