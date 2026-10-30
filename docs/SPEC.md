# XSMN — Đặc tả app desktop (Electron)

Tài liệu này là nguồn sự thật cho việc dựng app. Khi có chỗ mâu thuẫn:
**SPEC này > thiết kế trong `design/`**, trừ phần số đo bố cục phiếu: phần đó lấy bản chụp
file Word chuẩn `app/test/golden/*.document.xml` làm chuẩn. Bản chụp và PDF mẫu trong
`design/reference/` do bản bash cũ (`cli/xsmn.sh`, hàm `build_docx`) tạo ra, đã kiểm chứng in
ra đúng. **Bản bash đã bỏ ngày 29-10-2026** (còn trong lịch sử git); app vẫn nhập/xuất cấu hình
bằng file `.conf` và nhận cả khoá kiểu cũ của nó (§5).

---

## 1. Mục tiêu

App desktop chạy riêng trên **macOS, Windows, Linux** (release từng hệ điều hành
riêng) để một đại lý vé số:

1. Lấy **kết quả xổ số miền Nam** của một ngày (mặc định hôm nay, giờ Việt Nam).
2. Xem trước và **in phiếu kết quả** theo mẫu của đại lý (khổ A4 = 4 bản/tờ,
   A5 = 2 bản, A6 = 1 bản).
3. **Lưu PDF** (mặc định) hoặc **Word .docx**.
4. Cấu hình thông tin đại lý, đài cần in và thứ tự đài, bố cục bản in.
5. Sau này: **in thẳng ra máy in** (chọn máy in, in không hộp thoại) — chưa làm
   ở bản đầu, nhưng phải chừa sẵn chỗ trong code (xem §8.3).

Không cần cài thêm gì (không bash, không LibreOffice). Giao diện tiếng Việt.

---

## 2. Công nghệ & cấu trúc (đề xuất)

| Phần | Chọn | Lý do |
|---|---|---|
| Khung app | **Electron ≥ 45** | `printToPDF` và in cho kết quả giống nhau mọi OS |
| Build | **electron-vite** + **TypeScript** | main / preload / renderer tách bạch, HMR |
| Giao diện | **React** | màn Cài đặt nhiều trạng thái (kéo thả, xem trước sống) |
| Parse HTML | **cheerio** | chạy được ở main process, dễ test bằng fixture |
| Tạo .docx | tự sinh OOXML + **jszip** | port thẳng từ `build_docx` của bản bash, đã kiểm chứng |
| Font trên phiếu | **font đã cài trên máy** (`queryLocalFonts`), mặc định Times New Roman | không nhúng sẵn; PDF nhúng font máy khi xuất, bản Word ghi tên font |
| Font giao diện | **@fontsource/be-vietnam-pro** | |
| Test | **vitest** | |
| Đóng gói | **electron-builder** + GitHub Actions | |

Cấu trúc gợi ý (đặt trong `app/` ở gốc repo):

```
app/
  src/main/          main.ts (cửa sổ, IPC), print.ts (§8.3), paths.ts
  src/preload/       index.ts — contextBridge: window.xsmn.*
  src/core/          (Node thuần, test được, KHÔNG import electron)
    stations.ts      danh sách đài, tên viết tắt, lịch quay (§4)
    dates.ts         ngày VN, thứ, định dạng
    source.ts        tải trang minhngoc + cache (§3)
    live.ts          bảng trực tiếp lúc đang quay (§3)
    parse.ts         parse HTML → kết quả (§3)
    select.ts        chọn & sắp xếp đài theo cài đặt (§5)
    settings.ts      mặc định, chuẩn hoá JSON (§5)
    conf.ts          nhập / xuất file .conf (§5)
    settings-file.ts đọc / ghi settings.json (chỉ main dùng)
    layout.ts        TÍNH bố cục phiếu (§6) — dùng chung cho HTML và DOCX
    sheet.ts         kết quả + cài đặt → layout, tên file; renderer và main cùng gọi
    render-html.ts   HTML trang in (xem trước, PDF, in)
    render-docx.ts   OOXML + jszip
  src/renderer/src/  React app, chỉ gọi main qua window.xsmn
    App.tsx          khung app: thanh trên, chuyển màn, hỏi khi rời Cài đặt
    useSettingsDraft.ts  cài đặt đã lưu + bản nháp đang sửa ở màn Cài đặt
    labels.ts        lựa chọn và nhãn dùng chung hai màn (khổ giấy, loại file…)
    hooks.ts         font máy, trạng thái mạng, danh sách máy in
    fonts.ts         đọc font máy, đo FontScale (§6.5)
    components/      phần dùng ở nhiều nơi: ô số gọn, khung xem trước, hộp in, thông báo, icon…
    screens/
      ResultsScreen.tsx   màn Kết quả (§7.1), chỉ ghép các phần
      results/            hook ngày xổ + tự lấy lại kết quả; thẻ Ngày xổ, In phiếu, Lưu file
      SettingsScreen.tsx  màn Cài đặt (§7.2), chỉ ghép các thẻ
      settings/           thẻ thu gọn được, từng phần cài đặt, xem trước phiếu, thanh cuối
  test/fixtures/     HTML minhngoc mẫu + xsmn.conf.example (file cấu hình kiểu cũ)
```

Chia component ở renderer: file màn hình chỉ giữ trạng thái chung và ghép các phần. Mỗi thẻ, mỗi
phần cài đặt là một file riêng. Phần chỉ một màn dùng nằm trong thư mục của màn đó, dùng ở cả hai
màn thì đưa vào `components/`. Việc tải kết quả và các hẹn giờ lấy lại / đổi ngày nằm trong hook
(`useDayResult`, `useDrawDate`), không viết lẫn trong JSX. Phép tính bố cục (kể cả mức tối đa
hiện trên màn hình) gọi hàm của `core/`, không chép công thức sang renderer.

Bảo mật Electron: `contextIsolation: true`, `nodeIntegration: false`, `sandbox: true`
cho renderer; mọi truy cập mạng/file đi qua IPC ở main.

---

## 3. Nguồn dữ liệu: minhngoc.net.vn

- URL: `https://www.minhngoc.net.vn/ket-qua-xo-so/mien-nam/DD-MM-YYYY.html`
- Tải ở **main process** bằng `net.fetch` của Electron (đi theo proxy hệ thống),
  header `User-Agent` kiểu trình duyệt + `Accept-Language: vi-VN`. Timeout ~25s,
  thử lại 2 lần.
- Trang trả về HTML render sẵn ở server (không cần JS). Trang chứa ~7 ngày; **chỉ
  lấy bảng đầu tiên**.

### Cấu trúc HTML (đã kiểm chứng trên trang thật 26-10-2026)

```
table.bkqmiennam                      ← lấy cái ĐẦU TIÊN
  table.leftcl
    td.thu   "Thứ hai"
    td.ngay  <a>26/10/2026</a>        ← so với ngày yêu cầu
  table.rightcl   (mỗi đài một bảng, theo thứ tự trên web)
    td.tinh  <a href="/xo-so-mien-nam/tp-hcm.html">TP. HCM</a>   ← mã đài = slug trong href
    td.matinh  "XSHCM - 10E2"          ← mã vé (hiển thị ở bảng kết quả)
    td.giai8 … td.giai1, td.giaidb     ← mỗi số là một <div>74</div>
```

Lưu ý:
- HTML gốc **thiếu `</td>`** giữa các cột đài (`</table><td …><table class="rightcl">`)
  và không có thuộc tính trên `<div>` (class `giaiSo` chỉ do JS trang thêm sau).
  Parser phải chịu được — fixture trong `app/test/fixtures/` mô phỏng đúng điều này.
- Lấy số bằng cách lấy chuỗi chữ số trong từng `<div>` của ô.
- Số lượng số mỗi giải: 8:1, 7:1, 6:3, 5:1, 4:7, 3:2, 2:1, 1:1, ĐB:1 (= 18 số/đài).

### Trạng thái kết quả

| Trạng thái | Điều kiện | Giao diện |
|---|---|---|
| `ok` | `td.ngay` = ngày yêu cầu và mọi đài đủ 18 số | thẻ xanh "Đã có kết quả đầy đủ" |
| `partial` | đúng ngày nhưng thiếu số (đang quay trực tiếp) | thẻ xanh dương "Đang quay trực tiếp", thanh tiến độ, ô thiếu để trống |
| `none` | `td.ngay` khác ngày yêu cầu (chưa quay / ngày tương lai) | thẻ vàng "Chưa có kết quả…", gợi ý in phiếu trống |
| `error` | lỗi mạng / không thấy bảng | thông báo lỗi + nút thử lại (chia 3 loại bên dưới) |

Lỗi chia 3 loại (`errorKind`, chủ dự án yêu cầu 28-10-2026):
- `offline` (không ra được Internet: `ERR_INTERNET_DISCONNECTED`, `ENOTFOUND`…): thẻ xám
  "Đang chờ kết nối mạng…" + thanh báo dưới thanh trên cùng khi hệ điều hành báo mất mạng.
  Có mạng lại thì tự lấy ngay; hệ điều hành báo có mạng mà vẫn lỗi thì 15 giây thử một lần.
- `server` (máy chủ minhngoc lỗi 5xx/4xx, từ chối kết nối, quá chậm): thẻ đỏ "Máy chủ
  minhngoc.net.vn đang gặp sự cố" kèm mã lỗi; 2 phút tự thử lại một lần.
- `parse` (tải được nhưng không có bảng kết quả: bảo trì / đổi giao diện): thẻ đỏ "Không đọc
  được trang kết quả".

XSMN quay khoảng **16h15–16h35** giờ VN. Với `partial`/`none` có tuỳ chọn
**"Tự lấy lại mỗi 2 phút đến khi đủ"** (bật sẵn). Đang lấy từ bảng trực tiếp thì nhãn thành
**"Tự cập nhật trực tiếp đến khi đủ"** và 5 giây hỏi lại một lần (xem dưới).

### Bảng trực tiếp (đã kiểm chứng lúc đang quay 29-10-2026)

Trong lúc quay, trang kết quả theo ngày vẫn hiện bảng **hôm qua** đầu tiên (chụp 16h23), tới lúc
quay xong mới có số. Số quay tới đâu chỉ có ở trang `xo-so-truc-tiep/mien-nam.html`: trang này
hỏi file `/xstt/js_m1.js` trên các máy chủ `server-liveNN.minhngoc.net.vn` (danh sách nằm trong
biến `rawDomainStr` của trang) khoảng 1,2 giây một lần. File chỉ vài trăm byte:

```
kqxs.mn={run:1,tinh:"13,14,15",ntime:1793264429,delay:1200,kq:{
  13:{lv:"10K5",8:"15",7:"009",6:["0969","9301","9684"],5:"1293",4:[…7 số…],
      3:["49657","+++++"],2:"*****",1:"*****",0:"******"}, 14:{…}, 15:{…}}};
```

- `run` = 1 khi đang quay; `ntime` = giờ mở phiên (giây Unix) → ngày của phiên, phải trùng
  ngày yêu cầu; `tinh` = mã tỉnh của minhngoc theo thứ tự trên web.
- `kq[mã tỉnh]`: `lv` ký hiệu vé (mã vé chỉ có phần này, không có tiền tố `XSxx -`); khoá
  `8`…`1` là giải Tám…Nhất, `0` là ĐB. `+++++` là ô đang quay, `*****` là ô chưa tới lượt:
  chỉ nhận chuỗi toàn chữ số.
- Mã tỉnh → đài chỉ tra được trong HTML trang trực tiếp: cột đài có `td.tinh a[href]` (slug như
  §3) và `span#loaive_<mã tỉnh>`. Mã tỉnh chưa tra được thì bỏ bảng trực tiếp, **không** đoán
  theo lịch (sai đài là in sai số).
- Ô đang quay trên trang trực tiếp chứa chữ số chạy ngẫu nhiên (`span.runLoto`): **không**
  parse số từ HTML trang này, chỉ lấy bảng mã tỉnh.
- File là mã JS tải về: **không eval**, chuyển object literal sang JSON rồi `JSON.parse`.

Chỉ hỏi bảng trực tiếp khi lấy **ngày hôm nay** và đang trong khung **16h–17h** giờ VN; ngoài
khung đó app không đụng tới máy chủ trực tiếp. Mỗi lần hỏi chỉ tải `js_m1.js`; trang trực
tiếp (~230 KB) chỉ tải lần đầu gặp mã tỉnh lạ hoặc khi mọi máy chủ trong danh sách mặc định
đều lỗi. Máy chủ lỗi thì chuyển sang máy kế tiếp.

- `run` = 1 và còn thiếu số → dùng luôn (`partial`), không tải trang kết quả; renderer hỏi lại
  sau 5 giây, không bật trạng thái "Đang làm mới…" của nút.
- Quay xong feed vẫn để `run` = 1 thêm một lúc (chụp 16h36, `delay` đổi sang 5000). Đủ số rồi
  thì tải trang kết quả: trang đủ số thì dùng trang và cache; chưa đủ thì dùng bảng trực tiếp
  (không cache).
- Hết phiên feed chỉ còn `kqxs.mn={run:0,tinh:"13,14,15",ntime:…,delay:5000};`, không có `kq`
  (chụp 16h38) → như chưa có bảng trực tiếp, đọc trang kết quả. Feed tải được mà rỗng thì không
  hỏi máy khác.
- Lỡ một lần hỏi lỗi giữa phiên quay: main trả lại bảng đang có, đánh dấu `stale` (màn hình, in,
  lưu vẫn cùng một bảng); thẻ trạng thái thêm "đang thử kết nối lại", renderer hỏi tiếp. Hết
  khung 16h–17h thì báo lỗi như thường.
- Máy chủ trực tiếp lỗi hết → chạy như chưa có bảng trực tiếp. Mỗi máy chờ tối đa 4 giây (trang
  web chờ 5 giây) để lần lấy đầu không bị đứng lâu.

Giữ mượt cho người dùng (chủ dự án yêu cầu 29-10-2026):
- Đang mở "Xem trước khi in", đang in hoặc đang lưu thì tạm dừng tự lấy lại: bản in đúng bản vừa
  xem, số không nhảy giữa chừng. Đóng hộp thì hỏi tiếp.
- Cửa sổ thu nhỏ lâu thì Chromium giãn hẹn giờ; mở lại lúc đang quay là lấy số mới ngay.
- Phiên đã mở mà chưa ra giải nào (16h–16h15): thẻ ghi "Sắp quay trực tiếp", không ghi "đang quay
  0/9 giải".
- Bảng kết quả tô vàng nhạt số vừa ra rồi tắt dần (2,5 giây; tắt nếu máy bật giảm chuyển động).
  Số có sẵn lúc mở bảng không tô. Khung xem trước ghi thẳng vào iframe nên không nháy trắng.

### Cache

Chỉ cache khi `ok` (đủ số): `userData/cache/DD-MM-YYYY.html`. Lần sau lấy lại
ngày đó dùng cache; nút "Làm mới kết quả" có thể ép tải lại.

---

## 4. Đài & lịch quay

| Mã (slug) | Tên đầy đủ | Viết tắt mặc định | Thứ |
|---|---|---|---|
| tp-hcm | TP. Hồ Chí Minh | TP.HCM | T2, T7 |
| dong-thap | Đồng Tháp | Đ.Tháp | T2 |
| ca-mau | Cà Mau | C.Mau | T2 |
| ben-tre | Bến Tre | B.Tre | T3 |
| vung-tau | Vũng Tàu | V.Tàu | T3 |
| bac-lieu | Bạc Liêu | B.Liêu | T3 |
| dong-nai | Đồng Nai | Đ.Nai | T4 |
| can-tho | Cần Thơ | C.Thơ | T4 |
| soc-trang | Sóc Trăng | S.Trăng | T4 |
| tay-ninh | Tây Ninh | T.Ninh | T5 |
| an-giang | An Giang | A.Giang | T5 |
| binh-thuan | Bình Thuận | B.Thuận | T5 |
| vinh-long | Vĩnh Long | V.Long | T6 |
| binh-duong | Bình Dương | B.Dương | T6 |
| tra-vinh | Trà Vinh | T.Vinh | T6 |
| long-an | Long An | L.An | T7 |
| binh-phuoc | Bình Phước | B.Phước | T7 |
| hau-giang | Hậu Giang | H.Giang | T7 |
| tien-giang | Tiền Giang | T.Giang | CN |
| kien-giang | Kiên Giang | K.Giang | CN |
| da-lat | Đà Lạt | Đ.Lạt | CN |

Thứ tự mặc định trong ngày = thứ tự trên web (T2: tp-hcm, dong-thap, ca-mau;
T7: tp-hcm, long-an, binh-phuoc, hau-giang; …). Lịch cố định này dùng cho
**phiếu trống** (chưa có kết quả). Đài lạ (slug không có trong bảng) vẫn hiện,
tên lấy từ web.

Tên thứ trên phiếu: "Thứ Hai" … "Thứ Bảy", "Chủ Nhật". Tính thứ không phụ thuộc
múi giờ máy: luôn theo ngày VN (Asia/Ho_Chi_Minh).

---

## 5. Cài đặt

Lưu ở `userData/settings.json`. **Thông tin đầu phiếu mặc định để trống** (nhãn, tên, địa chỉ,
số điện thoại); giá trị trong ví dụ dưới chỉ là mẫu (chủ dự án chốt 28-10-2026). Chữ đầu phiếu
**in đúng như đã gõ**: phiếu không tự thêm "ĐC: " hay "DĐ: "; số điện thoại là **một dòng chữ**,
không còn danh sách số (chủ dự án chốt 30-10-2026). Cài đặt `version` 1 (hoặc thiếu) tự chuyển
sang 2 khi đọc: địa chỉ có chữ thì thêm "ĐC: " vào đầu, `phones.values` ghép thành
`contact.value` = "DĐ: …  DĐ: …", bỏ `date.show`; nhờ vậy phiếu in ra như cũ. **Không có dòng Fax và
ghi chú dưới chữ "Tư"** (chủ dự án bỏ 29-10-2026; cài đặt cũ có hai mục này thì bỏ qua). Cỡ chữ
mặc định của nhãn, địa chỉ, DĐ là **10 pt** (chủ dự án chỉnh 28-10-2026; bản bash dùng 8 /
7,5 pt — test so với bash tự đặt lại cỡ chữ của bash). Có nút **Lưu cài đặt**, **Khôi phục mặc định**,
**Nhập từ file .conf…**, **Xuất ra file .conf…** (định dạng ở cuối mục này).

```jsonc
{
  "version": 4,
  "header": {                               // các dòng đầu phiếu, theo thứ tự hiển thị; chữ in nguyên văn
    // label in chung dòng với name, theo align / afterPt của dòng name
    "label":   { "show": true, "size": 10, "value": "Đại lý vé số:" },
    // align: left | center | right; afterPt: khoảng cách tới dòng dưới (pt, 0–20, bước 0,5)
    // mỗi dòng (kể cả label, date) có thêm "color": "000000", "bold": true, "italic": false
    "name":    { "show": true, "size": 14, "value": "ĐỨC QUYẾT", "align": "center", "afterPt": 3 },
    "addr":    { "show": true, "size": 10, "value": "ĐC: Chợ Tapao - Đ.Kho - T.Linh – B.Thuận", "align": "center", "afterPt": 0 },
    "contact": { "show": true, "size": 10, "value": "DĐ: 01212 019 343  DĐ: 0983 019 343", "align": "center", "afterPt": 0 },
    // "Thứ Hai (26-10-2026)": luôn in, luôn là dòng cuối; afterPt = khoảng cách tới bảng
    "date":    { "size": 13, "align": "center", "afterPt": 3 },
    // Bản 4 (30-10-2026): Label in liền trước địa chỉ / dòng liên hệ (như label trước name), mặc định trống
    "addrLabel":    { "show": true, "size": 10, "value": "" },
    "contactLabel": { "show": true, "size": 10, "value": "" },
    // Thứ tự dòng phần đầu (Thứ, ngày luôn cuối): "name" | "addr" | "contact" | id dòng tự do
    "order": ["name", "addr", "contact"],
    // Dòng tự do (tối đa 5 mỗi phần): { id, label, text (như label), align, afterPt }.
    // extra: phần đầu (theo order); footer: dưới bảng, theo thứ tự mảng. id: [a-z0-9]{1,12}
    "extra": [],
    "footer": []
  },
  "stations": {
    "mode": "all",                            // "all" = mọi đài quay trong ngày | "pick" = theo bảng dưới
    "byWeekday": {                            // 0=CN … 6=T7; thứ tự mảng = thứ tự cột trên phiếu
      "1": [{ "slug": "tp-hcm", "on": true }, { "slug": "dong-thap", "on": true }, { "slug": "ca-mau", "on": true }]
      // … đủ 7 ngày theo §4
    },
    "shortNames": { "tp-hcm": "TP.HCM" }      // chỉ lưu khi khác mặc định
  },
  "print": {
    "paper": "A4",                            // A4 | A5 | A6
    "format": "pdf",                          // pdf | docx | both
    "cardWidthCm": 8,
    "cardHeightCm": null,                     // null = tự động (cao hết chỗ trống); số = cm, không vượt chỗ trống
    "cardGapXCm": 0.6,                        // khoảng cách ngang giữa 2 cột phiếu (A4, A5)
    "cardGapYCm": 0.6,                        // khoảng cách dọc giữa 2 hàng phiếu (A4); bản cũ "cardGapCm" → cả hai
    // Dàn cụm phiếu (chủ dự án duyệt 30-10-2026). Theo cột: left | center | right | between | even;
    // theo hàng: top | center | bottom | between | even. between = sát hai lề, phần trống dồn vào
    // giữa các phiếu; even = chia đều cho lề và giữa. cardGapX/YCm là khoảng tối thiểu.
    "cardAlign": "left",
    "cardAlignY": "top",
    // Chữ trong bảng ("Giải", tên giải, tên đài) và số kết quả: padding (cm) + căn 9 vị trí.
    // Bản cũ alignText / alignNumber / numberPadRightCm tự chuyển sang đây (chủ dự án đổi 29-10-2026).
    "textCell":   { "padXCm": 0.05, "padYCm": 0.05, "alignX": "center", "alignY": "top" },
    "numberCell": { "padXCm": 0.3,  "padYCm": 0.05, "alignX": "right",  "alignY": "center" },
    "numberFontPt": null,                     // null = tự chọn cỡ lớn nhất vừa phiếu
    "font": "Times New Roman",                // tên họ font bất kỳ đã cài trên máy
    // Màu (hex, không #) và kiểu chữ từng phần — bản 3 (30-10-2026). Bản 2 có "colors" { text, accent,
    // border, number } chung: text → các dòng đầu phiếu, accent → headRow, prizeLabels và số ĐB
    // (rows.db.numberColor, nếu khác màu số), number → numbers, border → borderColor.
    "borderColor": "000000",
    "headRow": { "labelSize": 12, "color": "000000", "bold": true },     // "Giải" + tên đài (cỡ tên đài tự động)
    "prizeLabels": { "size": 12, "dbSize": 14, "color": "000000", "bold": true },
    "numbers": { "color": "000000", "bold": true, "italic": false, "underline": false },
    // Từng hàng giải 8 … 1, db: sizeDeltaPt cộng vào cỡ số chung (−6…6, bước 0,5; ĐB mặc định +1);
    // màu / kiểu chữ null = theo numbers / prizeLabels; fill null = không tô nền
    "rows": { "db": { "sizeDeltaPt": 1, "numberColor": null, "labelColor": null, "bold": null, "italic": null, "underline": null, "fill": null } }
  },
  "output": { "dir": "~/Documents/XSMN" },
  "printer": {                                // CHƯA DÙNG ở bản đầu (UI hiện "Sắp có")
    "deviceName": null, "silent": false, "copies": 1
  },
  "autoRefresh": true
}
```

Quy tắc chọn đài cho một ngày: `mode = all` → mọi đài trên web, thứ tự web.
`mode = pick` → lấy danh sách của thứ đó, giữ thứ tự trong mảng, chỉ đài `on`
**và có quay hôm đó**; đài quay hôm đó mà không có trong danh sách thì thêm vào
cuối với `on: true`. Nếu không còn đài nào `on` → in đủ các đài (giống bản bash).

**File .conf** (`core/conf.ts`; KEY=VALUE, dòng `#` là chú thích, giá trị trong ngoặc kép giữ
nguyên kể cả `#`). File chỉ gồm **thông tin đại lý, đài và bố cục bản in**; **không** gồm máy in,
thư mục lưu, tự lấy lại (riêng từng máy, chủ dự án bỏ 29-10-2026). **Xuất** ghi đủ phần đó, chia
nhóm có chú thích tiếng Việt, để **nhập lại ra y nguyên** (có test); nhập là ghi đè lên cài đặt
đang có, khoá không có trong file thì giữ.
- `CONF_VERSION=2` ở đầu file xuất. File không có dòng này là kiểu cũ: `AGENT_ADDRESS` được thêm
  "ĐC: " vào đầu (như phiếu cũ tự thêm).
- Đầu phiếu (chữ in nguyên văn, để rỗng là xoá): `AGENT_LABEL` (+ `_SHOW`, `_SIZE`),
  `AGENT_NAME`, `AGENT_ADDRESS`, `AGENT_CONTACT` (dòng liên hệ), mỗi dòng thêm `_SHOW` (1/0),
  `_SIZE` (pt), `_ALIGN` (left | center | right), `_AFTER_PT` (pt); `DATE_LINE_SIZE`,
  `DATE_LINE_ALIGN`, `DATE_LINE_AFTER_PT`. `AGENT_LABEL_ALIGN` / `_AFTER_PT` báo bỏ qua (nhãn theo
  dòng tên).
- Đài: `STATIONS_MODE` (all | pick), `STATIONS_ORDER_T2…T7/CN` (thứ tự cột, `-ma-dai` = không in),
  `NAME_<slug>` (xuất đủ 21 đài).
- Bản in: `PAPER`, `OUTPUT_FORMAT`, `CARD_WIDTH_CM` / `CARD_HEIGHT_CM` (số hoặc `auto`),
  `CARD_GAP_X_CM`, `CARD_GAP_Y_CM`, `CARD_ALIGN`, `CARD_ALIGN_Y`, `FONT`, `NUMBER_FONT_PT` (số hoặc `auto`),
  `TEXT_PAD_X_CM`, `TEXT_PAD_Y_CM`, `TEXT_ALIGN`, `NUMBER_PAD_X_CM`, `NUMBER_PAD_Y_CM`,
  `NUMBER_ALIGN` (`<dọc>-<ngang>`, ví dụ `center-right`).
- Màu, kiểu chữ (`CONF_VERSION=3`): mỗi dòng đầu phiếu thêm `_COLOR` (hex), `_BOLD`, `_ITALIC` (1/0),
  kể cả `AGENT_LABEL_` và `DATE_LINE_`; `BORDER_COLOR`; `HEAD_ROW_SIZE` / `_COLOR` / `_BOLD`;
  `PRIZE_LABEL_SIZE` / `_DB_SIZE` / `_COLOR` / `_BOLD`; `NUMBER_COLOR` / `_BOLD` / `_ITALIC` /
  `_UNDERLINE`; từng hàng `ROW_8` … `ROW_1`, `ROW_DB` + `_SIZE_PT`, `_NUMBER_COLOR`, `_LABEL_COLOR`,
  `_BOLD`, `_ITALIC`, `_UNDERLINE`, `_FILL` (để trống = theo mức chung / không tô nền).
  `COLOR_TEXT/ACCENT/BORDER/NUMBER` của bản 2 vẫn nhận, chuyển như cài đặt JSON bản 2.
- Dòng (`CONF_VERSION=4`): `AGENT_ADDRESS_LABEL`, `AGENT_CONTACT_LABEL` (+ `_SHOW`, `_SIZE`, `_COLOR`,
  `_BOLD`, `_ITALIC`); `HEADER_ORDER` (`name, addr, contact, line1 … line5`); `HEADER_LINES` /
  `FOOTER_LINES` = số dòng tự do, có khoá này thì danh sách thay hẳn theo file; mỗi dòng
  `HEADER_LINE_<n>_LABEL` / `_TEXT` (+ `_SHOW`, `_SIZE`, `_COLOR`, `_BOLD`, `_ITALIC`), `_ALIGN`,
  `_AFTER_PT` (tương tự `FOOTER_LINE_<n>_…`). Dòng `n` không có trong số dòng → báo bỏ qua.
- Khoá kiểu cũ của bản bash vẫn nhận: `STATIONS` / `STATIONS_T2…` (đài được in, giữ thứ tự web),
  `CARD_GAP_CM` (cả hai chiều), `ALIGN_TEXT`, `ALIGN_NUMBER`, `NUMBER_PAD_RIGHT_CM`,
  `AGENT_PHONES` (`|` ngăn cách → "DĐ: …  DĐ: …"; có `AGENT_CONTACT` thì không dùng, như bản bash),
  `AGENT_PHONES_SHOW/SIZE/…` (= `AGENT_CONTACT_…`). `DATE_LINE_SHOW` bỏ qua không báo (dòng luôn in).
  `STATIONS_ORDER_x` ưu tiên hơn `STATIONS_x` hơn `STATIONS`.
- Khoá lạ / giá trị sai (kể cả `AGENT_FAX`, `NOTE`, `SOFFICE`, `OUTPUT_DIR` của bản cũ, và
  `PRINTER` / `PRINT_*` / `AUTO_REFRESH` nếu viết tay vào): bỏ qua, báo tên khoá và số khoá đã nhập.

---

## 6. Bố cục phiếu (layout engine)

`core/layout.ts` nhận (cài đặt, danh sách đài + số, tiêu đề ngày, khổ giấy,
phiếu trống?) và trả về **một mô tả hình học duy nhất** tính bằng **twips**
(1 cm = 567, 1 pt = 20). `render-html` (chia 20 ra pt) và `render-docx` cùng dùng
mô tả này ⇒ PDF và Word giống nhau. Chuẩn tham chiếu: bản chụp `app/test/golden/` (từ
`build_docx` của bản bash cũ) và các PDF trong `design/reference/`.

### 6.1 Trang

| Khổ | Trang (twips) | Hướng | Cột × hàng |
|---|---|---|---|
| A4 | 11906 × 16838 | đứng | 2 × 2 (4 bản) |
| A5 | 11906 × 8391 | ngang | 2 × 1 (2 bản) |
| A6 | 5953 × 8391 | đứng | 1 × 1 (1 bản) |

- Lề trang: 454 (0,8 cm) mọi phía. Khoảng cách tách hai chiều (chủ dự án yêu cầu 29-10-2026):
  `gapX` = cardGapXCm × 567 (giữa các cột: tính bề ngang, lề, `w:cols w:space`, `column-gap`),
  `gapY` = cardGapYCm × 567 (giữa các hàng: tính `cardHMax`, đoạn đệm exact giữa 2 bản trong cột).
  Hai số bằng nhau thì kết quả giống hệt bản bash (một `gap` chung). Dưới đây `gap` là `gapX`
  khi nói về bề ngang, `gapY` khi nói về chiều cao.
- `cardW` = cardWidthCm × 567, tối đa bằng `(usableW − (ncol−1)·gap) / ncol`
  (vượt thì cảnh báo và dùng tối đa; `cardWidthCm = null` = Auto = dùng tối đa, không cảnh báo).
- Nhiều cột: mỗi cột rộng đúng `cardW`; phần dư bề ngang dồn vào lề theo
  `cardAlign` (left → lề phải, right → lề trái, center → chia đôi). `between`: lề giữ nguyên,
  `gapX` thật = gapX + phần dư. `even`: `gapX` thật = max(gapX, ⌊(usableW − ncol·cardW)/(ncol+1)⌋),
  phần còn lại chia đôi cho hai lề. Word: `w:cols w:space` = gapX thật, `w:pgMar` = lề thật. Một
  cột: phần đầu phiếu thụt lề trái/phải theo `cardAlign`, bảng căn theo `cardAlign` (`between`,
  `even` tính như `center`).
- Theo hàng (`cardAlignY`), phần trống dọc `freeY = usableH − nrow·cardH − (nrow−1)·gapY`: top → 0;
  bottom → `topPad = freeY`; center → `freeY/2`; `between` (nhiều hàng) → `gapY` thật = gapY + freeY;
  `even` (nhiều hàng) → `gapY` thật = max(gapY, ⌊(usableH − nrow·cardH)/(nrow+1)⌋), `topPad` = nửa
  phần còn lại; một hàng thì `between`, `even` như center. `topPad` là đoạn đệm (Word: đoạn
  `w:line exact`, chứa luôn ngắt cột) hoặc khối `.top` (HTML) ở đầu mỗi cột. Mặc định top → không đổi.
- `cardHMax = (usableH − (nrow−1)·gap) / nrow`. `cardH = cardHMax` khi `cardHeightCm = null`
  (tự động); có `cardHeightCm` thì `cardH = cardHeightCm × 567`, vượt `cardHMax` thì cảnh báo và
  dùng `cardHMax` (chủ dự án thêm 28-10-2026). Phiếu thấp hơn thì phần bảng (§6.4) tự co, cỡ số
  nhỏ lại. Các bản điền theo cột (cột 1: bản 1,2; cột 2: bản 3,4). Mọi bản giống hệt nhau.
- Mức tối đa rộng / cao mà màn Cài đặt hiện (và dùng làm giá trị Auto) lấy từ `maxCardSizeCm`
  trong `layout.ts`: cùng công thức với `cardW` / `cardHMax`, làm tròn 0,1 cm. Gõ đúng số đó thì
  không bị báo vượt (có test).

### 6.2 Phần đầu phiếu

Các dòng (dòng nào `show:false` hoặc rỗng thì bỏ; dòng thứ, ngày luôn có), chữ **đậm**, in
nguyên văn chữ đã gõ. Cỡ chữ (pt), căn lề (`w:jc` / `text-align`) và cách sau
(`afterPt × 20` twips) lấy từ cài đặt từng dòng; mặc định căn giữa, cách sau như bảng dưới
(giống bản bash):

| Dòng | Nội dung | Chiều cao dòng (exact) | Cách sau mặc định |
|---|---|---|---|
| 1 | label + " " + name (2 run, 2 cỡ; căn lề, cách sau theo name) | max(pt) × 20 × 1.36 (mặc định 380) | 60 (3 pt) |
| 2 | addr | pt × 20 × 1.2 (mặc định 180) | 0 |
| 3 | contact (một dòng; không còn Fax) | pt × 20 × 1.2 | 0 |
| 4 | "Thứ Hai (26-10-2026)" | pt × 20 × 1.31 (mặc định 340) | 60 (3 pt) |

Dòng dài tự xuống dòng: ước lượng số dòng = ⌈Σ(len × pt × 0.5) / (cardW/20)⌉ (đậm
~0,5 em/ký tự), cộng vào `headerH`. Sai số nhỏ đã được trừ hao bằng `safety = 160`.

### 6.3 Bảng

- Cột "Giải": `labW = cardW × 16%`, kẹp trong [600, 900]. Cột đài: `stW = (cardW − labW)/n`.
- Viền đơn 0,75 pt (OOXML `sz=6`) màu `borderColor`, cả trong lẫn ngoài.
  Lề trong ô: trên 30, trái 28, dưới 20, phải 28.
- Chữ: "Giải" 12 pt; tên giải (Tám, Bảy, Sáu, Năm, Tư, Ba, Nhì, Nhất) 12 pt, cách sau 40;
  "ĐB" 14 pt; tên đài 12 pt nếu stW ≥ 1200, 10 pt nếu ≥ 900, còn lại 8 pt. Căn theo
  `textCell` (mặc định giữa-trên: nhãn giải sát trên ô); hàng tiêu đề ("Giải", tên đài) luôn
  giữa ô theo chiều dọc, chỉ lấy căn ngang + padding ngang.
- Số kết quả: đậm, mỗi số một dòng, căn theo `numberCell` (mặc định giữa-phải).
- **Padding + align** (`core/layout` → `cellBox`): lề trong ô mặc định ở trên giữ nguyên; padding
  lớn hơn lề đó thì phần dư (`max(0, padX×567 − 28)`, `max(0, padY×567 − 30)`) thành thụt lề
  ngang / khoảng trước-sau đoạn, **chỉ ở phía nội dung được căn** (căn phải → phải, căn trái →
  trái, căn giữa → cả hai; dọc tương tự). Lý do: số căn phải mà đệm cả bên trái thì ô hẹp đi,
  ngày 4 đài cỡ số tụt 12 → 9,5 pt. Word: `w:vAlign` top/center/bottom, `w:jc`, `w:ind`, `w:spacing
  before/after`; ô số luôn ghi `w:ind` (giống bash). Mặc định cho ra đúng `nind = 142` như bash.
  Bash luôn thụt lề số bên phải dù căn kiểu gì, nên chỉ so từng ký tự với bash khi số căn phải.
- Bề rộng dành cho số: `maxW = (stW − 76 − indentLeft − indentRight) / 30`. Padding dọc làm mỗi
  hàng cao thêm: `rowPad = 60 + max(padTop + padBottom của chữ, của số)` thay cho `pad` ở §6.4.

### 6.4 Cỡ số & chiều cao hàng (tự co giãn)

```
tableH = cardH − headerH − 160
pad    = 60
maxW   = (stW − 76 − nind) / 30            # cỡ (half-point) lớn nhất để 6 chữ số vừa ô
top    = numberFontPt ? numberFontPt*2 : 36
for numSz = top … 15 (half-point):         # giảm dần tới khi vừa
    if numSz > maxW: continue
    L   = numSz × 11                       # chiều cao 1 dòng số (1.1 lần cỡ chữ)
    LDB = (numSz + 2) × 11
    base = 18·L + LDB + 10·pad             # tiêu đề + 17 dòng số + dòng ĐB
    if base ≤ tableH: break
dbSz = min(numSz + 2, maxW − 1), ≥ numSz ;  LDB = dbSz × 11
extra = tableH − base   (âm → 0 + cảnh báo "phiếu chật")
hàng tiêu đề: L + pad;  ĐB: LDB + pad;  giải k: lines(k)·L + pad
mỗi hàng + extra × weight / 168
lines:  8:1 7:1 6:3 5:1 4:7 3:2 2:1 1:1
weight: tiêu đề 10, 8:10, 7:10, 6:26, 5:10, 4:52, 3:18, 2:10, 1:10, ĐB:12
```

Kết quả với mặc định (A4, phiếu 8 cm): 3 đài → số 13,5 pt, ĐB 14,5 pt; 4 đài
(Thứ Bảy) → số 12 pt (bị giới hạn bề ngang). Hàng cao **exact** để không bao giờ
tràn trang. `numberFontPt` lớn quá → hạ xuống cỡ lớn nhất vừa và cảnh báo.

### 6.5 Màu & font

Mặc định toàn bộ **màu đen**, chữ đậm. Màu, đậm / nghiêng / gạch chân, nền hàng lấy từ cài đặt
từng phần (§5); Word: `w:b`, `w:i`, `w:color`, `w:sz`, `w:u` theo đúng thứ tự trong `w:rPr`, nền ô
`w:shd` (giữa `w:tcW` và `w:vAlign`). Cỡ số từng hàng = cỡ chung + `sizeDeltaPt` (§6.4: vòng lặp tính
mỗi hàng bằng cỡ chung + phần cộng; sau đó hàng cộng dương kẹp ≤ maxW − 1 như ĐB, mặc định ra đúng
như bản bash). Font phiếu là font đã cài trên máy, cùng một tên cho HTML
(`'<tên>', serif|sans-serif|monospace`, họ dự phòng đoán theo tên) và Word (`w:rFonts`).
`printToPDF` nhúng font máy vào PDF. Máy không có font đó thì trình duyệt / Word dùng font thay
thế; màn Cài đặt ghi "(máy chưa cài)" và cảnh báo.

Số đo §6.4 tính theo Times New Roman đậm (chữ số 0,5 em). Renderer đo font đang chọn bằng canvas
(chữ số 0–9 và một câu mẫu đầu phiếu, chữ đậm), chia cho số đo của Times ra `FontScale`
{digits, text} rồi gửi kèm yêu cầu xem trước / in / lưu. Layout nhân bề rộng chữ số
(`30 → ceil(30 × digits)` twips mỗi half-point) và bề rộng chữ đầu phiếu với tỉ lệ này, kẹp trong
[1, 2]: font hẹp hơn Times vẫn tính như Times nên mặc định ra đúng bản bash.

---

## 7. Giao diện

Bản thiết kế đã duyệt: `design/` (định dạng `.dc.html` của canvas thiết kế; đọc như
HTML + JS: phần markup là bố cục, khối `<script>` là dữ liệu mẫu và hành vi). Màu
giao diện: nền `#F3F4F6`, thẻ trắng viền `#DDE0E6` bo 12px, chữ `#16181D`, chữ phụ
`#5B6270`, nút chính đen `#16181D`, màu nhấn `#C2410C` (nút In, nút Lưu cài đặt).
Font Be Vietnam Pro. Cửa sổ mặc định 1280×860, tối thiểu 900×640. Màn chính luôn là
**Kết quả**; không có tab. Góc phải thanh trên: "Nguồn: minhngoc.net.vn" và **nút bánh
răng** mở màn **Cài đặt** (chủ dự án đổi 28-10-2026, khác bản thiết kế). Đang ở Cài đặt
thì nút bánh răng ở trạng thái bật, kèm nút "Quay lại Kết quả" ở thanh trên.

### 7.1 Màn Kết quả (`design/Main.dc.html`)

Cột trái (≈320px):
- **Ngày xổ**: ô chọn ngày (mặc định: từ 16h giờ VN là hôm nay, trước 16h là hôm qua vì chưa
  quay; để app mở qua 16h thì tự chuyển sang hôm nay nếu người dùng chưa tự chọn ngày).
  Trước 16h nút "Hôm nay" bị khoá, kèm dòng "Chưa tới 16h nên chưa có kết quả hôm nay."
  Lịch chỉ chọn tới **hôm nay** (giờ VN, `max` của ô ngày); gõ tay ngày sau đó thì đưa về hôm nay. + nút "Hôm nay", "Hôm qua";
  nút của ngày đang xem tô đậm như ô đang chọn của Khổ giấy (`aria-pressed`), chọn ngày khác
  trong lịch thì cả hai bỏ chọn (chủ dự án yêu cầu 29-10-2026);
  dòng phụ: "Thứ Hai · TP.HCM, Đồng Tháp, Cà Mau" (theo lịch).
- Nút **Làm mới kết quả** (app tự lấy khi mở và khi đổi ngày, nút chỉ để ép tải lại nên để kiểu
  chìm: không viền, nền xám nhạt, thấp hơn nút thường; đang tải ghi "Đang làm mới…"; chủ dự án
  đổi tên và giảm độ nổi 29-10-2026).
- Nhóm **In phiếu** (thẻ riêng, chủ dự án yêu cầu 28-10-2026): trên cùng là **Khổ giấy**, 3 nút
  A4 (4 bản/tờ) · A5 (2 bản/tờ) · A6 (1 bản/tờ), mặc định lấy từ cài đặt, rồi ô **"In phiếu trống
  (chưa có số)"** (chủ dự án chuyển cả hai từ thẻ Ngày xổ xuống đây 29-10-2026; hai lựa chọn này
  dùng chung cho bản xem trước và file lưu, tên file có ghi khổ và `_trong`). Sau đó **Máy in** ("Hộp thoại in của
  hệ thống" hoặc một máy in đã cài, nút tìm lại; chọn ở đây được lưu ngay vào
  `printer.deviceName`), **Số bản in** tính theo **tờ**, tối thiểu 1 (ô gọn [biểu tượng hai tờ | 1–99 | tờ], kèm dòng
  "2 tờ A4 = 8 phiếu"; mặc định `printer.copies`), ô **"In nhanh, bỏ qua bước xem trước"**
  (`printer.silent`, chỉ bật được khi đã chọn máy in), nút màu nhấn **Xem trước và in…**
  (In nhanh thì thành **In ngay N tờ**).
- Nhóm **Lưu file** (thẻ riêng): **Loại file** PDF · Word · Cả hai, **Vị trí lưu** (ô chỉ đọc +
  **Chọn…**, lưu ngay vào `output.dir`) + **Mở thư mục**, dòng tên file sẽ lưu, một nút
  **Lưu PDF / Lưu Word / Lưu PDF và Word** theo loại file. Lưu xong hiện thông báo kèm nút mở file.
- Phím tắt: Ctrl/⌘+P = như nút In, Ctrl/⌘+S = lưu theo "Loại file".
- **Xem trước khi in** (hộp lớn trên màn hình, chạy cả khi máy chưa cài máy in): trang in đúng
  như ra giấy, chọn máy in và số tờ, nút **In N tờ** (có máy in cụ thể → in thẳng, không hỏi lại)
  hoặc **In…** (mở hộp thoại in của hệ thống), **Đóng** (Esc; nút có viền như nút thường). Không có
  nút lưu PDF trong hộp này (chủ dự án bỏ 29-10-2026). Máy chưa có máy in → khoá nút In, báo rõ
  và chỉ sang mục Lưu file nếu cần PDF để in ở máy khác. Focus đặt sẵn vào nút In **một lần**
  lúc mở hộp. Đổi số tờ hay máy in trong hộp không được kéo focus đi: ô số tờ chỉ ghi số khi
  rời ô, focus nhảy là ô ghi lại số cũ (bấm ↑ mấy lần vẫn 1 tờ).

Bên phải:
- Nút chuyển **Xem trước bản in** | **Bảng kết quả** + chú thích khổ
  ("A4 đứng · 4 bản · mỗi phiếu 8 × 13,6 cm · cách nhau 0,6 cm").
- **Dải trạng thái** theo §3 (ok / đang quay / sắp quay / chưa có / lỗi / mất mạng) nằm ngay dưới
  thanh đó, trên khung xem trước, vì nó nói về đúng nội dung đang xem (chủ dự án chuyển từ cột trái
  sang 29-10-2026). Chữ bên trái (tiêu đề và mô tả trên một dòng nếu đủ chỗ); bên phải là ô "Tự
  lấy lại…" hoặc nút Thử lại; lúc đang quay có thanh tiến độ mảnh dọc mép dưới.
- *Xem trước bản in*: đúng trang in (HTML từ `render-html`, ghi thẳng vào iframe
  `sandbox="allow-same-origin"`, thu nhỏ cho vừa). Phiếu trống → nhãn "Phiếu trống".
  **Phóng to** (chủ dự án yêu cầu 28-10-2026): thanh − / % / + / Vừa khung / Cỡ thật ở góc,
  Ctrl/⌘ + con lăn hoặc chụm hai ngón (giữ nguyên điểm dưới con trỏ), nhấp đúp để phóng to /
  trở về vừa khung, đang phóng to thì kéo chuột để di chuyển. Dùng chung cho màn Cài đặt và
  bước Xem trước khi in.
- *Bảng kết quả*: bảng chữ lớn để đọc trên màn hình: cột đài (tên đầy đủ + mã vé
  như "XSHCM · 10E2"), giải ĐB nổi bật màu nhấn; ô chưa quay ghi "Chờ quay…". Số trong bảng
  dùng font phiếu đã chọn trong Cài đặt, cùng chuỗi `font-family` với trang in (máy thiếu font thì
  cùng rơi về font dự phòng như bản in; chủ dự án yêu cầu 29-10-2026).

### 7.2 Màn Cài đặt (Figma "Xo So App", trang Màn hình)

Chủ dự án duyệt trên Figma ngày 30-10-2026: màn chia hai tab **Phiếu** | **Chung** (thanh tab dưới
thanh trên; bên phải có nút **Hoàn tác** / **Làm lại**, phím Ctrl/⌘+Z, Ctrl/⌘+Shift+Z hoặc Ctrl+Y,
lùi được mọi thay đổi từ lần lưu gần nhất; gõ liền tay trong 0,6 giây tính là một bước). Nhớ tab
đang mở trong máy.

**Tab Phiếu** là trình sửa một phiếu kiểu Figma, ba cột:
- Trái (248 px) **Thành phần**: cây Phiếu › Đầu phiếu (Dòng 1 … n theo thứ tự in, mỗi dòng là nhóm
  Label + Text; Thứ, ngày có ổ khoá, luôn cuối) › Bảng kết quả (Hàng tiêu đề, Tên giải, Số kết quả, Hàng giải › Giải Tám … ĐB,
thu gọn sẵn) › Cuối phiếu (Dòng cuối 1 … n). Dấu + ở Đầu phiếu / Cuối phiếu thêm dòng tự do (tối
  đa 5 mỗi phần); kéo nhóm Dòng (hoặc Alt + ↑/↓) đổi thứ tự trong phần của nó, kể cả dòng có sẵn;
  Delete hoặc nút thùng rác ở cột phải xoá dòng tự do. Thêm / xoá / đổi thứ tự / ẩn hiện luôn là một
  bước hoàn tác riêng. Mũi tên thu gọn / mở
  nhóm; con mắt ẩn / hiện dòng (nhóm Dòng 1 đổi cả Label lẫn Text). Bàn phím như cây thư mục:
  ↑/↓, ←/→ (thu gọn / mở, lên nhóm cha), Home / End, Esc bỏ chọn.
- Giữa: phiếu xem trước (như cũ: kết quả tải gần nhất hoặc mẫu 26-10-2026, phóng to / thu nhỏ). Rê
  chuột lên phiếu thì phần bên dưới có viền mảnh; bấm để chọn, viền đậm màu nhấn kèm nhãn tên phần,
  cây đánh dấu theo. Bấm một dòng đầu phiếu chọn cả nhóm Dòng. Bấm ra nền hoặc Esc thì bỏ chọn.
  Trang HTML xem trước bật `parts` (`data-part` cho từng phần); viền vẽ ngoài iframe. Dưới phiếu ghi
  khổ, cỡ phiếu, cỡ số đang dùng, ngày của số.
- Phải (300 px) **Thuộc tính** của phần đang chọn, đầu cột có biểu tượng, tên, loại, con mắt (dòng):
  - Không chọn gì: Khổ giấy mặc định, Khoảng cách giữa các phiếu, Vị trí cụm phiếu trên trang (hai
    hàng 5 hình trang giấy: Theo cột Trái / Giữa / Phải / Hai bên / Đều, Theo hàng Trên / Giữa /
    Dưới / Hai bên / Đều; vẽ theo khổ giấy, phím mũi tên để đổi).
  - Phiếu: Rộng / Cao (Auto như cũ, gợi ý mức tối đa), Font chữ (font đã cài, "máy chưa cài").
  - Nhóm Dòng: Căn lề + khoảng cách tới dòng dưới (của cả dòng). Label / Text: ô Chữ + Cỡ chữ.
  - Đầu phiếu / Cuối phiếu: nút "Thêm dòng tự do". Dòng cuối phiếu trừ vào chiều cao bảng (§6.4:
    `tableH = cardH − headerH − footerH − 160`); Word: đoạn văn ngay sau bảng của mỗi phiếu.
  - Thứ, ngày: chữ tự động (không sửa), Cỡ, Căn lề, khoảng cách tới bảng.
  - Hàng tiêu đề: tên viết tắt các đài trên phiếu đang xem, "Sửa cả 21 đài…" mở đủ danh sách.
  - Mọi đoạn chữ (Label, Text, Thứ ngày): thêm Đậm / Nghiêng và ô màu.
  - Bảng kết quả: màu viền. Hàng tiêu đề: cỡ chữ "Giải", Đậm, màu.
  - Tên giải: cỡ, cỡ "ĐB", Đậm, màu + ô căn 3×3 và padding. Số kết quả: Cỡ số (Auto như cũ),
    Đậm / Nghiêng / Gạch chân, màu + ô căn 3×3 và padding.
  - Hàng giải › Giải Tám … ĐB: cỡ số cộng thêm (ô gọn "Thêm", pt, âm được), màu số, màu tên giải
    (ô màu có lựa chọn "Chung" = theo mức chung), Đậm / Nghiêng / Gạch chân, nền hàng ("Không"),
    nút "Đặt lại hàng này".
  - Ô màu: mẫu + mã hex; bảng chọn 8 màu đậm, 7 màu nhạt, ô mã, "Màu khác…" (bảng màu hệ thống).
  Cửa sổ hẹp (≤ 1100 px) hai cột bên còn 200 / 264 px.

**Tab Chung**: cột thẻ rộng tối đa 904 px ở giữa, thu gọn / mở rộng được như cũ: **Đài cần in**
(không còn mục tên viết tắt), **Máy in**, **Lưu file** (thêm **Định dạng mặc định** PDF / Word / Cả
hai ở đầu thẻ).

**Thanh cuối**, ba phần không xuống dòng: trái là nhóm **Cấu hình** với hai nút biểu tượng nhập /
xuất file .conf (xuất đúng những gì đang hiện, kể cả thay đổi chưa lưu) + phiên bản; giữa là
thông báo (co giãn, tự xuống dòng); phải luôn là "Khôi phục mặc định" · **Lưu cài đặt**
(báo "Đã lưu cài đặt"). Rời màn khi chưa lưu → hộp hỏi với ba nút **Ở lại** (focus sẵn,
Esc) · **Bỏ thay đổi** · **Lưu rồi quay lại**. Lưu lỗi thì báo ngay trong hộp. Đóng hộp là
mất lỗi, lần sau mở lại không còn lỗi cũ.

Cửa sổ hẹp (≤ 960px): các cặp mục hai cột trong thẻ tab Chung xếp thành một cột. Không có thanh
cuộn ngang ở cỡ tối thiểu 900×640.

Yêu cầu chung: có `label`, `aria-*` đúng, tương phản chữ ≥ 4.5:1. **Ô nhập / ô chọn cao 36px**
(chủ dự án chốt 29-10-2026, lấy theo ô số gọn); nút đứng cạnh ô nhập (Chọn…, xoá số, tìm lại máy
in) cao bằng ô; các nút khác ≥ 44px. **Mọi ô số** dùng chung một kiểu ô gọn (`CompactInput`):
[biểu tượng hoặc chữ ngắn | số | đơn vị]; gõ số (nhận dấu phẩy), ↑/↓ (Shift ×10), kéo chuột trên
phần đầu ô; tuỳ chọn **Auto** (nhấp đúp phần đầu ô, xoá số hoặc gõ "auto"; khi Auto ẩn đơn vị).
Không còn ô số có nút − / +.

---

## 8. Xuất file & in

### 8.1 PDF
`render-html` → trang HTML đúng khổ (`@page { size: …; margin: 0 }`, mọi kích thước
tính bằng pt từ layout). Mở trong `BrowserWindow` ẩn, `webContents.printToPDF({
preferCSSPageSize: true, printBackground: true, margins: { marginType: 'none' } })`.
Mỗi file đúng **1 trang**.

### 8.2 Word (.docx)
Port `build_docx` của bản bash sang `render-docx.ts`, đọc từ layout. Ghi nhớ:
- Thứ tự phần tử trong `w:tblPr`: `tblW, jc, tblBorders, tblLayout, tblCellMar`
  (sai thứ tự Word báo lỗi file).
- Bố cục nhiều bản: section `w:cols` (num = số cột, space = gap), giữa các bản trong
  cùng cột chèn đoạn trống cao exact = gap, sang cột mới bằng `w:br w:type="column"`
  ở đoạn đầu của bản, cuối tài liệu một đoạn rất thấp (line exact 20).
- Hàng bảng `w:trHeight hRule="exact"`, `w:cantSplit`.
- Font chạy: tên font đang chọn (font máy), ví dụ `Times New Roman`.

### 8.3 In (module riêng `main/print.ts`)
```ts
interface PrintOptions { paper: 'A4'|'A5'|'A6'; deviceName?: string; silent?: boolean; copies?: number; parent?: BrowserWindow }
printSheet(html: string, opts: PrintOptions): Promise<{ ok: boolean; cancelled?: boolean; reason?: string }>
listPrinters(): Promise<{ name; displayName; isDefault }[]>
```
- Bước xem trước nằm ở renderer (Xem trước khi in, §7.1); `printSheet` chỉ gửi lệnh in. Khổ giấy
  đúng theo `paper` (micromet, A5 ngang), lề 0.
- Có máy in cụ thể → `silent: true` vào đúng máy đó (đã xem trước rồi, không hỏi lại), cửa sổ ẩn.
  Máy in không còn trong danh sách → báo lỗi, không in.
- Không chọn máy in → hộp thoại in của hệ thống, gọi từ một cửa sổ nhỏ **đang hiện** "Đang in…"
  (trang thu nhỏ bằng CSS `@media screen`, bản in không đổi) để macOS có chỗ gắn hộp thoại.
- In lỗi → báo lý do bằng tiếng Việt (ví dụ "Máy chưa cài máy in nào"), thông báo có nút
  **Lưu PDF**. **Không** tự xuất hay tự mở file nữa (chủ dự án yêu cầu 28-10-2026: máy chưa có
  máy in thì Electron báo lỗi ngay, bản cũ rơi vào đường tự mở PDF trông như "bấm In lại ra file").

Tên file: `xsmn_DD-MM-YYYY_A4.pdf` / `.docx`; phiếu trống thêm `_trong`. Trùng tên
→ ghi đè (đã có cache) hoặc hỏi — chọn một và thống nhất.

---

## 9. Đóng gói & phát hành

- electron-builder (`app/electron-builder.yml`, bản Win7 `electron-builder.win7.yml`): appId
  `vn.xsmn.app`. Tên hiển thị **Xổ Số Đại Lý** (đổi 28-10-2026) nhưng tên kỹ thuật `productName`
  là **Xo So Dai Ly** không dấu: Electron 45 trên macOS sập ngay khi mở nếu tên gói/Helper có
  dấu, và thư mục cài trên Windows nên không dấu. Tên có dấu đặt ở `CFBundleDisplayName` (mac;
  **không** đặt `CFBundleName`, Electron dựa vào nó để tìm Helper), lối tắt + mục gỡ cài đặt
  (Windows), file `.desktop` (Linux). File cài: `xo-so-dai-ly-<version>-<os>-<arch>.<ext>`.
  Thư mục dữ liệu `userData` luôn là `XSMN` để cập nhật không mất cài đặt.
  - mac: ký tạm ad-hoc (`identity: '-'`); không ký gì thì máy Apple Silicon không chạy.
  - mac: `dmg`, arch `arm64` + `x64` (2 file riêng).
  - win: `nsis`, `x64`.
  - **win7**: `nsis`, một bộ cài gộp `ia32` + `x64` (tự chọn theo máy), build với
    `electronVersion` 22.3.27 — bản Electron cuối còn chạy Windows 7. Electron 22 đã ngừng
    vá bảo mật từ 10-2023; chấp nhận được vì app không hiển thị trang web lạ (HTML minhngoc
    chỉ được parse ở main). Tải trang dùng `https` của Node (chứng chỉ gốc kèm sẵn) vì Win7
    lâu không cập nhật thường thiếu chứng chỉ gốc mới. Chủ dự án chốt 28-10-2026.
  - linux: `AppImage` + `deb`, `x64`.
- GitHub Actions `release.yml`: `workflow_dispatch` với input chọn OS
  (mac / windows / linux / all) + tag; matrix `macos-latest`, `windows-latest`,
  `ubuntu-latest`; mỗi job build OS của mình và gắn file vào GitHub Release của tag.
  Push tag `v*` → build cả 3.
- Phiên bản theo semver ở `app/package.json` (`make version V=x.y.z`), ghi thay đổi ở
  `CHANGELOG.md`; tag `v<version>` phải trùng, workflow kiểm tra. Màn Cài đặt hiện số phiên bản.
- Chưa ký số: ghi rõ trong README cách mở lần đầu (mac: chuột phải → Open;
  Windows: "More info → Run anyway").
- Icon: `build/icon.png` 1024×1024, vẽ từ `build/icon.svg` = logo mẫu C "Phiếu dò"
  (`design/logo/C-phieu-do.svg`, chủ dự án chọn). Mở app có màn hình chào (logo, tên,
  "Kết quả xổ số miền Nam", phiên bản) tới khi cửa sổ chính vẽ xong, tối thiểu 1,2 giây.

---

## 10. Kiểm thử & nghiệm thu

Unit (vitest, `core/` không cần Electron):
- `parse`: fixture 26-10-2026 (3 đài, HTML lỗi thiếu `</td>`) và 24-10-2026 (4 đài) →
  đúng slug, đủ 18 số/đài, đúng thứ tự; ngày lệch → `none`; thiếu số → `partial`.
- `live`: feed và trang trực tiếp chụp lúc đang quay 29-10-2026 → bỏ ô `+++++`/`*****`, tra đúng
  đài; chỉ hỏi trong khung 16h–17h của hôm nay; máy chủ lỗi thì đổi máy, lỗi hết thì như cũ.
- `select`: mode all/pick, thứ tự, đài tắt, tắt hết → in đủ, đài lạ.
- `layout`: với mọi khổ × 3/4 đài × header mặc định/ẩn bớt/cỡ to: tổng chiều cao cột
  ≤ chiều cao vùng in; số 6 chữ số vừa ô; cỡ số mặc định khớp §6.4; `maxCardSizeCm` ra đúng
  mức tối đa từng khổ và nhập đúng số đó không bị cảnh báo.
- `render-docx`: giải nén, XML hợp lệ, đúng thứ tự phần tử.

Thủ công / e2e:
- PDF A4/A5/A6 mỗi file 1 trang, đúng kích thước giấy, đặt cạnh PDF trong
  `design/reference/` gần như trùng.
- Mở .docx bằng Word trên mac & Windows: không lỗi, 1 trang.
- Chạy lúc 16h20 (đang quay) → partial từ bảng trực tiếp, số mới hiện sau vài giây, tới khi đủ.
- In ra giấy thật: đo phiếu 8 cm, cách 0,6 cm; số cách lề phải ô 0,3 cm.
