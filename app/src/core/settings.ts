// Cài đặt (SPEC §5): mặc định, chuẩn hoá dữ liệu đọc từ JSON, nhập xsmn.conf của bản bash.
// Không đụng tới file: đọc/ghi nằm ở settings-file.ts để renderer import được module này.

import { SCHEDULE, findStation, scheduleFor } from './stations'
import { WEEKDAY_SHORT } from './dates'

export type Paper = 'A4' | 'A5' | 'A6'
export type OutputFormat = 'pdf' | 'docx' | 'both'
export type Align = 'left' | 'center' | 'right'

export const PAPERS: readonly Paper[] = ['A4', 'A5', 'A6']
export const FORMATS: readonly OutputFormat[] = ['pdf', 'docx', 'both']
export const ALIGNS: readonly Align[] = ['left', 'center', 'right']
export type VAlign = 'top' | 'center' | 'bottom'
export const VALIGNS: readonly VAlign[] = ['top', 'center', 'bottom']
/** Font phiếu mặc định (số đo của bản bash tính theo font này). */
export const DEFAULT_FONT = 'Times New Roman'

/** Chữ đầu phiếu: in đúng như đã gõ (phiếu không tự thêm "ĐC: " hay "DĐ: "). */
export interface HeaderText {
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
  date: HeaderLineStyle
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

export interface Colors {
  text: string
  accent: string
  border: string
  number: string
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
  cardAlign: Align
  /** Chữ trong bảng: "Giải", tên giải, tên đài. */
  textCell: CellStyle
  /** Số kết quả. */
  numberCell: CellStyle
  /** null = tự chọn cỡ lớn nhất vừa phiếu. */
  numberFontPt: number | null
  /** Tên họ font đã cài trên máy (font hệ thống, không nhúng sẵn). */
  font: string
  colors: Colors
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
 */
export const SETTINGS_VERSION = 2

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

export function defaultByWeekday(): Record<string, StationPick[]> {
  const out: Record<string, StationPick[]> = {}
  for (const [d, slugs] of Object.entries(SCHEDULE)) out[d] = slugs.map((slug) => ({ slug, on: true }))
  return out
}

export function defaultSettings(): Settings {
  return {
    version: SETTINGS_VERSION,
    header: {
      // Thông tin để trống: mỗi đại lý tự nhập ở màn Cài đặt. Căn lề, khoảng cách như phiếu bản bash.
      label: { show: true, size: 10, value: '' },
      name: { show: true, size: 14, value: '', align: 'center', afterPt: 3 },
      addr: { show: true, size: 10, value: '', align: 'center', afterPt: 0 },
      contact: { show: true, size: 10, value: '', align: 'center', afterPt: 0 },
      date: { size: 13, align: 'center', afterPt: 3 }
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
      textCell: { padXCm: 0.05, padYCm: 0.05, alignX: 'center', alignY: 'top' },
      numberCell: { padXCm: 0.3, padYCm: 0.05, alignX: 'right', alignY: 'center' },
      numberFontPt: null,
      font: DEFAULT_FONT,
      colors: { text: '000000', accent: '000000', border: '000000', number: '000000' }
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

const headerSize = (v: unknown, def: number) => toNumber(v, def, HEADER_SIZE_MIN, HEADER_SIZE_MAX, 0.5)

const headerAfter = (v: unknown, def: number) => toNumber(v, def, 0, HEADER_AFTER_MAX, 0.5)

function headerText(v: unknown, def: HeaderText): HeaderText {
  const o = obj(v)
  return { show: bool(o.show, def.show), size: headerSize(o.size, def.size), value: str(o.value, def.value) }
}

function headerStyle(v: unknown, def: HeaderLineStyle): HeaderLineStyle {
  const o = obj(v)
  return { size: headerSize(o.size, def.size), align: oneOf(o.align, ALIGNS, def.align), afterPt: headerAfter(o.afterPt, def.afterPt) }
}

function headerLine(v: unknown, def: HeaderLineText): HeaderLineText {
  return { ...headerText(v, def), ...headerStyle(v, def) }
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

export function normalizeSettings(raw: unknown): Settings {
  const def = defaultSettings()
  const r = obj(raw)

  const h = obj(r.header)
  const header: HeaderSettings = {
    label: headerText(h.label, def.header.label),
    name: headerLine(h.name, def.header.name),
    addr: headerLine(h.addr, def.header.addr),
    contact: headerLine(h.contact, def.header.contact),
    // date.show của bản cũ bỏ qua: dòng thứ, ngày luôn in
    date: headerStyle(h.date, def.header.date)
  }
  // Bản cũ: thêm "ĐC: " vào địa chỉ, ghép danh sách số thành một dòng, để phiếu in ra như cũ
  if (typeof r.version !== 'number' || r.version < SETTINGS_VERSION) {
    header.addr.value = legacyAddrLine(header.addr.value)
    const phones = obj(h.phones)
    header.contact = { ...headerLine(phones, def.header.contact), value: legacyContactLine(phones.values) }
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

  const p = obj(r.print)
  const c = obj(p.colors)
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
    cardAlign: oneOf(p.cardAlign, ALIGNS, def.print.cardAlign),
    // Bản cũ có alignText / alignNumber / numberPadRightCm riêng lẻ: chuyển sang dạng ô
    textCell: cellStyle(p.textCell, { alignX: p.alignText }, def.print.textCell),
    numberCell: cellStyle(p.numberCell, { alignX: p.alignNumber, padXCm: p.numberPadRightCm }, def.print.numberCell),
    numberFontPt: fontPt === null || fontPt === undefined || fontPt === '' ? null : toNumber(fontPt, 13, 6, 30, 0.5),
    font: normalizeFontName(p.font, def.print.font),
    colors: {
      text: normalizeColor(c.text, def.print.colors.text),
      accent: normalizeColor(c.accent, def.print.colors.accent),
      border: normalizeColor(c.border, def.print.colors.border),
      number: normalizeColor(c.number, def.print.colors.number)
    }
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
