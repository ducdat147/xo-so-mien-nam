#!/usr/bin/env bash
#
# xsmn.sh - Lấy kết quả xổ số miền Nam và xuất file PDF / Word (.docx)
#
# Nguồn: minhngoc.net.vn (crawl HTML)
# Yêu cầu: bash (3.2+ cũng chạy, macOS dùng được), curl, xmllint (libxml2), zip
#          (không có zip thì dùng python3 để nén); LibreOffice để xuất PDF
#
# Dùng:  ./xsmn.sh [-d DD-MM-YYYY] [-c file.conf] [-o file.docx] [--blank] ...
#        ./xsmn.sh -h   để xem đầy đủ
#
set -u

VERSION="1.0.0"
SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
SRC_BASE="https://www.minhngoc.net.vn/ket-qua-xo-so/mien-nam"
UA="Mozilla/5.0 (Macintosh; Intel Mac OS X 14_0) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0 Safari/537.36"
TZ_VN="Asia/Ho_Chi_Minh"

# Thứ tự giải in trên phiếu (từ trên xuống) và số lượng số của mỗi giải
PRIZES="8 7 6 5 4 3 2 1 db"

# ---------------------------------------------------------------- tiện ích

QUIET=0
die()  { printf 'Lỗi: %s\n' "$*" >&2; exit 1; }
warn() { printf 'Cảnh báo: %s\n' "$*" >&2; }
info() { [ "$QUIET" = 1 ] || printf '%s\n' "$*" >&2; }

usage() {
cat <<'EOF'
xsmn.sh - Lấy kết quả xổ số miền Nam, xuất file PDF hoặc Word (.docx)

Cách dùng:
  ./xsmn.sh                         Kết quả hôm nay
  ./xsmn.sh -d 25-10-2026           Kết quả ngày khác (DD-MM-YYYY hoặc DD/MM/YYYY)
  ./xsmn.sh -c ~/dai-ly.conf        Dùng file config chỉ định
  ./xsmn.sh -p A5                    Khổ giấy: A4 = 4 bản (mặc định), A5 = 2 bản, A6 = 1 bản
  ./xsmn.sh -f docx                 Định dạng: pdf (mặc định), docx, both (cả hai)
  ./xsmn.sh -o ~/Desktop/kq.pdf     Đặt tên/đường dẫn file xuất (đuôi quyết định định dạng)
  ./xsmn.sh --blank                 Xuất phiếu trống (chưa có số) theo lịch quay
  ./xsmn.sh --text                  Chỉ in kết quả ra màn hình, không tạo file

Tuỳ chọn khác:
  --html FILE    Đọc kết quả từ file HTML đã lưu (không tải mạng)
  --no-cache     Luôn tải lại, bỏ qua cache
  -q, --quiet    Ít thông báo
  -h, --help     Trợ giúp
  -v, --version  Phiên bản

File config (KEY=VALUE) được tìm lần lượt ở:
  ./xsmn.conf, <thư mục script>/xsmn.conf, ~/.config/xsmn/xsmn.conf
Không có config: lấy đủ các đài quay trong ngày, phiếu không có thông tin đại lý.
Xem xsmn.conf.example để biết các khoá cấu hình.
EOF
}

# Escape ký tự đặc biệt cho XML
xml_esc() {
  printf '%s' "$1" | sed -e 's/&/\&amp;/g' -e 's/</\&lt;/g' -e 's/>/\&gt;/g' -e 's/"/\&quot;/g'
}

trim() {
  local s="$1"
  s="${s#"${s%%[![:space:]]*}"}"
  s="${s%"${s##*[![:space:]]}"}"
  printf '%s' "$s"
}

sanitize_key() { printf '%s' "$1" | tr -c 'A-Za-z0-9_' '_'; }

# ---------------------------------------------------------------- config

CONFIG_FILE=""

load_config() {
  local file="$1" line key val skey n=0
  while IFS= read -r line || [ -n "$line" ]; do
    n=$((n + 1))
    line="${line%$'\r'}"
    line="$(trim "$line")"
    case "$line" in ''|'#'*|';'*) continue ;; esac
    case "$line" in
      *=*) ;;
      *) warn "config dòng $n không hợp lệ (thiếu '='): $line"; continue ;;
    esac
    key="$(trim "${line%%=*}")"
    val="$(trim "${line#*=}")"
    case "$val" in
      \"*\") val="${val#\"}"; val="${val%\"}" ;;
      \'*\') val="${val#\'}"; val="${val%\'}" ;;
      *)     val="$(trim "$(printf '%s' "$val" | sed 's/[[:space:]]#.*$//')")" ;;
    esac
    skey="$(sanitize_key "$key")"
    printf -v "CFG_$skey" '%s' "$val"
  done < "$file"
}

# cfg KEY [default]
cfg() {
  local n
  n="CFG_$(sanitize_key "$1")"
  if [ -n "${!n-}" ]; then printf '%s' "${!n}"; else printf '%s' "${2-}"; fi
}

find_config() {
  local c
  for c in "./xsmn.conf" "$SCRIPT_DIR/xsmn.conf" "${XDG_CONFIG_HOME:-$HOME/.config}/xsmn/xsmn.conf"; do
    if [ -f "$c" ]; then printf '%s' "$c"; return 0; fi
  done
  return 1
}

# ---------------------------------------------------------------- đài & lịch

# Tên viết tắt mặc định in trên phiếu (ghi đè bằng NAME_<mã-đài> trong config)
default_short() {
  case "$1" in
    tp-hcm)     echo "TP.HCM" ;;   dong-thap)  echo "Đ.Tháp" ;;   ca-mau)     echo "C.Mau" ;;
    ben-tre)    echo "B.Tre" ;;    vung-tau)   echo "V.Tàu" ;;    bac-lieu)   echo "B.Liêu" ;;
    dong-nai)   echo "Đ.Nai" ;;    can-tho)    echo "C.Thơ" ;;    soc-trang)  echo "S.Trăng" ;;
    tay-ninh)   echo "T.Ninh" ;;   an-giang)   echo "A.Giang" ;;  binh-thuan) echo "B.Thuận" ;;
    vinh-long)  echo "V.Long" ;;   binh-duong) echo "B.Dương" ;;  tra-vinh)   echo "T.Vinh" ;;
    long-an)    echo "L.An" ;;     binh-phuoc) echo "B.Phước" ;;  hau-giang)  echo "H.Giang" ;;
    tien-giang) echo "T.Giang" ;;  kien-giang) echo "K.Giang" ;;  da-lat)     echo "Đ.Lạt" ;;
    *) echo "" ;;
  esac
}

# station_short <mã> [tên lấy từ web]
station_short() {
  local v
  v="$(cfg "NAME_$1")"
  [ -n "$v" ] || v="$(default_short "$1")"
  [ -n "$v" ] || v="${2:-$1}"
  printf '%s' "$v"
}

# Lịch quay cố định theo thứ (0=CN ... 6=T7), dùng cho phiếu trống
schedule_for_dow() {
  case "$1" in
    1) echo "tp-hcm dong-thap ca-mau" ;;
    2) echo "ben-tre vung-tau bac-lieu" ;;
    3) echo "dong-nai can-tho soc-trang" ;;
    4) echo "tay-ninh an-giang binh-thuan" ;;
    5) echo "vinh-long binh-duong tra-vinh" ;;
    6) echo "tp-hcm long-an binh-phuoc hau-giang" ;;
    0) echo "tien-giang kien-giang da-lat" ;;
  esac
}

dow_key()  { case "$1" in 0) echo CN;; *) echo "T$(( $1 + 1 ))";; esac; }
dow_name() {
  case "$1" in
    0) echo "Chủ Nhật";; 1) echo "Thứ Hai";; 2) echo "Thứ Ba";; 3) echo "Thứ Tư";;
    4) echo "Thứ Năm";;  5) echo "Thứ Sáu";; 6) echo "Thứ Bảy";;
  esac
}

expected_count() {
  case "$1" in 6) echo 3;; 4) echo 7;; 3) echo 2;; *) echo 1;; esac
}

prize_label() {
  case "$1" in
    8) echo "Tám";; 7) echo "Bảy";; 6) echo "Sáu";; 5) echo "Năm";; 4) echo "Tư";;
    3) echo "Ba";;  2) echo "Nhì";; 1) echo "Nhất";; db) echo "ĐB";;
  esac
}

# ---------------------------------------------------------------- ngày

# Thứ trong tuần (0=CN) - thuật toán Sakamoto, không phụ thuộc lệnh date GNU/BSD
weekday() {
  local d=$((10#$1)) m=$((10#$2)) y=$((10#$3))
  local t=(0 3 2 5 0 3 5 1 4 6 2 4)
  [ "$m" -lt 3 ] && y=$((y - 1))
  echo $(( (y + y/4 - y/100 + y/400 + ${t[$((m - 1))]} + d) % 7 ))
}

days_in_month() {
  local m=$((10#$1)) y=$((10#$2))
  case "$m" in
    1|3|5|7|8|10|12) echo 31 ;;
    4|6|9|11) echo 30 ;;
    2) if [ $((y % 4)) -eq 0 ] && { [ $((y % 100)) -ne 0 ] || [ $((y % 400)) -eq 0 ]; }; then echo 29; else echo 28; fi ;;
  esac
}

# parse_date "chuỗi" -> đặt D M Y (2 chữ số, 2 chữ số, 4 chữ số)
parse_date() {
  local s="$1" a b c
  s="$(printf '%s' "$s" | tr '/.' '--')"
  IFS=- read -r a b c <<EOF
$s
EOF
  if [ "${#a}" -eq 4 ]; then local tmp="$a"; a="$c"; c="$tmp"; fi   # YYYY-MM-DD
  case "$a$b$c" in ''|*[!0-9]*) return 1 ;; esac
  [ "${#c}" -eq 4 ] || return 1
  [ $((10#$b)) -ge 1 ] && [ $((10#$b)) -le 12 ] || return 1
  [ $((10#$a)) -ge 1 ] && [ $((10#$a)) -le "$(days_in_month "$b" "$c")" ] || return 1
  D="$(printf '%02d' $((10#$a)))"; M="$(printf '%02d' $((10#$b)))"; Y="$c"
}

# ---------------------------------------------------------------- tải & parse

HTML_FILE=""
NO_CACHE=0
CACHE_DIR="${XDG_CACHE_HOME:-$HOME/.cache}/xsmn"

fetch_html() {   # fetch_html <đường dẫn lưu>
  local out="$1" url="$SRC_BASE/$D-$M-$Y.html" cache="$CACHE_DIR/$D-$M-$Y.html"
  if [ "$NO_CACHE" = 0 ] && [ -s "$cache" ]; then
    info "Dùng cache: $cache"
    cp "$cache" "$out"; return 0
  fi
  info "Đang tải: $url"
  curl -fsSL --compressed --max-time 25 --retry 2 --retry-delay 2 \
       -A "$UA" -H "Accept-Language: vi-VN,vi;q=0.9" -o "$out" "$url" \
    || { warn "không tải được $url"; return 1; }
}

xq() { xmllint --html --xpath "$1" "$BOX" 2>/dev/null; }

# Kết quả lưu vào: N_ST, ST_SLUG_i, ST_NAME_i, R_i_<giải>
parse_results() {
  local html="$1" i k nums href
  BOX="$WORK/box.html"
  xmllint --html --xpath "(//table[contains(@class,'bkqmiennam')])[1]" "$html" > "$BOX" 2>/dev/null
  [ -s "$BOX" ] || { warn "không tìm thấy bảng kết quả trong trang (giao diện web có thể đã đổi)"; return 1; }

  PAGE_DATE="$(xq "normalize-space(//td[@class='ngay'])")"
  if [ "$PAGE_DATE" != "$D/$M/$Y" ]; then
    warn "trang chưa có kết quả ngày $D/$M/$Y (bảng mới nhất là ${PAGE_DATE:-?}). XSMN quay khoảng 16h15-16h35."
    return 2
  fi

  N_ST="$(xq "count(//table[contains(@class,'rightcl')])")"
  N_ST="${N_ST%%.*}"
  [ "${N_ST:-0}" -gt 0 ] 2>/dev/null || { warn "không đọc được danh sách đài"; return 1; }

  for ((i = 1; i <= N_ST; i++)); do
    local T="(//table[contains(@class,'rightcl')])[$i]"
    href="$(xq "string($T//td[@class='tinh']/a/@href)")"
    href="${href##*/}"; href="${href%.html}"
    printf -v "ST_SLUG_$i" '%s' "$href"
    printf -v "ST_NAME_$i" '%s' "$(xq "normalize-space($T//td[@class='tinh'])")"
    for k in $PRIZES; do
      nums="$(xq "$T//td[@class='giai$k']/div" | sed 's/<[^>]*>/ /g' | grep -oE '[0-9]+' | tr '\n' ' ')"
      printf -v "R_${i}_$k" '%s' "$(trim "$nums")"
    done
  done
  return 0
}

# Kiểm tra đủ số chưa (đang quay trực tiếp thì sẽ thiếu)
results_complete() {
  local i k v cnt
  for ((i = 1; i <= N_ST; i++)); do
    for k in $PRIZES; do
      v="R_${i}_$k"; set -- ${!v}; cnt=$#
      [ "$cnt" -eq "$(expected_count "$k")" ] || return 1
    done
  done
  return 0
}

# ---------------------------------------------------------------- chọn đài theo config

# Trả về danh sách mã đài muốn lấy cho thứ $DOW (rỗng = tất cả)
wanted_stations() {
  local v
  v="$(cfg "STATIONS_$(dow_key "$DOW")")"
  [ -n "$v" ] || v="$(cfg STATIONS)"
  printf '%s' "$v" | tr ',;' '  ' | tr -s ' '
}

# Từ kết quả đã parse -> SEL (danh sách chỉ số i theo thứ tự trên web)
select_stations() {
  local want="$1" i s w found
  SEL=""
  for ((i = 1; i <= N_ST; i++)); do
    s="ST_SLUG_$i"
    if [ -z "$(trim "$want")" ]; then SEL="$SEL $i"; continue; fi
    for w in $want; do [ "$w" = "${!s}" ] && SEL="$SEL $i"; done
  done
  SEL="$(trim "$SEL")"
  # Đài khai báo riêng cho thứ này mà không quay -> nhắc
  if [ -n "$(cfg "STATIONS_$(dow_key "$DOW")")" ]; then
    for w in $want; do
      found=0
      for ((i = 1; i <= N_ST; i++)); do s="ST_SLUG_$i"; [ "$w" = "${!s}" ] && found=1; done
      [ "$found" = 1 ] || warn "đài '$w' không quay ngày $(dow_name "$DOW")"
    done
  fi
}

# Phiếu trống: dựng danh sách đài từ lịch cố định
build_blank() {
  local i=0 s
  for s in $(schedule_for_dow "$DOW"); do
    i=$((i + 1))
    printf -v "ST_SLUG_$i" '%s' "$s"
    printf -v "ST_NAME_$i" '%s' "$s"
    local k; for k in $PRIZES; do printf -v "R_${i}_$k" '%s' ""; done
  done
  N_ST=$i
}

# ---------------------------------------------------------------- in ra màn hình

print_text() {
  local i k v s n
  printf '\nKẾT QUẢ XỔ SỐ MIỀN NAM - %s %s-%s-%s\n' "$(dow_name "$DOW")" "$D" "$M" "$Y"
  for i in $SEL; do
    s="ST_SLUG_$i"; n="ST_NAME_$i"
    printf '\n[%s]\n' "$(station_short "${!s}" "${!n}")"
    for k in $PRIZES; do
      v="R_${i}_$k"
      printf '  %s\t%s\n' "$(prize_label "$k")" "${!v:--}"
    done
  done
  printf '\n'
}

# ---------------------------------------------------------------- DOCX

W_NS='xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"'

# run <text> <color> <half-points> [bold:1/0]
run() {
  local b=""
  [ "${4:-1}" = 1 ] && b="<w:b/><w:bCs/>"
  printf '<w:r><w:rPr>%s<w:color w:val="%s"/><w:sz w:val="%s"/><w:szCs w:val="%s"/></w:rPr><w:t xml:space="preserve">%s</w:t></w:r>' \
    "$b" "$2" "$3" "$3" "$(xml_esc "$1")"
}

# para <align> <space-after> <runs> [chiều cao dòng cố định, twips]
para() {
  local ln='w:line="240" w:lineRule="auto"'
  [ -n "${4-}" ] && ln="w:line=\"$4\" w:lineRule=\"exact\""
  printf '<w:p><w:pPr><w:spacing w:before="0" w:after="%s" %s/>%s<w:jc w:val="%s"/></w:pPr>%s</w:p>' "$2" "$ln" "${PIND-}" "$1" "$3"
}

# cell <width> <valign> <paras>
cell() {
  printf '<w:tc><w:tcPr><w:tcW w:w="%s" w:type="dxa"/><w:vAlign w:val="%s"/></w:tcPr>%s</w:tc>' "$1" "$2" "$3"
}

# Ước lượng số dòng một đoạn text chiếm trong cột
est_lines() {   # est_lines <text> <ký tự / dòng>
  local len=${#1} per=$2
  [ "$per" -lt 1 ] && per=1
  [ "$len" -eq 0 ] && { echo 0; return; }
  echo $(( (len + per - 1) / per ))
}

# Số dòng số trong ô của mỗi giải
prize_lines() { expected_count "$1"; }

# Tỉ lệ chia phần chiều cao dư (giống mẫu: giải Tư cao nhất)
prize_weight() {
  case "$1" in
    hdr|8|7|5|2|1) echo 10 ;; 6) echo 26 ;; 4) echo 52 ;; 3) echo 18 ;; db) echo 12 ;;
  esac
}

build_docx() {
  local out="$1"
  local font copies navy red border black
  font="$(cfg FONT "Times New Roman")"
  navy="$(cfg COLOR_TEXT "000000")"; red="$(cfg COLOR_ACCENT "000000")"
  border="$(cfg COLOR_BORDER "000000")"; black="$(cfg COLOR_NUMBER "000000")"
  # Căn lề trong bảng: chữ (tên giải, tên đài, ghi chú) và các số kết quả
  local al_text al_num
  al_text="$(cfg ALIGN_TEXT center)"; al_num="$(cfg ALIGN_NUMBER right)"
  case "$al_text" in left|center|right) ;; *) warn "ALIGN_TEXT phải là left/center/right"; al_text=center ;; esac
  # Vị trí cả phiếu (đầu phiếu + bảng) trong ô chia trên trang
  local al_card
  al_card="$(cfg CARD_ALIGN left)"
  case "$al_card" in left|center|right) ;; *) warn "CARD_ALIGN phải là left/center/right"; al_card=left ;; esac
  case "$al_num"  in left|center|right) ;; *) warn "ALIGN_NUMBER phải là left/center/right"; al_num=right ;; esac

  # --- Bố cục trang theo khổ giấy (twips: 1 cm = 567)
  #   A4: đứng, 4 bản xếp 2x2 | A5: ngang, 2 bản cạnh nhau | A6: đứng, 1 bản
  local ncol nrow pw ph orient margin=454 gap gc
  # Khoảng cách giữa các phiếu (CARD_GAP_CM, mặc định 0.6 cm; 0 = dính sát)
  gc="$(cfg CARD_GAP_CM 0.6 | tr ',' '.')"
  gap="$(awk -v c="$gc" 'BEGIN { if (c + 0 >= 0) printf "%d", c * 567; else print 0 }')"
  case "$PAPER" in
    A4) ncol=2; nrow=2; pw=11906; ph=16838; orient=portrait ;;
    A5) ncol=2; nrow=1; pw=11906; ph=8391;  orient=landscape ;;
    A6) ncol=1; nrow=1; pw=5953;  ph=8391;  orient=portrait ;;
  esac
  copies=$((ncol * nrow))
  local usable_w=$((pw - 2 * margin)) usable_h=$((ph - 2 * margin))
  local colw=$(( (usable_w - (ncol - 1) * gap) / ncol ))

  # Bề ngang phiếu (CARD_WIDTH_CM, mặc định 8 cm), không vượt quá chỗ trống trên trang
  local cw cardw
  cw="$(cfg CARD_WIDTH_CM 8 | tr ',' '.')"
  cardw="$(awk -v c="$cw" 'BEGIN { if (c + 0 > 0) printf "%d", c * 567; else print 0 }')"
  if [ "$cardw" -le 0 ]; then warn "CARD_WIDTH_CM không hợp lệ: $cw - dùng 8"; cardw=4536; fi
  if [ "$cardw" -gt "$colw" ]; then
    warn "CARD_WIDTH_CM=$cw cm rộng hơn chỗ trống trên khổ $PAPER ($(awk -v t="$colw" 'BEGIN{printf "%.1f", t/567}') cm) - dùng tối đa"
    cardw=$colw
  fi
  # Nhiều cột: mỗi cột đúng bằng bề ngang phiếu, phần dư dồn vào lề theo CARD_ALIGN
  local margin_l=$margin margin_r=$margin
  if [ "$ncol" -gt 1 ]; then
    colw=$cardw
    local left=$(( usable_w - ncol * cardw - (ncol - 1) * gap ))
    case "$al_card" in
      left)   margin_r=$(( margin + left )) ;;
      right)  margin_l=$(( margin + left )) ;;
      center) margin_l=$(( margin + left / 2 )); margin_r=$(( margin + left - left / 2 )) ;;
    esac
  fi
  # Thụt lề phần đầu phiếu để nằm đúng trên bảng
  local spare=$(( colw - cardw )) ind_l ind_r
  case "$al_card" in
    left)   ind_l=0;                ind_r=$spare ;;
    right)  ind_l=$spare;           ind_r=0 ;;
    center) ind_l=$(( spare / 2 )); ind_r=$(( spare / 2 )) ;;
  esac
  PIND=""
  [ "$spare" -gt 0 ] && PIND="<w:ind w:left=\"$ind_l\" w:right=\"$ind_r\"/>"
  local cardh=$(( (usable_h - (nrow - 1) * gap) / nrow ))

  # --- Thông tin đại lý
  local label name addr fax phones note contact="" p
  label="$(cfg AGENT_LABEL "Đại lý vé số:")"
  name="$(cfg AGENT_NAME)"
  addr="$(cfg AGENT_ADDRESS)"
  fax="$(cfg AGENT_FAX)"
  phones="$(cfg AGENT_PHONES)"
  note="$(cfg NOTE)"
  [ -n "$fax" ] && contact="Fax: $fax"
  local IFS_OLD="$IFS"; IFS='|'
  for p in $phones; do p="$(trim "$p")"; [ -n "$p" ] && contact="${contact:+$contact  }DĐ: $p"; done
  IFS="$IFS_OLD"
  [ -n "$(cfg AGENT_CONTACT)" ] && contact="$(cfg AGENT_CONTACT)"   # ghi đè cả dòng nếu muốn tự viết

  # Phần đầu phiếu: mọi dòng đặt chiều cao cố định để tính chính xác
  local cpl=$(( cardw / 20 * 10 / 38 ))      # ký tự/dòng ở cỡ 7.5pt đậm
  local header_h=0 header_xml=""
  if [ -n "$name" ]; then
    header_xml="$header_xml$(para center 60 "$(run "$label " "$navy" 16)$(run "$name" "$navy" 28)" 380)"
    header_h=$((header_h + 440))
  fi
  if [ -n "$addr" ]; then
    header_xml="$header_xml$(para center 0 "$(run "ĐC: $addr" "$navy" 15)" 180)"
    header_h=$((header_h + 180 * $(est_lines "ĐC: $addr" "$cpl")))
  fi
  if [ -n "$contact" ]; then
    header_xml="$header_xml$(para center 0 "$(run "$contact" "$navy" 15)" 180)"
    header_h=$((header_h + 180 * $(est_lines "$contact" "$cpl")))
  fi
  header_xml="$header_xml$(para center 60 "$(run "$(dow_name "$DOW") ($D-$M-$Y)" "$navy" 26)" 340)"
  header_h=$((header_h + 400))
  PIND=""   # thụt lề chỉ áp cho phần đầu phiếu, không áp vào ô bảng

  # --- Cột của bảng
  local nst=0 i
  for i in $SEL; do nst=$((nst + 1)); done
  local labw=$(( cardw * 16 / 100 ))
  [ "$labw" -lt 600 ] && labw=600
  [ "$labw" -gt 900 ] && labw=900
  local stw=$(( (cardw - labw) / nst ))
  local tblw=$(( labw + stw * nst ))
  local stsz=24
  [ "$stw" -lt 1200 ] && stsz=20
  [ "$stw" -lt 900 ] && stsz=16

  # --- Cỡ số: lớn nhất mà vẫn vừa chiều cao phiếu và bề ngang ô
  # Khoảng cách từ số kết quả tới đường kẻ phải của ô (NUMBER_PAD_RIGHT_CM, mặc định 0.3)
  local npc nind
  npc="$(cfg NUMBER_PAD_RIGHT_CM 0.3 | tr ',' '.')"
  nind="$(awk -v c="$npc" 'BEGIN { v = int(c * 567) - 28; if (v < 0) v = 0; print v }')"   # trừ lề ô 28 twips
  # Dòng số cao 1.1 lần cỡ chữ (twips = half-point x 11)
  local pad=60 table_h=$(( cardh - header_h - 160 ))
  local numsz maxw=$(( (stw - 76 - nind) / 30 )) L LDB base fpt top=36
  fpt="$(cfg NUMBER_FONT_PT)"
  if [ -n "$fpt" ]; then
    top="$(awk -v c="$(printf '%s' "$fpt" | tr ',' '.')" 'BEGIN { printf "%d", c * 2 }')"
  fi
  for ((numsz = top; numsz > 14; numsz--)); do
    [ "$numsz" -le "$maxw" ] || continue
    L=$((numsz * 11)); LDB=$(( (numsz + 2) * 11 ))
    base=$(( 18 * L + LDB + 10 * pad ))     # tiêu đề + 17 dòng số + dòng ĐB
    [ "$base" -le "$table_h" ] && break
  done
  [ "$numsz" -lt 15 ] && numsz=15
  if [ -n "$fpt" ] && [ "$numsz" -lt "$top" ]; then
    warn "NUMBER_FONT_PT=$fpt quá lớn so với phiếu, dùng $(awk -v n="$numsz" 'BEGIN{printf "%g", n/2}')pt"
  fi
  local dbsz=$((numsz + 2))
  [ "$dbsz" -gt "$(( maxw - 1 ))" ] && dbsz=$(( maxw - 1 ))   # ĐB 6 chữ số phải vừa ô
  [ "$dbsz" -lt "$numsz" ] && dbsz=$numsz
  L=$((numsz * 11)); LDB=$((dbsz * 11))
  base=$(( 18 * L + LDB + 10 * pad ))
  local extra=$(( table_h - base ))
  [ "$extra" -lt 0 ] && { extra=0; warn "phiếu hơi chật, có thể tràn trang - thử bớt nội dung đầu phiếu"; }
  rowh() {
    local h
    case "$1" in
      hdr) h=$((L + pad)) ;;
      db)  h=$((LDB + pad)) ;;
      *)   h=$(( $(prize_lines "$1") * L + pad )) ;;
    esac
    echo $(( h + extra * $(prize_weight "$1") / 168 ))
  }

  local bd="w:val=\"single\" w:sz=\"6\" w:space=\"0\" w:color=\"$border\""
  local tbl
  tbl="<w:tbl><w:tblPr><w:tblW w:w=\"$tblw\" w:type=\"dxa\"/><w:jc w:val=\"$al_card\"/>"
  tbl="$tbl<w:tblBorders><w:top $bd/><w:left $bd/><w:bottom $bd/><w:right $bd/><w:insideH $bd/><w:insideV $bd/></w:tblBorders><w:tblLayout w:type=\"fixed\"/>"
  tbl="$tbl<w:tblCellMar><w:top w:w=\"30\" w:type=\"dxa\"/><w:left w:w=\"28\" w:type=\"dxa\"/><w:bottom w:w=\"20\" w:type=\"dxa\"/><w:right w:w=\"28\" w:type=\"dxa\"/></w:tblCellMar></w:tblPr>"
  tbl="$tbl<w:tblGrid><w:gridCol w:w=\"$labw\"/>"
  for i in $SEL; do tbl="$tbl<w:gridCol w:w=\"$stw\"/>"; done
  tbl="$tbl</w:tblGrid>"

  # Hàng tiêu đề
  local row s n
  row="$(cell "$labw" center "$(para "$al_text" 0 "$(run "Giải" "$red" 24)")")"
  for i in $SEL; do
    s="ST_SLUG_$i"; n="ST_NAME_$i"
    row="$row$(cell "$stw" center "$(para "$al_text" 0 "$(run "$(station_short "${!s}" "${!n}")" "$red" "$stsz")")")"
  done
  tbl="$tbl<w:tr><w:trPr><w:cantSplit/><w:trHeight w:val=\"$(rowh hdr)\" w:hRule=\"exact\"/></w:trPr>$row</w:tr>"

  # Các hàng giải
  local k v lab paras num color size lh
  for k in $PRIZES; do
    if [ "$k" = db ]; then lab="$(para "$al_text" 0 "$(run "$(prize_label "$k")" "$red" 28)")"
    else lab="$(para "$al_text" 40 "$(run "$(prize_label "$k")" "$red" 24)")"; fi
    if [ "$k" = 4 ] && [ -n "$note" ]; then
      lab="$lab$(para "$al_text" 0 "$(run "$note" "$red" 15)" 180)"
    fi
    row="$(cell "$labw" top "$lab")"
    for i in $SEL; do
      v="R_${i}_$k"; paras=""
      color="$black"; size="$numsz"; lh="$L"
      [ "$k" = db ] && { color="$red"; size="$dbsz"; lh="$LDB"; }
      PIND="<w:ind w:left=\"0\" w:right=\"$nind\"/>"
      for num in ${!v}; do paras="$paras$(para "$al_num" 0 "$(run "$num" "$color" "$size")" "$lh")"; done
      [ -n "$paras" ] || paras="$(para "$al_num" 0 "")"
      PIND=""
      row="$row$(cell "$stw" center "$paras")"
    done
    tbl="$tbl<w:tr><w:trPr><w:cantSplit/><w:trHeight w:val=\"$(rowh "$k")\" w:hRule=\"exact\"/></w:trPr>$row</w:tr>"
  done
  tbl="$tbl</w:tbl>"

  # --- Ghép các phiếu: điền theo cột, mỗi cột nrow phiếu
  local body="" c colbreak='<w:r><w:br w:type="column"/></w:r>'
  local gap_p="<w:p><w:pPr><w:spacing w:before=\"0\" w:after=\"0\" w:line=\"$gap\" w:lineRule=\"exact\"/></w:pPr></w:p>"
  for ((c = 1; c <= copies; c++)); do
    local hx="$header_xml"
    if [ "$c" -gt 1 ]; then
      if [ $(( (c - 1) % nrow )) -eq 0 ]; then
        hx="${hx/<\/w:pPr>/</w:pPr>$colbreak}"     # sang cột mới
      else
        [ "$gap" -gt 0 ] && hx="$gap_p$hx"         # khoảng cách giữa 2 phiếu trong cột
      fi
    fi
    body="$body$hx$tbl"
  done
  body="$body<w:p><w:pPr><w:spacing w:before=\"0\" w:after=\"0\" w:line=\"20\" w:lineRule=\"exact\"/></w:pPr></w:p>"

  local cols=""
  [ "$ncol" -gt 1 ] && cols="<w:cols w:num=\"$ncol\" w:space=\"$gap\"/>"

  # --- Ghi các file OOXML
  local d="$WORK/docx"
  mkdir -p "$d/_rels" "$d/word/_rels" "$d/docProps"

  cat > "$d/[Content_Types].xml" <<'EOF'
<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/><Override PartName="/word/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.styles+xml"/><Override PartName="/docProps/core.xml" ContentType="application/vnd.openxmlformats-package.core-properties+xml"/></Types>
EOF

  cat > "$d/_rels/.rels" <<'EOF'
<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/><Relationship Id="rId2" Type="http://schemas.openxmlformats.org/package/2006/relationships/metadata/core-properties" Target="docProps/core.xml"/></Relationships>
EOF

  cat > "$d/word/_rels/document.xml.rels" <<'EOF'
<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/></Relationships>
EOF

  local now; now="$(date -u +%Y-%m-%dT%H:%M:%SZ)"
  cat > "$d/docProps/core.xml" <<EOF
<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<cp:coreProperties xmlns:cp="http://schemas.openxmlformats.org/package/2006/metadata/core-properties" xmlns:dc="http://purl.org/dc/elements/1.1/" xmlns:dcterms="http://purl.org/dc/terms/" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"><dc:title>$(xml_esc "Kết quả XSMN $D-$M-$Y")</dc:title><dc:creator>xsmn.sh</dc:creator><dcterms:created xsi:type="dcterms:W3CDTF">$now</dcterms:created><dcterms:modified xsi:type="dcterms:W3CDTF">$now</dcterms:modified></cp:coreProperties>
EOF

  local f; f="$(xml_esc "$font")"
  cat > "$d/word/styles.xml" <<EOF
<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<w:styles $W_NS><w:docDefaults><w:rPrDefault><w:rPr><w:rFonts w:ascii="$f" w:hAnsi="$f" w:eastAsia="$f" w:cs="$f"/><w:sz w:val="22"/><w:szCs w:val="22"/><w:lang w:val="vi-VN"/></w:rPr></w:rPrDefault><w:pPrDefault><w:pPr><w:spacing w:before="0" w:after="0" w:line="240" w:lineRule="auto"/></w:pPr></w:pPrDefault></w:docDefaults><w:style w:type="paragraph" w:default="1" w:styleId="Normal"><w:name w:val="Normal"/><w:qFormat/></w:style><w:style w:type="table" w:default="1" w:styleId="TableNormal"><w:name w:val="Normal Table"/><w:tblPr><w:tblInd w:w="0" w:type="dxa"/><w:tblCellMar><w:top w:w="0" w:type="dxa"/><w:left w:w="108" w:type="dxa"/><w:bottom w:w="0" w:type="dxa"/><w:right w:w="108" w:type="dxa"/></w:tblCellMar></w:tblPr></w:style></w:styles>
EOF

  {
    printf '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n'
    printf '<w:document %s><w:body>' "$W_NS"
    printf '%s' "$body"
    printf '<w:sectPr><w:pgSz w:w="%s" w:h="%s" w:orient="%s"/><w:pgMar w:top="%s" w:right="%s" w:bottom="%s" w:left="%s" w:header="0" w:footer="0" w:gutter="0"/>%s</w:sectPr>' \
      "$pw" "$ph" "$orient" "$margin" "$margin_r" "$margin" "$margin_l" "$cols"
    printf '</w:body></w:document>\n'
  } > "$d/word/document.xml"

  # Kiểm tra XML hợp lệ trước khi nén
  local x
  for x in "$d/word/document.xml" "$d/word/styles.xml" "$d/[Content_Types].xml"; do
    xmllint --noout "$x" 2>/dev/null || die "XML sinh ra bị lỗi: $x"
  done

  # --- Nén thành .docx
  rm -f "$out"
  if command -v zip >/dev/null 2>&1; then
    (cd "$d" && zip -X -q -r "$out" "[Content_Types].xml" _rels docProps word) || die "nén docx thất bại"
  elif command -v python3 >/dev/null 2>&1; then
    (cd "$d" && python3 -m zipfile -c "$out" "[Content_Types].xml" _rels docProps word) || die "nén docx thất bại"
  else
    die "cần 'zip' hoặc 'python3' để tạo file .docx"
  fi
}

# ---------------------------------------------------------------- PDF

# Tìm LibreOffice (dùng để chuyển .docx -> .pdf, giữ đúng bố cục)
find_soffice() {
  local c
  c="$(cfg SOFFICE)"
  if [ -n "$c" ]; then
    c="${c/#\~/$HOME}"
    [ -x "$c" ] && { printf '%s' "$c"; return 0; }
    warn "SOFFICE=$c trong config không chạy được"; return 1
  fi
  for c in soffice libreoffice; do
    command -v "$c" >/dev/null 2>&1 && { command -v "$c"; return 0; }
  done
  for c in "/Applications/LibreOffice.app/Contents/MacOS/soffice" \
           "$HOME/Applications/LibreOffice.app/Contents/MacOS/soffice" \
           /usr/lib/libreoffice/program/soffice /opt/libreoffice*/program/soffice; do
    [ -x "$c" ] && { printf '%s' "$c"; return 0; }
  done
  return 1
}

# to_pdf <file.docx> <file.pdf>  -> 0 ok | 1 lỗi chuyển | 2 không có LibreOffice
to_pdf() {
  local so od f
  so="$(find_soffice)" || return 2
  od="$WORK/pdf"; mkdir -p "$od"
  # Hồ sơ LibreOffice riêng: chạy được cả khi LibreOffice đang mở trên máy
  "$so" -env:UserInstallation="file://$WORK/lo-profile" --headless \
        --convert-to pdf --outdir "$od" "$1" >/dev/null 2>&1 || return 1
  f="$od/$(basename "${1%.docx}").pdf"
  [ -s "$f" ] || return 1
  mv -f "$f" "$2"
}

# ---------------------------------------------------------------- main

main() {
  local date_in="" output="" blank=0 text_only=0 fmt="" paper=""
  while [ $# -gt 0 ]; do
    case "$1" in
      -d|--date)    [ $# -ge 2 ] || die "thiếu giá trị cho $1"; date_in="$2"; shift 2 ;;
      -c|--config)  [ $# -ge 2 ] || die "thiếu giá trị cho $1"; CONFIG_FILE="$2"; shift 2 ;;
      -o|--output)  [ $# -ge 2 ] || die "thiếu giá trị cho $1"; output="$2"; shift 2 ;;
      -f|--format)  [ $# -ge 2 ] || die "thiếu giá trị cho $1"; fmt="$2"; shift 2 ;;
      -p|--paper)   [ $# -ge 2 ] || die "thiếu giá trị cho $1"; paper="$2"; shift 2 ;;
      --html)       [ $# -ge 2 ] || die "thiếu giá trị cho $1"; HTML_FILE="$2"; shift 2 ;;
      --blank)      blank=1; shift ;;
      --text)       text_only=1; shift ;;
      --no-cache)   NO_CACHE=1; shift ;;
      -q|--quiet)   QUIET=1; shift ;;
      -h|--help)    usage; exit 0 ;;
      -v|--version) echo "xsmn.sh $VERSION"; exit 0 ;;
      *) die "tuỳ chọn không hợp lệ: $1 (xem -h)" ;;
    esac
  done

  command -v xmllint >/dev/null 2>&1 || die "cần cài xmllint (Ubuntu: sudo apt install libxml2-utils)"
  [ "$blank" = 1 ] || [ -n "$HTML_FILE" ] || command -v curl >/dev/null 2>&1 || die "cần cài curl"

  # Config
  if [ -n "$CONFIG_FILE" ]; then
    [ -f "$CONFIG_FILE" ] || die "không tìm thấy file config: $CONFIG_FILE"
  else
    CONFIG_FILE="$(find_config)" || CONFIG_FILE=""
  fi
  if [ -n "$CONFIG_FILE" ]; then
    load_config "$CONFIG_FILE"; info "Config: $CONFIG_FILE"
  else
    info "Không có file config: lấy đủ các đài trong ngày."
  fi

  # Khổ giấy: A4 (4 bản, mặc định) | A5 (2 bản) | A6 (1 bản)
  [ -n "$(cfg COPIES_PER_PAGE)" ] && warn "COPIES_PER_PAGE không còn dùng - thay bằng PAPER=A4/A5/A6"
  [ -n "$paper" ] || paper="$(cfg PAPER A4)"
  PAPER="$(printf '%s' "$paper" | tr 'a-z' 'A-Z')"
  PAPER="${PAPER%%-*}"            # chấp nhận cả "A4-4", "A5-2"...
  case "$PAPER" in A4|A5|A6) ;; *) die "khổ giấy không hợp lệ: '$paper' (A4, A5 hoặc A6)" ;; esac

  # Định dạng: pdf (mặc định) | docx | both. -o có đuôi .pdf/.docx thì theo đuôi đó
  if [ -z "$fmt" ]; then
    case "$output" in
      *.pdf|*.PDF)   fmt=pdf ;;
      *.docx|*.DOCX) fmt=docx ;;
      *) fmt="$(cfg OUTPUT_FORMAT pdf)" ;;
    esac
  fi
  fmt="$(printf '%s' "$fmt" | tr 'A-Z' 'a-z')"
  case "$fmt" in pdf|docx|both) ;; *) die "định dạng không hợp lệ: '$fmt' (pdf, docx hoặc both)" ;; esac

  # Ngày
  [ -n "$date_in" ] || date_in="$(TZ="$TZ_VN" date +%d-%m-%Y)"
  parse_date "$date_in" || die "ngày không hợp lệ: '$date_in' (dạng DD-MM-YYYY)"
  DOW="$(weekday "$D" "$M" "$Y")"

  WORK="$(mktemp -d "${TMPDIR:-/tmp}/xsmn.XXXXXX")" || die "không tạo được thư mục tạm"
  trap 'rm -rf "$WORK"' EXIT

  if [ "$blank" = 1 ]; then
    build_blank
  else
    local html="$WORK/page.html" rc
    if [ -n "$HTML_FILE" ]; then
      [ -f "$HTML_FILE" ] || die "không tìm thấy $HTML_FILE"
      cp "$HTML_FILE" "$html"
    else
      fetch_html "$html" || die "tải kết quả thất bại. Thử lại sau, hoặc dùng --blank để in phiếu trống."
    fi
    parse_results "$html"; rc=$?
    if [ "$rc" -ne 0 ]; then
      rm -f "$CACHE_DIR/$D-$M-$Y.html"
      die "chưa lấy được kết quả ngày $D-$M-$Y. Dùng --blank nếu muốn in phiếu trống."
    fi
    if results_complete; then
      if [ -z "$HTML_FILE" ] && [ "$NO_CACHE" = 0 ]; then
        mkdir -p "$CACHE_DIR" 2>/dev/null && cp "$html" "$CACHE_DIR/$D-$M-$Y.html" 2>/dev/null
      fi
    else
      warn "kết quả chưa đầy đủ (có thể đang quay trực tiếp) - ô thiếu sẽ để trống."
      rm -f "$CACHE_DIR/$D-$M-$Y.html"
    fi
  fi

  select_stations "$(wanted_stations)"
  if [ -z "$SEL" ]; then
    local avail="" i s
    for ((i = 1; i <= N_ST; i++)); do s="ST_SLUG_$i"; avail="$avail ${!s}"; done
    die "không đài nào trong config quay ngày $(dow_name "$DOW") $D-$M-$Y. Các đài hôm đó:$avail"
  fi

  [ "$blank" = 1 ] || print_text
  [ "$text_only" = 1 ] && exit 0

  # Tên file gốc (không đuôi)
  local base
  if [ -n "$output" ]; then
    case "$output" in
      *.pdf|*.PDF|*.docx|*.DOCX) base="${output%.*}" ;;
      *) base="$output" ;;
    esac
  else
    local dir; dir="$(cfg OUTPUT_DIR .)"
    dir="${dir/#\~/$HOME}"
    mkdir -p "$dir" || die "không tạo được thư mục $dir"
    base="$dir/xsmn_${D}-${M}-${Y}_${PAPER}"
    [ "$blank" = 1 ] && base="${base}_trong"
  fi
  case "$base" in /*) ;; *) base="$(pwd)/$base" ;; esac
  mkdir -p "$(dirname "$base")" || die "không tạo được thư mục cho $base"

  local docx_out="$base.docx" pdf_out="$base.pdf"
  [ "$fmt" = pdf ] && docx_out="$WORK/$(basename "$base").docx"
  build_docx "$docx_out"
  [ "$fmt" = pdf ] || info "Đã tạo: $docx_out"

  if [ "$fmt" != docx ]; then
    local rc=0
    to_pdf "$docx_out" "$pdf_out" || rc=$?
    if [ "$rc" -eq 0 ]; then
      info "Đã tạo: $pdf_out"
    else
      [ "$fmt" = pdf ] && cp "$docx_out" "$base.docx"
      if [ "$rc" -eq 2 ]; then
        warn "chưa có LibreOffice để xuất PDF. Cài: macOS 'brew install --cask libreoffice', Ubuntu 'sudo apt install libreoffice-writer' (hoặc đặt SOFFICE=<đường dẫn> trong config)."
      else
        warn "LibreOffice chuyển sang PDF thất bại."
      fi
      die "không tạo được PDF - đã lưu bản Word thay thế: $base.docx"
    fi
  fi
}

main "$@"
