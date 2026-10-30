// Cài đặt (SPEC §5): mặc định, chuẩn hoá dữ liệu đọc từ JSON, nhập xsmn.conf của bản bash.
// Không đụng tới file: đọc/ghi nằm ở settings-file.ts để renderer import được module này.

import { PRIZES, SCHEDULE, findStation, scheduleFor, type PrizeKey } from './stations'
import { WEEKDAY_SHORT } from './dates'

export type Paper = 'A4' | 'A5' | 'A6'
export type OutputFormat = 'pdf' | 'docx' | 'both'
export type Align = 'left' | 'center' | 'right'

export const PAPERS: readonly Paper[] = ['A4', 'A5', 'A6']
export const FORMATS: readonly OutputFormat[] = ['pdf', 'docx', 'both']
export const ALIGNS: readonly Align[] = ['left', 'center', 'right']
export type VAlign = 'top' | 'center' | 'bottom'
export const VALIGNS: readonly VAlign[] = ['top', 'center', 'bottom']
/**
 * Dàn cụm phiếu trên trang theo cột (ngang) / theo hàng (dọc): sát một phía, giữa, hoặc
 * between = sát hai lề, phần trống dồn vào giữa các phiếu; even = phần trống chia đều cho lề và
 * giữa các phiếu. Khoảng cách đã đặt (cardGapX/YCm) là tối thiểu.
 */
export type CardPosX = Align | 'between' | 'even'
export type CardPosY = VAlign | 'between' | 'even'
export const CARD_POS_X: readonly CardPosX[] = ['left', 'center', 'right', 'between', 'even']
export const CARD_POS_Y: readonly CardPosY[] = ['top', 'center', 'bottom', 'between', 'even']
/** Font phiếu mặc định (số đo của bản bash tính theo font này). */
export const DEFAULT_FONT = 'Times New Roman'

/** Màu (hex, không có #) và kiểu chữ của một đoạn chữ trên phiếu. */
export interface TextStyle {
  color: string
  bold: boolean
  italic: boolean
}

/** Chữ đầu phiếu: in đúng như đã gõ (phiếu không tự thêm "ĐC: " hay "DĐ: "). */
export interface HeaderText extends TextStyle {
  show: boolean
  size: number
  value: string
}

/** Cỡ chữ, căn lề và khoảng cách của một dòng đầu phiếu. */
export interface HeaderLineStyle {
  size: number
  align: Align
  /** Khoảng cách tới dòng dưới (pt); với dòng thứ, ngày là khoảng cách tới bảng kết quả. */
  afterPt: number
}

export type HeaderLineText = HeaderText & HeaderLineStyle

export interface HeaderSettings {
  /** Nhãn trước tên: in chung dòng với tên, theo căn lề và khoảng cách của dòng tên. */
  label: HeaderText
  name: HeaderLineText
  addr: HeaderLineText
  /** Dòng liên hệ (số điện thoại), một dòng. */
  contact: HeaderLineText
  /** Dòng thứ, ngày: luôn in, luôn là dòng cuối ngay trên bảng. */
  date: HeaderLineStyle & TextStyle
  /** Label của dòng địa chỉ / dòng liên hệ (in liền trước chữ, như nhãn trước tên). */
  addrLabel: HeaderText
  contactLabel: HeaderText
  /** Thứ tự các dòng phần đầu (Thứ, ngày luôn cuối): "name" | "addr" | "contact" | id dòng tự do. */
  order: string[]
  /** Dòng tự do phần đầu, tối đa FREE_LINES_MAX. */
  extra: FreeLine[]
  /** Dòng tự do dưới bảng kết quả, theo thứ tự in, tối đa FREE_LINES_MAX. */
  footer: FreeLine[]
}

/** Dòng tự do: Label + Text in liền nhau trên một dòng, căn lề và khoảng cách chung. */
export interface FreeLine {
  id: string
  label: HeaderText
  text: HeaderText
  align: Align
  afterPt: number
}

export interface StationPick {
  slug: string
  on: boolean
}

export interface StationSettings {
  mode: 'all' | 'pick'
  /** Khoá "0" (CN) … "6" (T7); thứ tự mảng = thứ tự cột trên phiếu. */
  byWeekday: Record<string, StationPick[]>
  /** Chỉ lưu tên khác mặc định. */
  shortNames: Record<string, string>
}

/** Hàng tiêu đề của bảng: chữ "Giải" và tên đài (cỡ tên đài tự chọn theo bề rộng cột). */
export interface HeadRowStyle {
  /** Cỡ chữ "Giải" (pt). */
  labelSize: number
  color: string
  bold: boolean
}

/** Tên giải (Tám … Nhất, ĐB) ở cột đầu bảng. */
export interface PrizeLabelStyle {
  size: number
  dbSize: number
  color: string
  bold: boolean
}

/** Số kết quả, chung cho mọi hàng giải. */
export interface NumberStyle {
  color: string
  bold: boolean
  italic: boolean
  underline: boolean
}

/** Chỉnh riêng một hàng giải; null = theo Số kết quả / Tên giải. */
export interface PrizeRowStyle {
  /** Cỡ số cộng thêm so với cỡ chung (pt, có thể âm). */
  sizeDeltaPt: number
  numberColor: string | null
  labelColor: string | null
  bold: boolean | null
  italic: boolean | null
  underline: boolean | null
  /** Màu nền cả hàng; null = không tô. */
  fill: string | null
}

export interface PrintSettings {
  paper: Paper
  format: OutputFormat
  /** Bề rộng mỗi phiếu (cm); null = tự động, rộng nhất vừa khổ giấy. */
  cardWidthCm: number | null
  /** Chiều cao mỗi phiếu (cm); null = tự động, cao hết chỗ trống trên khổ giấy. */
  cardHeightCm: number | null
  /** Khoảng cách ngang giữa hai cột phiếu (cm). */
  cardGapXCm: number
  /** Khoảng cách dọc giữa hai hàng phiếu (cm). */
  cardGapYCm: number
  /** Dàn cụm phiếu theo cột (ngang). */
  cardAlign: CardPosX
  /** Dàn cụm phiếu theo hàng (dọc); chỉ khác "top" khi phiếu thấp hơn chỗ trống. */
  cardAlignY: CardPosY
  /** Chữ trong bảng: "Giải", tên giải, tên đài. */
  textCell: CellStyle
  /** Số kết quả. */
  numberCell: CellStyle
  /** null = tự chọn cỡ lớn nhất vừa phiếu. */
  numberFontPt: number | null
  /** Tên họ font đã cài trên máy (font hệ thống, không nhúng sẵn). */
  font: string
  /** Màu viền bảng (hex). */
  borderColor: string
  headRow: HeadRowStyle
  prizeLabels: PrizeLabelStyle
  numbers: NumberStyle
  rows: Record<PrizeKey, PrizeRowStyle>
}

/**
 * Cách đặt nội dung trong ô bảng. Padding tính từ mép ô tới nội dung, ở phía nội dung được căn
 * (căn phải → mép phải, căn trái → mép trái, căn giữa → cả hai bên); dọc tương tự.
 */
export interface CellStyle {
  padXCm: number
  padYCm: number
  alignX: Align
  alignY: VAlign
}

export interface PrinterSettings {
  deviceName: string | null
  silent: boolean
  copies: number
}

/**
 * 2: chữ đầu phiếu in nguyên văn, liên hệ là một dòng (30-10-2026). Bản 1 tự thêm "ĐC: " trước
 * địa chỉ và in mỗi số thành "DĐ: …"; normalizeSettings chuyển sang để phiếu in ra như cũ.
 * 3: màu, kiểu chữ riêng từng phần và từng hàng giải (30-10-2026). Bản 2 có 4 màu chung
 * (print.colors); normalizeSettings đổ sang từng phần, số ĐB lấy màu nhấn như cũ.
 * 4: Label cho dòng địa chỉ / liên hệ, dòng tự do đầu và cuối phiếu, thứ tự dòng (30-10-2026). Bản 3
 * thiếu các trường này thì lấy mặc định (trống), phiếu in ra như cũ.
 */
export const SETTINGS_VERSION = 4

export interface Settings {
  version: typeof SETTINGS_VERSION
  header: HeaderSettings
  stations: StationSettings
  print: PrintSettings
  output: { dir: string }
  printer: PrinterSettings
  autoRefresh: boolean
}

export const HEADER_SIZE_MIN = 5
export const HEADER_SIZE_MAX = 30
/** Khoảng cách tối đa dưới một dòng đầu phiếu (pt). */
export const HEADER_AFTER_MAX = 20
/** Cỡ chữ "Giải", tên giải (pt). */
export const LABEL_SIZE_MIN = 6
export const LABEL_SIZE_MAX = 24
/** Cỡ số cộng thêm của một hàng giải (pt). */
export const ROW_DELTA_MIN = -6
export const ROW_DELTA_MAX = 6
export const BLACK = '000000'
/** Mỗi phần (đầu, cuối phiếu) có tối đa ngần này dòng tự do. */
export const FREE_LINES_MAX = 5
/** Ba dòng có sẵn của phần đầu, theo thứ tự mặc định. */
export const BUILTIN_LINES = ['name', 'addr', 'contact'] as const
export type BuiltinLine = (typeof BUILTIN_LINES)[number]
const FREE_ID = /^[a-z0-9]{1,12}$/

/** Dòng tự do mới: Label trống, Text cỡ 11 pt, căn giữa. */
export function newFreeLine(id: string): FreeLine {
  return {
    id,
    label: { show: true, size: 10, value: '', color: BLACK, bold: true, italic: false },
    text: { show: true, size: 11, value: '', color: BLACK, bold: true, italic: false },
    align: 'center',
    afterPt: 0
  }
}

/** Label, Text và chỗ giữ căn lề / khoảng cách của một dòng (có sẵn hoặc tự do); null nếu không có. */
export function lineParts(h: HeaderSettings, id: string): { label: HeaderText; text: HeaderText; style: { align: Align; afterPt: number } } | null {
  if (id === 'name') return { label: h.label, text: h.name, style: h.name }
  if (id === 'addr') return { label: h.addrLabel, text: h.addr, style: h.addr }
  if (id === 'contact') return { label: h.contactLabel, text: h.contact, style: h.contact }
  const f = h.extra.find((x) => x.id === id) ?? h.footer.find((x) => x.id === id)
  return f ? { label: f.label, text: f.text, style: f } : null
}

/** Hàng giải chưa chỉnh gì; ĐB to hơn cỡ chung 1 pt như phiếu bản bash. */
export const defaultRow = (k: PrizeKey): PrizeRowStyle => ({
  sizeDeltaPt: k === 'db' ? 1 : 0, numberColor: null, labelColor: null, bold: null, italic: null, underline: null, fill: null
})

export function defaultByWeekday(): Record<string, StationPick[]> {
  const out: Record<string, StationPick[]> = {}
  for (const [d, slugs] of Object.entries(SCHEDULE)) out[d] = slugs.map((slug) => ({ slug, on: true }))
  return out
}

/** Chữ đen, đậm: mặc định của mọi chữ trên phiếu. */
const ink = (): TextStyle => ({ color: BLACK, bold: true, italic: false })

const defaultRows = () => Object.fromEntries(PRIZES.map((k) => [k, defaultRow(k)])) as Record<PrizeKey, PrizeRowStyle>

export function defaultSettings(): Settings {
  return {
    version: SETTINGS_VERSION,
    header: {
      // Thông tin để trống: mỗi đại lý tự nhập ở màn Cài đặt. Căn lề, khoảng cách như phiếu bản bash.
      label: { show: true, size: 10, value: '', ...ink() },
      name: { show: true, size: 14, value: '', align: 'center', afterPt: 3, ...ink() },
      addr: { show: true, size: 10, value: '', align: 'center', afterPt: 0, ...ink() },
      contact: { show: true, size: 10, value: '', align: 'center', afterPt: 0, ...ink() },
      date: { size: 13, align: 'center', afterPt: 3, ...ink() },
      addrLabel: { show: true, size: 10, value: '', ...ink() },
      contactLabel: { show: true, size: 10, value: '', ...ink() },
      order: [...BUILTIN_LINES],
      extra: [],
      footer: []
    },
    stations: { mode: 'all', byWeekday: defaultByWeekday(), shortNames: {} },
    print: {
      paper: 'A4',
      format: 'pdf',
      cardWidthCm: 8,
      cardHeightCm: null,
      cardGapXCm: 0.6,
      cardGapYCm: 0.6,
      cardAlign: 'left',
      cardAlignY: 'top',
      textCell: { padXCm: 0.05, padYCm: 0.05, alignX: 'center', alignY: 'top' },
      numberCell: { padXCm: 0.3, padYCm: 0.05, alignX: 'right', alignY: 'center' },
      numberFontPt: null,
      font: DEFAULT_FONT,
      borderColor: BLACK,
      headRow: { labelSize: 12, color: BLACK, bold: true },
      prizeLabels: { size: 12, dbSize: 14, color: BLACK, bold: true },
      numbers: { color: BLACK, bold: true, italic: false, underline: false },
      rows: defaultRows()
    },
    output: { dir: '~/Documents/XSMN' },
    printer: { deviceName: null, silent: false, copies: 1 },
    autoRefresh: true
  }
}

// ---------------------------------------------------------------- chuẩn hoá

type Obj = Record<string, unknown>
const isObj = (v: unknown): v is Obj => typeof v === 'object' && v !== null && !Array.isArray(v)
const obj = (v: unknown): Obj => (isObj(v) ? v : {})
const bool = (v: unknown, def: boolean) => (typeof v === 'boolean' ? v : def)
const str = (v: unknown, def: string) => (typeof v === 'string' ? v : def)
const oneOf = <T extends string>(v: unknown, list: readonly T[], def: T): T =>
  list.includes(v as T) ? (v as T) : def

/** Đọc số (chấp nhận "0,6"), kẹp trong [min, max], làm tròn theo bước. */
export function toNumber(v: unknown, def: number, min: number, max: number, step = 0): number {
  const n = typeof v === 'number' ? v : typeof v === 'string' ? Number(v.trim().replace(',', '.')) : NaN
  if (!Number.isFinite(n) || (typeof v === 'string' && !v.trim())) return def
  const r = step ? Math.round(n / step) * step : n
  return Math.min(max, Math.max(min, Number(r.toFixed(4))))
}

/**
 * Tên font người dùng chọn hoặc nhập từ file .conf. Bỏ ký tự điều khiển và các ký tự có thể
 * phá CSS/HTML (< > { } ; " và gạch chéo ngược); rỗng thì dùng `def`.
 */
export function normalizeFontName(v: unknown, def: string): string {
  if (typeof v !== 'string') return def
  const name = v.replace(/[\u0000-\u001f\u007f<>{};"\\]/g, '').replace(/\s+/g, ' ').trim().slice(0, 80)
  return name || def
}

export function normalizeColor(v: unknown, def: string): string {
  if (typeof v !== 'string') return def
  const s = v.trim().replace(/^#/, '')
  return /^[0-9a-fA-F]{6}$/.test(s) ? s.toUpperCase() : def
}

/** Màu có thể bỏ trống (theo mức chung): null, "" hoặc không hợp lệ → null. */
const optColor = (v: unknown): string | null => (typeof v === 'string' && normalizeColor(v, '')) || null
const optBool = (v: unknown): boolean | null => (typeof v === 'boolean' ? v : null)

function textStyle(o: Obj, def: TextStyle): TextStyle {
  return { color: normalizeColor(o.color, def.color), bold: bool(o.bold, def.bold), italic: bool(o.italic, def.italic) }
}

const headerSize = (v: unknown, def: number) => toNumber(v, def, HEADER_SIZE_MIN, HEADER_SIZE_MAX, 0.5)

const headerAfter = (v: unknown, def: number) => toNumber(v, def, 0, HEADER_AFTER_MAX, 0.5)

function headerText(v: unknown, def: HeaderText): HeaderText {
  const o = obj(v)
  return { show: bool(o.show, def.show), size: headerSize(o.size, def.size), value: str(o.value, def.value), ...textStyle(o, def) }
}

function headerStyle(v: unknown, def: HeaderLineStyle): HeaderLineStyle {
  const o = obj(v)
  return { size: headerSize(o.size, def.size), align: oneOf(o.align, ALIGNS, def.align), afterPt: headerAfter(o.afterPt, def.afterPt) }
}

function headerLine(v: unknown, def: HeaderLineText): HeaderLineText {
  return { ...headerText(v, def), ...headerStyle(v, def) }
}

function freeLines(v: unknown, prefix: string): FreeLine[] {
  const out: FreeLine[] = []
  for (const item of (Array.isArray(v) ? v : []).slice(0, FREE_LINES_MAX)) {
    const o = obj(item)
    // id hỏng hoặc trùng: đặt theo vị trí (cố định, chuẩn hoá lại không đổi)
    let id = typeof o.id === 'string' && FREE_ID.test(o.id) && !BUILTIN_LINES.includes(o.id as BuiltinLine) ? o.id : ''
    if (!id || out.some((x) => x.id === id)) id = `${prefix}${out.length + 1}`
    const def = newFreeLine(id)
    out.push({
      id,
      label: headerText(o.label, def.label),
      text: headerText(o.text, def.text),
      align: oneOf(o.align, ALIGNS, def.align),
      afterPt: headerAfter(o.afterPt, def.afterPt)
    })
  }
  return out
}

/** Thứ tự dòng phần đầu: giữ id hợp lệ theo thứ tự đã lưu, thêm dòng còn thiếu vào cuối. */
function lineOrder(v: unknown, extra: FreeLine[]): string[] {
  const valid = [...BUILTIN_LINES, ...extra.map((x) => x.id)] as string[]
  const out = (Array.isArray(v) ? v : []).filter((id, i, a): id is string => valid.includes(id as string) && a.indexOf(id) === i)
  for (const id of valid) if (!out.includes(id)) out.push(id)
  return out
}

const labelSize = (v: unknown, def: number) => toNumber(v, def, LABEL_SIZE_MIN, LABEL_SIZE_MAX, 0.5)

function prizeRow(v: unknown, def: PrizeRowStyle): PrizeRowStyle {
  const o = obj(v)
  return {
    sizeDeltaPt: toNumber(o.sizeDeltaPt, def.sizeDeltaPt, ROW_DELTA_MIN, ROW_DELTA_MAX, 0.5),
    numberColor: 'numberColor' in o ? optColor(o.numberColor) : def.numberColor,
    labelColor: 'labelColor' in o ? optColor(o.labelColor) : def.labelColor,
    bold: optBool(o.bold),
    italic: optBool(o.italic),
    underline: optBool(o.underline),
    fill: optColor(o.fill)
  }
}

/** Địa chỉ kiểu cũ (phiếu tự thêm "ĐC: ") → chữ in nguyên văn. */
export const legacyAddrLine = (v: string) => {
  const a = v.trim()
  return a && `ĐC: ${a}`
}

/** Danh sách số kiểu cũ → một dòng như phiếu cũ in: "DĐ: …  DĐ: …". */
export function legacyContactLine(phones: unknown): string {
  return (Array.isArray(phones) ? phones : [])
    .filter((p): p is string => typeof p === 'string')
    .map((p) => p.trim())
    .filter(Boolean)
    .map((p) => `DĐ: ${p}`)
    .join('  ')
}

function cellStyle(v: unknown, legacy: Obj, def: CellStyle): CellStyle {
  const o = { ...legacy, ...obj(v) }
  return {
    padXCm: toNumber(o.padXCm, def.padXCm, 0, 2, 0.01),
    padYCm: toNumber(o.padYCm, def.padYCm, 0, 2, 0.01),
    alignX: oneOf(o.alignX, ALIGNS, def.alignX),
    alignY: oneOf(o.alignY, VALIGNS, def.alignY)
  }
}

/** Danh sách đài của một thứ: bỏ mã trùng/không quay hôm đó, thêm đài còn thiếu vào cuối (đang bật). */
export function normalizeDayPicks(weekday: number, raw: unknown): StationPick[] {
  const day = scheduleFor(weekday)
  const seen = new Set<string>()
  const out: StationPick[] = []
  for (const item of Array.isArray(raw) ? raw : []) {
    const o = obj(item)
    const slug = typeof o.slug === 'string' ? o.slug : ''
    if (!day.includes(slug) || seen.has(slug)) continue
    seen.add(slug)
    out.push({ slug, on: bool(o.on, true) })
  }
  for (const slug of day) if (!seen.has(slug)) out.push({ slug, on: true })
  return out
}

const pick = <T extends object, K extends keyof T>(o: T, ...keys: K[]): Pick<T, K> =>
  Object.fromEntries(keys.map((k) => [k, o[k]])) as Pick<T, K>

export function normalizeSettings(raw: unknown): Settings {
  const def = defaultSettings()
  const r = obj(raw)

  const p = obj(r.print)
  // Bản 2 trở về trước có 4 màu chung (print.colors): chữ đầu phiếu, chữ nhấn ("Giải", tên đài, tên giải,
  // số ĐB), viền, số. Dùng làm mặc định cho màu từng phần để phiếu in ra như cũ.
  const c = obj(p.colors)
  const legacy = {
    text: normalizeColor(c.text, BLACK), accent: normalizeColor(c.accent, BLACK),
    border: normalizeColor(c.border, BLACK), number: normalizeColor(c.number, BLACK)
  }
  const withInk = <T extends TextStyle>(d: T): T => ({ ...d, color: legacy.text })

  const h = obj(r.header)
  const header: HeaderSettings = {
    label: headerText(h.label, withInk(def.header.label)),
    name: headerLine(h.name, withInk(def.header.name)),
    addr: headerLine(h.addr, withInk(def.header.addr)),
    contact: headerLine(h.contact, withInk(def.header.contact)),
    // date.show của bản cũ bỏ qua: dòng thứ, ngày luôn in
    date: { ...headerStyle(h.date, def.header.date), ...textStyle(obj(h.date), withInk(def.header.date)) },
    addrLabel: headerText(h.addrLabel, withInk(def.header.addrLabel)),
    contactLabel: headerText(h.contactLabel, withInk(def.header.contactLabel)),
    order: [],
    extra: freeLines(h.extra, 'h'),
    footer: freeLines(h.footer, 'f')
  }
  // id dòng tự do không được trùng giữa đầu và cuối phiếu
  header.footer = header.footer.map((f, i) => (header.extra.some((x) => x.id === f.id) ? { ...f, id: `f${i + 1}x` } : f))
  header.order = lineOrder(h.order, header.extra)
  // Bản 1: thêm "ĐC: " vào địa chỉ, ghép danh sách số thành một dòng, để phiếu in ra như cũ
  if (typeof r.version !== 'number' || r.version < 2) {
    header.addr.value = legacyAddrLine(header.addr.value)
    const phones = obj(h.phones)
    header.contact = { ...headerLine(phones, withInk(def.header.contact)), value: legacyContactLine(phones.values) }
  }

  const s = obj(r.stations)
  const by = obj(s.byWeekday)
  const byWeekday: Record<string, StationPick[]> = {}
  for (let d = 0; d < 7; d++) byWeekday[d] = normalizeDayPicks(d, by[d])
  const shortNames: Record<string, string> = {}
  for (const [slug, name] of Object.entries(obj(s.shortNames))) {
    if (typeof name !== 'string' || !name.trim()) continue
    if (findStation(slug)?.short === name.trim()) continue
    shortNames[slug] = name.trim()
  }

  const fontPt = p.numberFontPt
  const cardH = p.cardHeightCm
  const cardWv = p.cardWidthCm
  const print: PrintSettings = {
    paper: oneOf(p.paper, PAPERS, def.print.paper),
    format: oneOf(p.format, FORMATS, def.print.format),
    // null = tự động; thiếu khoá (cài đặt cũ) thì về mặc định 8 cm
    cardWidthCm: cardWv === null || cardWv === '' ? null : toNumber(cardWv, def.print.cardWidthCm ?? 8, 2, 20),
    cardHeightCm: cardH === null || cardH === undefined || cardH === '' ? null : toNumber(cardH, 12, 4, 30, 0.1),
    // Bản cũ chỉ có một khoảng cách chung (cardGapCm): dùng cho cả hai chiều
    cardGapXCm: toNumber(p.cardGapXCm ?? p.cardGapCm, def.print.cardGapXCm, 0, 5),
    cardGapYCm: toNumber(p.cardGapYCm ?? p.cardGapCm, def.print.cardGapYCm, 0, 5),
    cardAlign: oneOf(p.cardAlign, CARD_POS_X, def.print.cardAlign),
    cardAlignY: oneOf(p.cardAlignY, CARD_POS_Y, def.print.cardAlignY),
    // Bản cũ có alignText / alignNumber / numberPadRightCm riêng lẻ: chuyển sang dạng ô
    textCell: cellStyle(p.textCell, { alignX: p.alignText }, def.print.textCell),
    numberCell: cellStyle(p.numberCell, { alignX: p.alignNumber, padXCm: p.numberPadRightCm }, def.print.numberCell),
    numberFontPt: fontPt === null || fontPt === undefined || fontPt === '' ? null : toNumber(fontPt, 13, 6, 30, 0.5),
    font: normalizeFontName(p.font, def.print.font),
    borderColor: normalizeColor(p.borderColor, legacy.border),
    headRow: {
      labelSize: labelSize(obj(p.headRow).labelSize, def.print.headRow.labelSize),
      ...pick(textStyle(obj(p.headRow), { ...def.print.headRow, italic: false, color: legacy.accent }), 'color', 'bold')
    },
    prizeLabels: {
      size: labelSize(obj(p.prizeLabels).size, def.print.prizeLabels.size),
      dbSize: labelSize(obj(p.prizeLabels).dbSize, def.print.prizeLabels.dbSize),
      ...pick(textStyle(obj(p.prizeLabels), { ...def.print.prizeLabels, italic: false, color: legacy.accent }), 'color', 'bold')
    },
    numbers: {
      ...textStyle(obj(p.numbers), { ...def.print.numbers, color: legacy.number }),
      underline: bool(obj(p.numbers).underline, def.print.numbers.underline)
    },
    rows: Object.fromEntries(PRIZES.map((k) => {
      const d = defaultRow(k)
      // Bản cũ: số ĐB in màu chữ nhấn
      if (k === 'db' && legacy.accent !== legacy.number) d.numberColor = legacy.accent
      return [k, prizeRow(obj(p.rows)[k], d)]
    })) as Record<PrizeKey, PrizeRowStyle>
  }

  const pr = obj(r.printer)
  return {
    version: SETTINGS_VERSION,
    header,
    stations: { mode: oneOf(s.mode, ['all', 'pick'] as const, def.stations.mode), byWeekday, shortNames },
    print,
    output: { dir: str(obj(r.output).dir, def.output.dir).trim() || def.output.dir },
    printer: {
      deviceName: typeof pr.deviceName === 'string' && pr.deviceName ? pr.deviceName : null,
      silent: bool(pr.silent, def.printer.silent),
      copies: toNumber(pr.copies, def.printer.copies, 1, 99, 1)
    },
    autoRefresh: bool(r.autoRefresh, def.autoRefresh)
  }
}
