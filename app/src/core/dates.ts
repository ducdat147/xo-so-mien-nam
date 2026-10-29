// Ngày theo giờ Việt Nam. Mọi phép tính ngày/thứ dùng UTC để không phụ thuộc múi giờ máy.

export interface DateVN {
  y: number
  m: number // 1–12
  d: number
}

/** Việt Nam là UTC+7 quanh năm, không có giờ mùa hè. */
const VN_OFFSET_MS = 7 * 3600 * 1000
const DAY_MS = 24 * 3600 * 1000

export const WEEKDAY_NAMES = ['Chủ Nhật', 'Thứ Hai', 'Thứ Ba', 'Thứ Tư', 'Thứ Năm', 'Thứ Sáu', 'Thứ Bảy'] as const
export const WEEKDAY_SHORT = ['CN', 'T2', 'T3', 'T4', 'T5', 'T6', 'T7'] as const

export function todayVN(now: Date = new Date()): DateVN {
  const t = new Date(now.getTime() + VN_OFFSET_MS)
  return { y: t.getUTCFullYear(), m: t.getUTCMonth() + 1, d: t.getUTCDate() }
}

/** Giờ bắt đầu quay XSMN (giờ VN). */
export const DRAW_START_HOUR = 16

/** Đang trước 16h giờ VN: hôm nay chưa quay. */
export function isBeforeDraw(now: Date = new Date()): boolean {
  return new Date(now.getTime() + VN_OFFSET_MS).getUTCHours() < DRAW_START_HOUR
}

/** Hết giờ hỏi bảng trực tiếp (giờ VN). Phiên quay thường 16h07–16h35. */
export const LIVE_END_HOUR = 17

/** Trong khung 16h–17h giờ VN: chỉ lúc này mới hỏi bảng trực tiếp của minhngoc. */
export function isLiveWindow(now: Date = new Date()): boolean {
  const h = new Date(now.getTime() + VN_OFFSET_MS).getUTCHours()
  return h >= DRAW_START_HOUR && h < LIVE_END_HOUR
}

/** Ngày mở sẵn khi vào app: trước 16h chưa có kết quả hôm nay nên lấy ngày hôm qua. */
export function defaultDrawDate(now: Date = new Date()): DateVN {
  const today = todayVN(now)
  return isBeforeDraw(now) ? addDays(today, -1) : today
}

function toUtcMs(date: DateVN): number {
  return Date.UTC(date.y, date.m - 1, date.d)
}

function fromUtcMs(ms: number): DateVN {
  const t = new Date(ms)
  return { y: t.getUTCFullYear(), m: t.getUTCMonth() + 1, d: t.getUTCDate() }
}

export function addDays(date: DateVN, n: number): DateVN {
  return fromUtcMs(toUtcMs(date) + n * DAY_MS)
}

/** 0 = Chủ Nhật … 6 = Thứ Bảy */
export function weekday(date: DateVN): number {
  return new Date(toUtcMs(date)).getUTCDay()
}

export function isValidDate(y: number, m: number, d: number): boolean {
  if (!Number.isInteger(y) || !Number.isInteger(m) || !Number.isInteger(d)) return false
  if (y < 1900 || y > 9999 || m < 1 || m > 12 || d < 1) return false
  const t = new Date(Date.UTC(y, m - 1, d))
  return t.getUTCMonth() === m - 1 && t.getUTCDate() === d
}

/** Nhận DD-MM-YYYY, DD/MM/YYYY, DD.MM.YYYY hoặc YYYY-MM-DD. */
export function parseDate(input: string): DateVN | null {
  const parts = input.trim().split(/[-/.]/)
  if (parts.length !== 3 || parts.some((p) => !/^\d+$/.test(p))) return null
  let [a, b, c] = parts
  if (a.length === 4) [a, c] = [c, a]
  if (c.length !== 4) return null
  const date = { y: Number(c), m: Number(b), d: Number(a) }
  return isValidDate(date.y, date.m, date.d) ? date : null
}

const pad2 = (n: number) => String(n).padStart(2, '0')

/** DD-MM-YYYY (hoặc dấu ngăn khác). */
export function formatDate(date: DateVN, sep = '-'): string {
  return `${pad2(date.d)}${sep}${pad2(date.m)}${sep}${date.y}`
}

/** YYYY-MM-DD, dùng cho <input type="date">. */
export function toIsoDate(date: DateVN): string {
  return `${date.y}-${pad2(date.m)}-${pad2(date.d)}`
}

export function sameDate(a: DateVN, b: DateVN): boolean {
  return a.y === b.y && a.m === b.m && a.d === b.d
}

export function compareDate(a: DateVN, b: DateVN): number {
  return toUtcMs(a) - toUtcMs(b)
}

export function weekdayName(date: DateVN): string {
  return WEEKDAY_NAMES[weekday(date)]
}

/** Dòng ngày trên phiếu: "Thứ Hai (26-10-2026)". */
export function sheetTitle(date: DateVN): string {
  return `${weekdayName(date)} (${formatDate(date)})`
}
