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
  fax: HeaderText
  phones: { show: boolean; size: number; values: string[] }
  date: { show: boolean; size: number }
  note: HeaderText
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
  cardWidthCm: number
  cardGapCm: number
  cardAlign: Align
  alignText: Align
  alignNumber: Align
  numberPadRightCm: number
  /** null = tự chọn cỡ lớn nhất vừa phiếu. */
  numberFontPt: number | null
  font: FontName
  colors: Colors
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
      fax: { show: true, size: 10, value: '' },
      phones: { show: true, size: 10, values: [] },
      date: { show: true, size: 13 },
      note: { show: false, size: 10, value: '' }
    },
    stations: { mode: 'all', byWeekday: defaultByWeekday(), shortNames: {} },
    print: {
      paper: 'A4',
      format: 'pdf',
      cardWidthCm: 8,
      cardGapCm: 0.6,
      cardAlign: 'left',
      alignText: 'center',
      alignNumber: 'right',
      numberPadRightCm: 0.3,
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
    fax: headerText(h.fax, def.header.fax),
    phones: {
      show: bool(phones.show, def.header.phones.show),
      size: headerSize(phones.size, def.header.phones.size),
      values: Array.isArray(phones.values)
        ? phones.values.filter((p): p is string => typeof p === 'string')
        : def.header.phones.values
    },
    date: { show: bool(date.show, def.header.date.show), size: headerSize(date.size, def.header.date.size) },
    note: headerText(h.note, def.header.note)
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
  const print: PrintSettings = {
    paper: oneOf(p.paper, PAPERS, def.print.paper),
    format: oneOf(p.format, FORMATS, def.print.format),
    cardWidthCm: toNumber(p.cardWidthCm, def.print.cardWidthCm, 2, 20),
    cardGapCm: toNumber(p.cardGapCm, def.print.cardGapCm, 0, 5),
    cardAlign: oneOf(p.cardAlign, ALIGNS, def.print.cardAlign),
    alignText: oneOf(p.alignText, ALIGNS, def.print.alignText),
    alignNumber: oneOf(p.alignNumber, ALIGNS, def.print.alignNumber),
    numberPadRightCm: toNumber(p.numberPadRightCm, def.print.numberPadRightCm, 0, 3),
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

// ---------------------------------------------------------------- nhập xsmn.conf

/** Đọc file KEY=VALUE giống load_config của bản bash. Trả về theo thứ tự xuất hiện (khoá sau ghi đè khoá trước). */
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
    if ((q === '"' || q === "'") && val.length >= 2 && val.endsWith(q)) val = val.slice(1, -1)
    else val = val.replace(/\s#.*$/, '').trim()
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

export function importConf(text: string, base: Settings = defaultSettings()): ConfImport {
  const s = normalizeSettings(JSON.parse(JSON.stringify(base)))
  const conf = parseConf(text)
  const ignored: string[] = []
  let imported = 0
  const ok = () => { imported++ }
  const bad = (k: string) => { ignored.push(k) }

  const setText = (key: keyof Pick<HeaderSettings, 'label' | 'name' | 'addr' | 'fax' | 'note'>, v: string) => {
    s.header[key].value = v
    s.header[key].show = true
  }
  const setNum = (k: string, v: string, min: number, max: number, apply: (n: number) => void) => {
    const n = toNumber(v, NaN, -Infinity, Infinity)
    if (Number.isNaN(n) || n < min || n > max) return bad(k)
    apply(n)
    ok()
  }
  const setAlign = (k: string, v: string, apply: (a: Align) => void) => {
    const a = v.toLowerCase() as Align
    if (!ALIGNS.includes(a)) return bad(k)
    apply(a)
    ok()
  }

  const stationLists = new Map<number | 'all', string[]>()

  for (const [key, v] of conf) {
    // Bản bash coi giá trị rỗng như chưa khai báo
    if (!v) continue
    const dayKey = key.match(/^STATIONS_(T[2-7]|CN)$/)
    if (key === 'STATIONS' || dayKey) {
      const wd = dayKey ? WEEKDAY_SHORT.indexOf(dayKey[1] as (typeof WEEKDAY_SHORT)[number]) : 'all'
      stationLists.set(wd, splitList(v))
      ok()
      continue
    }
    if (key.startsWith('NAME_')) {
      // bản bash chấp nhận cả NAME_tp-hcm lẫn NAME_tp_hcm
      const slug = key.slice(5).toLowerCase().replace(/_/g, '-')
      if (findStation(slug)?.short === v) delete s.stations.shortNames[slug]
      else s.stations.shortNames[slug] = v
      ok()
      continue
    }
    switch (key) {
      case 'AGENT_LABEL': setText('label', v); ok(); break
      case 'AGENT_NAME': setText('name', v); ok(); break
      case 'AGENT_ADDRESS': setText('addr', v); ok(); break
      case 'AGENT_FAX': setText('fax', v); ok(); break
      case 'NOTE': setText('note', v); ok(); break
      case 'AGENT_PHONES':
        s.header.phones.values = v.split('|').map((p) => p.trim()).filter(Boolean)
        s.header.phones.show = true
        ok()
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
      case 'CARD_WIDTH_CM': setNum(key, v, 2, 20, (n) => { s.print.cardWidthCm = n }); break
      case 'CARD_GAP_CM': setNum(key, v, 0, 5, (n) => { s.print.cardGapCm = n }); break
      case 'NUMBER_PAD_RIGHT_CM': setNum(key, v, 0, 3, (n) => { s.print.numberPadRightCm = n }); break
      case 'NUMBER_FONT_PT': setNum(key, v, 6, 30, (n) => { s.print.numberFontPt = n }); break
      case 'CARD_ALIGN': setAlign(key, v, (a) => { s.print.cardAlign = a }); break
      case 'ALIGN_TEXT': setAlign(key, v, (a) => { s.print.alignText = a }); break
      case 'ALIGN_NUMBER': setAlign(key, v, (a) => { s.print.alignNumber = a }); break
      case 'FONT':
        s.print.font = /arial/i.test(v) ? 'Arial' : 'Times New Roman'
        ok()
        break
      case 'COLOR_TEXT': case 'COLOR_ACCENT': case 'COLOR_BORDER': case 'COLOR_NUMBER': {
        const c = normalizeColor(v, '')
        if (!c) { bad(key); break }
        s.print.colors[key.slice(6).toLowerCase() as keyof Colors] = c
        ok()
        break
      }
      case 'OUTPUT_DIR': s.output.dir = v; ok(); break
      default: bad(key)
    }
  }

  // STATIONS_Tx ưu tiên hơn STATIONS; giữ thứ tự trên web, đài trong danh sách thì bật.
  if (stationLists.size) {
    s.stations.mode = 'pick'
    for (let d = 0; d < 7; d++) {
      const want = stationLists.get(d) ?? stationLists.get('all')
      s.stations.byWeekday[d] = scheduleFor(d).map((slug) => ({ slug, on: want ? want.includes(slug) : true }))
    }
  }

  return { settings: normalizeSettings(s), imported, ignored }
}
