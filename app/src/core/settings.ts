// Cài đặt (SPEC §5): mặc định, chuẩn hoá dữ liệu đọc từ JSON, nhập xsmn.conf của bản bash.
// Không đụng tới file: đọc/ghi nằm ở settings-file.ts để renderer import được module này.

import { SCHEDULE, findStation, scheduleFor } from './stations'
import { WEEKDAY_SHORT } from './dates'

export type Paper = 'A4' | 'A5' | 'A6'
export type OutputFormat = 'pdf' | 'docx' | 'both'
export type Align = 'left' | 'center' | 'right'
export type FontName = 'Times New Roman' | 'Arial'

export const PAPERS: readonly Paper[] = ['A4', 'A5', 'A6']
export const FORMATS: readonly OutputFormat[] = ['pdf', 'docx', 'both']
export const ALIGNS: readonly Align[] = ['left', 'center', 'right']
export type VAlign = 'top' | 'center' | 'bottom'
export const VALIGNS: readonly VAlign[] = ['top', 'center', 'bottom']
export const FONTS: readonly FontName[] = ['Times New Roman', 'Arial']

export interface HeaderText {
  show: boolean
  size: number
  value: string
}

export interface HeaderSettings {
  label: HeaderText
  name: HeaderText
  addr: HeaderText
  phones: { show: boolean; size: number; values: string[] }
  date: { show: boolean; size: number }
}

export type HeaderKey = keyof HeaderSettings

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
  font: FontName
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

export interface Settings {
  version: 1
  header: HeaderSettings
  stations: StationSettings
  print: PrintSettings
  output: { dir: string }
  printer: PrinterSettings
  autoRefresh: boolean
}

export const HEADER_SIZE_MIN = 5
export const HEADER_SIZE_MAX = 30

export function defaultByWeekday(): Record<string, StationPick[]> {
  const out: Record<string, StationPick[]> = {}
  for (const [d, slugs] of Object.entries(SCHEDULE)) out[d] = slugs.map((slug) => ({ slug, on: true }))
  return out
}

export function defaultSettings(): Settings {
  return {
    version: 1,
    header: {
      // Thông tin đại lý để trống: mỗi đại lý tự nhập ở màn Cài đặt
      label: { show: true, size: 10, value: '' },
      name: { show: true, size: 14, value: '' },
      addr: { show: true, size: 10, value: '' },
      phones: { show: true, size: 10, values: [] },
      date: { show: true, size: 13 },
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
      font: 'Times New Roman',
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

export function normalizeColor(v: unknown, def: string): string {
  if (typeof v !== 'string') return def
  const s = v.trim().replace(/^#/, '')
  return /^[0-9a-fA-F]{6}$/.test(s) ? s.toUpperCase() : def
}

const headerSize = (v: unknown, def: number) => toNumber(v, def, HEADER_SIZE_MIN, HEADER_SIZE_MAX, 0.5)

function headerText(v: unknown, def: HeaderText): HeaderText {
  const o = obj(v)
  return { show: bool(o.show, def.show), size: headerSize(o.size, def.size), value: str(o.value, def.value) }
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
  const phones = obj(h.phones)
  const date = obj(h.date)
  const header: HeaderSettings = {
    label: headerText(h.label, def.header.label),
    name: headerText(h.name, def.header.name),
    addr: headerText(h.addr, def.header.addr),
    phones: {
      show: bool(phones.show, def.header.phones.show),
      size: headerSize(phones.size, def.header.phones.size),
      values: Array.isArray(phones.values)
        ? phones.values.filter((p): p is string => typeof p === 'string')
        : def.header.phones.values
    },
    date: { show: bool(date.show, def.header.date.show), size: headerSize(date.size, def.header.date.size) }
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
    font: oneOf(p.font, FONTS, def.print.font),
    colors: {
      text: normalizeColor(c.text, def.print.colors.text),
      accent: normalizeColor(c.accent, def.print.colors.accent),
      border: normalizeColor(c.border, def.print.colors.border),
      number: normalizeColor(c.number, def.print.colors.number)
    }
  }

  const pr = obj(r.printer)
  return {
    version: 1,
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
