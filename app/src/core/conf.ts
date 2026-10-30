// Nhập / xuất cài đặt bằng file .conf (KEY=VALUE, dòng # là chú thích) — SPEC §5.
// File chỉ chứa thông tin đầu phiếu, đài và bố cục bản in; KHÔNG chứa máy in, thư mục lưu, tự lấy lại
// (riêng từng máy). exportConf ghi đủ phần đó để nhập lại được y nguyên; importConf nhận cả khoá kiểu cũ
// của bản bash đã bỏ (STATIONS, STATIONS_T2…, CARD_GAP_CM, ALIGN_TEXT, ALIGN_NUMBER, NUMBER_PAD_RIGHT_CM,
// AGENT_PHONES). File chưa có CONF_VERSION=2 là kiểu cũ: phiếu tự thêm "ĐC: " trước AGENT_ADDRESS.
// CONF_VERSION=3 thêm màu, kiểu chữ từng phần (khoá COLOR_TEXT/ACCENT/NUMBER/BORDER của bản 2 vẫn nhận).

import { WEEKDAY_SHORT } from './dates'
import {
  ALIGNS, FORMATS, HEADER_AFTER_MAX, HEADER_SIZE_MAX, HEADER_SIZE_MIN, LABEL_SIZE_MAX, LABEL_SIZE_MIN, legacyAddrLine,
  legacyContactLine, normalizeColor, normalizeFontName, normalizeSettings, PAPERS, ROW_DELTA_MAX, ROW_DELTA_MIN,
  SETTINGS_VERSION, toNumber, VALIGNS, defaultSettings,
  type Align, type CellStyle, type HeaderLineText, type OutputFormat, type Paper, type PrizeRowStyle, type Settings,
  type TextStyle, type VAlign
} from './settings'
import { findStation, PRIZES, scheduleFor, STATIONS, type PrizeKey } from './stations'

/** Đọc file KEY=VALUE. Khoá sau ghi đè khoá trước. Giá trị trong ngoặc kép giữ nguyên, kể cả dấu #. */
export function parseConf(text: string): Map<string, string> {
  const out = new Map<string, string>()
  for (const rawLine of text.split(/\r?\n/)) {
    const line = rawLine.trim()
    if (!line || line.startsWith('#') || line.startsWith(';')) continue
    const eq = line.indexOf('=')
    if (eq < 0) continue
    const key = line.slice(0, eq).trim()
    let val = line.slice(eq + 1).trim()
    const q = val[0]
    const close = q === '"' || q === "'" ? val.lastIndexOf(q) : -1
    if (close > 0) val = val.slice(1, close)
    else val = val.replace(/(^|\s)#.*$/, '').trim()
    if (key) out.set(key, val)
  }
  return out
}

export interface ConfImport {
  settings: Settings
  /** Số khoá đã nhập. */
  imported: number
  /** Khoá lạ hoặc giá trị không hợp lệ (đã bỏ qua). */
  ignored: string[]
}

const splitList = (v: string) => v.split(/[\s,;]+/).map((s) => s.trim().toLowerCase()).filter(Boolean)

function parseBool(v: string): boolean | null {
  const t = v.trim().toLowerCase()
  if (['1', 'true', 'yes', 'co', 'có', 'on'].includes(t)) return true
  if (['0', 'false', 'no', 'khong', 'không', 'off'].includes(t)) return false
  return null
}

/** "top-center", "center right", "right"… → phần căn dọc / ngang (thiếu phần nào thì null). */
function parseAlign9(v: string): { x: Align | null; y: VAlign | null } | null {
  const parts = v.toLowerCase().split(/[\s,\-/]+/).filter(Boolean).map((p) => (p === 'middle' ? 'center' : p))
  if (!parts.length || parts.length > 2) return null
  if (parts.length === 1) {
    const p = parts[0]
    if (p === 'top' || p === 'bottom') return { x: null, y: p }
    return ALIGNS.includes(p as Align) ? { x: p as Align, y: null } : null
  }
  const [a, b] = parts
  if (VALIGNS.includes(a as VAlign) && ALIGNS.includes(b as Align)) return { y: a as VAlign, x: b as Align }
  return null
}

const DAY_KEYS = WEEKDAY_SHORT // CN, T2 … T7 (chỉ số = thứ)
type TextKey = 'label' | 'name' | 'addr' | 'contact'
const TEXT_KEYS: Record<string, TextKey> = {
  AGENT_LABEL: 'label', AGENT_NAME: 'name', AGENT_ADDRESS: 'addr', AGENT_CONTACT: 'contact'
}
/** Tiền tố khoá _SHOW / _SIZE / _ALIGN / _AFTER_PT của từng dòng. AGENT_PHONES_ là tên cũ của AGENT_CONTACT_. */
const LINE_PREFIX: Record<string, TextKey | 'date'> = { ...TEXT_KEYS, AGENT_PHONES: 'contact', DATE_LINE: 'date' }
/** ROW_8 … ROW_1, ROW_DB: chỉnh riêng từng hàng giải. */
const ROW_NAME = (k: PrizeKey) => `ROW_${k.toUpperCase()}`

export function importConf(text: string, base: Settings = defaultSettings()): ConfImport {
  const s = normalizeSettings(JSON.parse(JSON.stringify(base)))
  const conf = parseConf(text)
  const ignored: string[] = []
  let imported = 0
  const ok = () => { imported++ }
  const bad = (k: string) => { ignored.push(k) }

  const setNum = (k: string, v: string, min: number, max: number, apply: (n: number) => void) => {
    const n = toNumber(v, NaN, -Infinity, Infinity)
    if (Number.isNaN(n) || n < min || n > max) return bad(k)
    apply(n)
    ok()
  }
  /** Số hoặc "auto" (null). */
  const setNumAuto = (k: string, v: string, min: number, max: number, apply: (n: number | null) => void) => {
    if (/^(auto|tự động|tu dong)$/i.test(v.trim())) {
      apply(null)
      return ok()
    }
    setNum(k, v, min, max, apply)
  }
  const setBool = (k: string, v: string, apply: (b: boolean) => void) => {
    const b = parseBool(v)
    if (b === null) return bad(k)
    apply(b)
    ok()
  }
  const setColor = (k: string, v: string, apply: (c: string) => void) => {
    const c = normalizeColor(v, '')
    if (!c) return bad(k)
    apply(c)
    ok()
  }
  /** Rỗng = theo mức chung (null). */
  const setOptColor = (k: string, v: string, apply: (c: string | null) => void) => (v.trim() ? setColor(k, v, apply) : (apply(null), ok()))
  const setOptBool = (k: string, v: string, apply: (b: boolean | null) => void) => (v.trim() ? setBool(k, v, apply) : (apply(null), ok()))
  /** COLOR_ACCENT của bản 2: số ĐB in màu này; trùng màu số thì để ĐB theo màu số. */
  let legacyAccent: string | null = null
  const setAlign = (k: string, v: string, apply: (a: Align) => void) => {
    const a = v.toLowerCase() as Align
    if (!ALIGNS.includes(a)) return bad(k)
    apply(a)
    ok()
  }
  const setCellAlign = (k: string, v: string, cell: CellStyle) => {
    const a = parseAlign9(v)
    if (!a) return bad(k)
    if (a.x) cell.alignX = a.x
    if (a.y) cell.alignY = a.y
    ok()
  }

  /** Kiểu cũ: danh sách đài muốn in, giữ thứ tự trên web. */
  const legacyLists = new Map<number | 'all', string[]>()
  /** Kiểu mới: thứ tự cột trên phiếu, "-ma-dai" = không in. */
  const orderLists = new Map<number, string[]>()
  let mode: Settings['stations']['mode'] | null = null
  const confVersion = toNumber(conf.get('CONF_VERSION'), 1, 1, Infinity)

  for (const [key, v] of conf) {
    if (key === 'CONF_VERSION') continue
    const textKey = TEXT_KEYS[key]
    if (textKey) {
      const h = s.header[textKey]
      h.value = textKey === 'addr' && confVersion < 2 ? legacyAddrLine(v) : v
      h.show = true
      ok()
      continue
    }
    if (key === 'AGENT_PHONES') {
      // Như bản bash: có AGENT_CONTACT (nguyên dòng liên hệ) thì danh sách số không dùng
      if (!conf.has('AGENT_CONTACT')) {
        s.header.contact.value = legacyContactLine(v.split('|'))
        s.header.contact.show = true
      }
      ok()
      continue
    }
    const lineKey = key.match(/^(AGENT_LABEL|AGENT_NAME|AGENT_ADDRESS|AGENT_CONTACT|AGENT_PHONES|DATE_LINE)_(SHOW|SIZE|ALIGN|AFTER_PT|COLOR|BOLD|ITALIC)$/)
    if (lineKey) {
      const field = LINE_PREFIX[lineKey[1]]
      const prop = lineKey[2]
      const st: TextStyle = s.header[field]
      if (prop === 'COLOR') {
        setColor(key, v, (c) => { st.color = c })
      } else if (prop === 'BOLD' || prop === 'ITALIC') {
        setBool(key, v, (b) => { if (prop === 'BOLD') st.bold = b; else st.italic = b })
      } else if (prop === 'SIZE') {
        setNum(key, v, HEADER_SIZE_MIN, HEADER_SIZE_MAX, (n) => { s.header[field].size = n })
      } else if (field === 'date') {
        // Dòng thứ, ngày luôn in: DATE_LINE_SHOW của file cũ bỏ qua
        if (prop === 'ALIGN') setAlign(key, v, (a) => { s.header.date.align = a })
        else if (prop === 'AFTER_PT') setNum(key, v, 0, HEADER_AFTER_MAX, (n) => { s.header.date.afterPt = n })
      } else if (prop === 'SHOW') {
        setBool(key, v, (b) => { s.header[field].show = b })
      } else if (field === 'label') {
        // nhãn theo căn lề, khoảng cách của dòng tên
        bad(key)
      } else {
        const h = s.header[field]
        if (prop === 'ALIGN') setAlign(key, v, (a) => { h.align = a })
        else setNum(key, v, 0, HEADER_AFTER_MAX, (n) => { h.afterPt = n })
      }
      continue
    }
    const rowKey = key.match(/^ROW_(8|7|6|5|4|3|2|1|DB)_(SIZE_PT|NUMBER_COLOR|LABEL_COLOR|BOLD|ITALIC|UNDERLINE|FILL)$/)
    if (rowKey) {
      const r: PrizeRowStyle = s.print.rows[rowKey[1].toLowerCase() as PrizeKey]
      const prop = rowKey[2]
      if (prop === 'SIZE_PT') setNum(key, v, ROW_DELTA_MIN, ROW_DELTA_MAX, (n) => { r.sizeDeltaPt = n })
      else if (prop === 'NUMBER_COLOR') setOptColor(key, v, (c) => { r.numberColor = c })
      else if (prop === 'LABEL_COLOR') setOptColor(key, v, (c) => { r.labelColor = c })
      else if (prop === 'FILL') setOptColor(key, v, (c) => { r.fill = c })
      else if (prop === 'BOLD') setOptBool(key, v, (b) => { r.bold = b })
      else if (prop === 'ITALIC') setOptBool(key, v, (b) => { r.italic = b })
      else setOptBool(key, v, (b) => { r.underline = b })
      continue
    }
    // Từ đây trở xuống: giá trị rỗng = chưa khai báo (như bản bash cũ)
    if (!v) continue

    const legacyDay = key.match(/^STATIONS_(T[2-7]|CN)$/)
    if (key === 'STATIONS' || legacyDay) {
      legacyLists.set(legacyDay ? DAY_KEYS.indexOf(legacyDay[1] as (typeof DAY_KEYS)[number]) : 'all', splitList(v))
      ok()
      continue
    }
    const orderDay = key.match(/^STATIONS_ORDER_(T[2-7]|CN)$/)
    if (orderDay) {
      orderLists.set(DAY_KEYS.indexOf(orderDay[1] as (typeof DAY_KEYS)[number]), splitList(v))
      ok()
      continue
    }
    if (key.startsWith('NAME_')) {
      // chấp nhận cả NAME_tp-hcm lẫn NAME_tp_hcm
      const slug = key.slice(5).toLowerCase().replace(/_/g, '-')
      if (findStation(slug)?.short === v) delete s.stations.shortNames[slug]
      else s.stations.shortNames[slug] = v
      ok()
      continue
    }
    switch (key) {
      case 'STATIONS_MODE':
        if (v === 'all' || v === 'pick') { mode = v; ok() } else bad(key)
        break
      case 'PAPER': {
        const p = v.toUpperCase().split('-')[0] as Paper
        if (!PAPERS.includes(p)) bad(key)
        else { s.print.paper = p; ok() }
        break
      }
      case 'OUTPUT_FORMAT': {
        const f = v.toLowerCase() as OutputFormat
        if (!FORMATS.includes(f)) bad(key)
        else { s.print.format = f; ok() }
        break
      }
      case 'CARD_WIDTH_CM': setNumAuto(key, v, 2, 20, (n) => { s.print.cardWidthCm = n }); break
      case 'CARD_HEIGHT_CM': setNumAuto(key, v, 4, 30, (n) => { s.print.cardHeightCm = n }); break
      case 'CARD_GAP_CM': setNum(key, v, 0, 5, (n) => { s.print.cardGapXCm = n; s.print.cardGapYCm = n }); break
      case 'CARD_GAP_X_CM': setNum(key, v, 0, 5, (n) => { s.print.cardGapXCm = n }); break
      case 'CARD_GAP_Y_CM': setNum(key, v, 0, 5, (n) => { s.print.cardGapYCm = n }); break
      case 'CARD_ALIGN': setAlign(key, v, (a) => { s.print.cardAlign = a }); break
      case 'NUMBER_FONT_PT': setNumAuto(key, v, 6, 30, (n) => { s.print.numberFontPt = n }); break
      case 'FONT':
        s.print.font = normalizeFontName(v, s.print.font)
        ok()
        break
      case 'TEXT_PAD_X_CM': setNum(key, v, 0, 2, (n) => { s.print.textCell.padXCm = n }); break
      case 'TEXT_PAD_Y_CM': setNum(key, v, 0, 2, (n) => { s.print.textCell.padYCm = n }); break
      case 'TEXT_ALIGN': setCellAlign(key, v, s.print.textCell); break
      case 'NUMBER_PAD_X_CM': setNum(key, v, 0, 2, (n) => { s.print.numberCell.padXCm = n }); break
      case 'NUMBER_PAD_Y_CM': setNum(key, v, 0, 2, (n) => { s.print.numberCell.padYCm = n }); break
      case 'NUMBER_ALIGN': setCellAlign(key, v, s.print.numberCell); break
      // khoá kiểu cũ
      case 'ALIGN_TEXT': setAlign(key, v, (a) => { s.print.textCell.alignX = a }); break
      case 'ALIGN_NUMBER': setAlign(key, v, (a) => { s.print.numberCell.alignX = a }); break
      case 'NUMBER_PAD_RIGHT_CM': setNum(key, v, 0, 2, (n) => { s.print.numberCell.padXCm = n }); break
      case 'BORDER_COLOR': case 'COLOR_BORDER': setColor(key, v, (c) => { s.print.borderColor = c }); break
      case 'HEAD_ROW_SIZE': setNum(key, v, LABEL_SIZE_MIN, LABEL_SIZE_MAX, (n) => { s.print.headRow.labelSize = n }); break
      case 'HEAD_ROW_COLOR': setColor(key, v, (c) => { s.print.headRow.color = c }); break
      case 'HEAD_ROW_BOLD': setBool(key, v, (b) => { s.print.headRow.bold = b }); break
      case 'PRIZE_LABEL_SIZE': setNum(key, v, LABEL_SIZE_MIN, LABEL_SIZE_MAX, (n) => { s.print.prizeLabels.size = n }); break
      case 'PRIZE_LABEL_DB_SIZE': setNum(key, v, LABEL_SIZE_MIN, LABEL_SIZE_MAX, (n) => { s.print.prizeLabels.dbSize = n }); break
      case 'PRIZE_LABEL_COLOR': setColor(key, v, (c) => { s.print.prizeLabels.color = c }); break
      case 'PRIZE_LABEL_BOLD': setBool(key, v, (b) => { s.print.prizeLabels.bold = b }); break
      case 'NUMBER_COLOR': setColor(key, v, (c) => { s.print.numbers.color = c }); break
      case 'NUMBER_BOLD': setBool(key, v, (b) => { s.print.numbers.bold = b }); break
      case 'NUMBER_ITALIC': setBool(key, v, (b) => { s.print.numbers.italic = b }); break
      case 'NUMBER_UNDERLINE': setBool(key, v, (b) => { s.print.numbers.underline = b }); break
      // Màu chung của bản 2
      case 'COLOR_TEXT':
        setColor(key, v, (c) => { for (const k of ['label', 'name', 'addr', 'contact', 'date'] as const) s.header[k].color = c })
        break
      case 'COLOR_ACCENT':
        setColor(key, v, (c) => { s.print.headRow.color = c; s.print.prizeLabels.color = c; legacyAccent = c })
        break
      case 'COLOR_NUMBER': setColor(key, v, (c) => { s.print.numbers.color = c }); break
      // Máy in, thư mục lưu, tự lấy lại (PRINTER, OUTPUT_DIR…) là cài đặt riêng từng máy: không nhập
      default: bad(key)
    }
  }

  // Danh sách đài: STATIONS_ORDER_x (thứ tự + bật/tắt) > STATIONS_x > STATIONS (kiểu cũ: thứ tự web)
  if (legacyLists.size || orderLists.size) {
    s.stations.mode = 'pick'
    for (let d = 0; d < 7; d++) {
      const order = orderLists.get(d)
      if (order) {
        s.stations.byWeekday[d] = order.map((t) => ({ slug: t.replace(/^-/, ''), on: !t.startsWith('-') }))
        continue
      }
      const want = legacyLists.get(d) ?? legacyLists.get('all')
      if (want) s.stations.byWeekday[d] = scheduleFor(d).map((slug) => ({ slug, on: want.includes(slug) }))
    }
  }
  if (mode) s.stations.mode = mode
  if (legacyAccent) s.print.rows.db.numberColor = legacyAccent === s.print.numbers.color ? null : legacyAccent

  return { settings: normalizeSettings(s), imported, ignored }
}

// ---------------------------------------------------------------- xuất

const q = (v: string) => `"${v}"`
const num = (n: number) => String(Number(n.toFixed(4)))
const auto = (n: number | null) => (n === null ? 'auto' : num(n))
const bool = (b: boolean) => (b ? '1' : '0')
/** Thứ Hai trước, Chủ Nhật cuối như lịch đọc. */
const DAY_ORDER = [1, 2, 3, 4, 5, 6, 0]

const optBool = (b: boolean | null) => (b === null ? '' : bool(b))
/** Màu, đậm, nghiêng của một đoạn chữ. */
const inkKeys = (k: string, t: TextStyle) => [`${k}_COLOR=${t.color}`, `${k}_BOLD=${bool(t.bold)}`, `${k}_ITALIC=${bool(t.italic)}`]

/** Một dòng đầu phiếu: chữ, ẩn/hiện, cỡ chữ, căn lề, khoảng cách tới dòng dưới, màu, kiểu chữ. */
const lineKeys = (k: string, l: HeaderLineText) => [
  `${k}=${q(l.value)}`,
  `${k}_SHOW=${bool(l.show)}`,
  `${k}_SIZE=${num(l.size)}`,
  `${k}_ALIGN=${l.align}`,
  `${k}_AFTER_PT=${num(l.afterPt)}`,
  ...inkKeys(k, l)
]

/** Ghi thông tin đầu phiếu, đài, bố cục bản in ra .conf (nhập lại bằng importConf được y nguyên). */
export function exportConf(settings: Settings, meta: { appName: string; version: string; when: string }): string {
  const s = normalizeSettings(settings)
  const h = s.header
  const p = s.print
  const lines: string[] = [
    `# Cài đặt ${meta.appName} — xuất lúc ${meta.when} (phiên bản ${meta.version})`,
    '# Nhập lại: Cài đặt → Cấu hình → Nhập.  Dòng bắt đầu bằng # là chú thích.',
    '# Không gồm máy in, thư mục lưu file (cài riêng trên từng máy).',
    '# _SHOW: 1 = hiện, 0 = ẩn. _SIZE: cỡ chữ (pt). Số đo tính bằng cm, dùng dấu chấm hoặc phẩy.',
    '# _COLOR: mã màu hex, không có #. _BOLD / _ITALIC / _UNDERLINE: 1 = bật, 0 = tắt.',
    '# Định dạng file. Không có dòng này là file kiểu cũ: phiếu tự thêm "ĐC: " trước địa chỉ.',
    `CONF_VERSION=${SETTINGS_VERSION}`,
    '',
    '# ---------- Thông tin (đầu phiếu)',
    '# Chữ in đúng như đã gõ. _ALIGN: left | center | right. _AFTER_PT: khoảng cách tới dòng dưới (pt).',
    '# Nhãn in chung dòng với tên, theo căn lề và khoảng cách của dòng tên.',
    `AGENT_LABEL=${q(h.label.value)}`,
    `AGENT_LABEL_SHOW=${bool(h.label.show)}`,
    `AGENT_LABEL_SIZE=${num(h.label.size)}`,
    ...inkKeys('AGENT_LABEL', h.label),
    ...lineKeys('AGENT_NAME', h.name),
    ...lineKeys('AGENT_ADDRESS', h.addr),
    '# Dòng liên hệ (số điện thoại)',
    ...lineKeys('AGENT_CONTACT', h.contact),
    '# Dòng thứ, ngày: luôn in, tự đổi theo ngày xổ. _AFTER_PT là khoảng cách tới bảng kết quả.',
    `DATE_LINE_SIZE=${num(h.date.size)}`,
    `DATE_LINE_ALIGN=${h.date.align}`,
    `DATE_LINE_AFTER_PT=${num(h.date.afterPt)}`,
    ...inkKeys('DATE_LINE', h.date),
    '',
    '# ---------- Đài cần in',
    '# STATIONS_MODE: all = mọi đài quay trong ngày; pick = theo danh sách từng thứ dưới đây',
    '# STATIONS_ORDER_T2 … CN: thứ tự cột trên phiếu; dấu - trước mã đài = không in đài đó',
    `STATIONS_MODE=${s.stations.mode}`,
    ...DAY_ORDER.map((d) => {
      const list = s.stations.byWeekday[d].map((x) => (x.on ? x.slug : `-${x.slug}`)).join(', ')
      return `STATIONS_ORDER_${DAY_KEYS[d]}=${q(list)}`
    }),
    '# Tên in trên phiếu của từng đài',
    ...STATIONS.map((st) => `NAME_${st.slug}=${q(s.stations.shortNames[st.slug] ?? st.short)}`),
    '',
    '# ---------- Bản in',
    '# PAPER: A4 (4 phiếu/tờ) | A5 (2) | A6 (1). OUTPUT_FORMAT: pdf | docx | both',
    `PAPER=${p.paper}`,
    `OUTPUT_FORMAT=${p.format}`,
    '# Kích thước phiếu (cm); auto = lớn nhất vừa khổ giấy',
    `CARD_WIDTH_CM=${auto(p.cardWidthCm)}`,
    `CARD_HEIGHT_CM=${auto(p.cardHeightCm)}`,
    '# Khoảng cách giữa các phiếu (cm): X = ngang, giữa 2 cột; Y = dọc, giữa 2 hàng',
    `CARD_GAP_X_CM=${num(p.cardGapXCm)}`,
    `CARD_GAP_Y_CM=${num(p.cardGapYCm)}`,
    '# Vị trí cụm phiếu trên trang: left | center | right',
    `CARD_ALIGN=${p.cardAlign}`,
    '# Font: tên font đã cài trên máy, ví dụ Times New Roman, Arial. Cỡ số kết quả (pt): auto = lớn nhất vừa phiếu',
    `FONT=${q(p.font)}`,
    `NUMBER_FONT_PT=${auto(p.numberFontPt)}`,
    '# Chữ trong bảng (Giải, tên giải, tên đài) và số kết quả: padding (cm) + căn',
    '# _ALIGN: <dọc>-<ngang>, dọc = top | center | bottom, ngang = left | center | right',
    `TEXT_PAD_X_CM=${num(p.textCell.padXCm)}`,
    `TEXT_PAD_Y_CM=${num(p.textCell.padYCm)}`,
    `TEXT_ALIGN=${p.textCell.alignY}-${p.textCell.alignX}`,
    `NUMBER_PAD_X_CM=${num(p.numberCell.padXCm)}`,
    `NUMBER_PAD_Y_CM=${num(p.numberCell.padYCm)}`,
    `NUMBER_ALIGN=${p.numberCell.alignY}-${p.numberCell.alignX}`,
    '# Bảng kết quả: màu viền; hàng tiêu đề ("Giải", tên đài; HEAD_ROW_SIZE là cỡ chữ "Giải");',
    '# tên giải (PRIZE_LABEL_DB_SIZE: cỡ chữ "ĐB"); số kết quả (chung cho mọi hàng)',
    `BORDER_COLOR=${p.borderColor}`,
    `HEAD_ROW_SIZE=${num(p.headRow.labelSize)}`,
    `HEAD_ROW_COLOR=${p.headRow.color}`,
    `HEAD_ROW_BOLD=${bool(p.headRow.bold)}`,
    `PRIZE_LABEL_SIZE=${num(p.prizeLabels.size)}`,
    `PRIZE_LABEL_DB_SIZE=${num(p.prizeLabels.dbSize)}`,
    `PRIZE_LABEL_COLOR=${p.prizeLabels.color}`,
    `PRIZE_LABEL_BOLD=${bool(p.prizeLabels.bold)}`,
    `NUMBER_COLOR=${p.numbers.color}`,
    `NUMBER_BOLD=${bool(p.numbers.bold)}`,
    `NUMBER_ITALIC=${bool(p.numbers.italic)}`,
    `NUMBER_UNDERLINE=${bool(p.numbers.underline)}`,
    '# Từng hàng giải (ROW_8 … ROW_1, ROW_DB). _SIZE_PT: cỡ số cộng thêm so với cỡ chung (pt, âm được).',
    '# Để trống = theo mức chung ở trên; _FILL để trống = không tô nền.',
    ...PRIZES.flatMap((k) => {
      const r = p.rows[k]
      const n = ROW_NAME(k)
      return [
        `${n}_SIZE_PT=${num(r.sizeDeltaPt)}`,
        `${n}_NUMBER_COLOR=${r.numberColor ?? ''}`,
        `${n}_LABEL_COLOR=${r.labelColor ?? ''}`,
        `${n}_BOLD=${optBool(r.bold)}`,
        `${n}_ITALIC=${optBool(r.italic)}`,
        `${n}_UNDERLINE=${optBool(r.underline)}`,
        `${n}_FILL=${r.fill ?? ''}`
      ]
    }),
    ''
  ]
  return lines.join('\n')
}
