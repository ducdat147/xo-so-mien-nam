// Parse trang kết quả minhngoc.net.vn (SPEC §3).
// HTML gốc thiếu </td> giữa các cột đài; htmlparser2 tự đóng ô cũ khi gặp <td> mới nên vẫn đọc đúng.
// Dùng cheerio/slim (chỉ htmlparser2): bản đầy đủ kéo theo undici, không chạy được trên Node 16 của bản Win7.

import { load } from 'cheerio/slim'
import type { DateVN } from './dates'
import { formatDate } from './dates'
import { PRIZES, PRIZE_COUNT, NUMBERS_PER_STATION, emptyPrizes, type Prizes } from './stations'

export type ResultStatus = 'ok' | 'partial' | 'none' | 'error'
/** Loại lỗi khi status = error: mất mạng | máy chủ minhngoc gặp sự cố | trang đổi cấu trúc. */
export type ErrorKind = 'offline' | 'server' | 'parse'

export interface StationResult {
  slug: string
  /** Tên trên web, ví dụ "TP. HCM". */
  name: string
  /** Mã vé, ví dụ "XSHCM - 10E2". */
  code: string
  prizes: Prizes
}

export interface DayResult {
  /** Ngày yêu cầu, DD-MM-YYYY. */
  date: string
  status: ResultStatus
  /** Ngày ghi trên bảng đầu tiên của trang (DD/MM/YYYY), null nếu không đọc được. */
  pageDate: string | null
  stations: StationResult[]
  /** Số con số đã có / tổng số cần có (để vẽ thanh tiến độ khi đang quay). */
  filled: number
  total: number
  message?: string
  errorKind?: ErrorKind
}

const DRAW_HINT = 'XSMN quay khoảng 16h15–16h35.'

export function stationFilled(st: StationResult): number {
  return PRIZES.reduce((n, k) => n + Math.min(st.prizes[k].length, PRIZE_COUNT[k]), 0)
}

export function isComplete(st: StationResult): boolean {
  return PRIZES.every((k) => st.prizes[k].length >= PRIZE_COUNT[k])
}

export function slugFromHref(href: string | undefined, name: string): string {
  const m = href?.match(/\/([^/?#]+?)(?:\.html?)?(?:[?#].*)?$/)
  if (m) return m[1].toLowerCase()
  return name
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/đ/gi, 'd')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
}

const clean = (s: string) => s.replace(/\s+/g, ' ').trim()

export function errorResult(date: DateVN, message: string, errorKind: ErrorKind = 'parse'): DayResult {
  return { date: formatDate(date), status: 'error', pageDate: null, stations: [], filled: 0, total: 0, message, errorKind }
}

export function parseResults(html: string, date: DateVN): DayResult {
  const $ = load(html)
  const box = $('table.bkqmiennam').first()
  if (!box.length) {
    return errorResult(date, 'Trang minhngoc.net.vn không có bảng kết quả như thường lệ (có thể web đang bảo trì hoặc đã đổi giao diện).')
  }

  const want = formatDate(date, '/')
  const pageDate = clean(box.find('td.ngay').first().text()) || null
  if (pageDate !== want) {
    return {
      date: formatDate(date),
      status: 'none',
      pageDate,
      stations: [],
      filled: 0,
      total: 0,
      message: `Chưa có kết quả ngày ${want}` + (pageDate ? ` (bảng mới nhất trên web là ${pageDate}).` : '.') + ` ${DRAW_HINT}`
    }
  }

  const stations: StationResult[] = []
  box.find('table.rightcl').each((_, el) => {
    const t = $(el)
    const tinh = t.find('td.tinh').first()
    const name = clean(tinh.text())
    const slug = slugFromHref(tinh.find('a').attr('href'), name)
    const prizes = emptyPrizes()
    for (const k of PRIZES) {
      const cell = t.find(`td.giai${k}`).first()
      const divs = cell.find('div')
      const nums: string[] = []
      if (divs.length) {
        divs.each((_, d) => {
          const digits = ($(d).text().match(/\d+/g) ?? []).join('')
          if (digits) nums.push(digits)
        })
      } else {
        nums.push(...(cell.text().match(/\d+/g) ?? []))
      }
      prizes[k] = nums
    }
    stations.push({ slug, name, code: clean(t.find('td.matinh').first().text()), prizes })
  })

  if (!stations.length) {
    return errorResult(date, 'Không đọc được danh sách đài trong trang.')
  }

  const total = stations.length * NUMBERS_PER_STATION
  const filled = stations.reduce((n, st) => n + stationFilled(st), 0)
  const complete = stations.every(isComplete)
  return {
    date: formatDate(date),
    status: complete ? 'ok' : 'partial',
    pageDate,
    stations,
    filled,
    total,
    message: complete ? undefined : 'Đang quay trực tiếp, kết quả chưa đầy đủ.'
  }
}
