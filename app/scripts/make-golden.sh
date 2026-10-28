#!/usr/bin/env bash
# Sinh document.xml chuẩn từ cli/xsmn.sh để test render-docx so từng ký tự.
# Chỉ cần chạy lại khi build_docx của bản bash thay đổi. Cần: bash, xmllint, zip, unzip.
set -eu
APP="$(cd "$(dirname "$0")/.." && pwd)"
CLI="$APP/../cli"
OUT="$APP/test/golden"
FIX="$APP/test/fixtures"
WORK="$(mktemp -d)"
trap 'rm -rf "$WORK"' EXIT

gen() {   # gen <tên> <conf> <fixture> <ngày> <khổ>
  "$CLI/xsmn.sh" -q -c "$2" --html "$FIX/$3" -d "$4" -p "$5" -f docx -o "$WORK/$1.docx" >/dev/null
  unzip -p "$WORK/$1.docx" word/document.xml > "$OUT/$1.document.xml"
  echo "$OUT/$1.document.xml"
}

gen default-A4 "$CLI/xsmn.conf.example" fixture-26-10-2026.html 26-10-2026 A4
gen default-A5 "$CLI/xsmn.conf.example" fixture-26-10-2026.html 26-10-2026 A5
gen default-A6 "$CLI/xsmn.conf.example" fixture-26-10-2026.html 26-10-2026 A6
gen default-A4-4dai "$CLI/xsmn.conf.example" fixture-4dai-24-10-2026.html 24-10-2026 A4
gen custom-A4 "$OUT/custom.conf" fixture-26-10-2026.html 26-10-2026 A4
gen custom-A6 "$OUT/custom.conf" fixture-26-10-2026.html 26-10-2026 A6
