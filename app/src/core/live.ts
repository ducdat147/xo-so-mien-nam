// Kết quả trực tiếp của minhngoc lúc đang quay (SPEC §3). Trang xo-so-truc-tiep/mien-nam.html
// hỏi file js_m1.js trên các máy chủ server-liveNN khoảng 1 giây một lần. File chỉ vài trăm byte:
//   kqxs.mn={run:1,tinh:"13,14,15",ntime:1793264429,delay:1200,kq:{13:{lv:"10K5",8:"15",…,0:"******"},…}};
// run = 1 khi đang quay; tinh = mã tỉnh theo thứ tự trên web; ntime = giờ mở phiên (giây Unix);
// kq[mã tỉnh][8…0] = giải Tám … ĐB (0 = ĐB), "+++++" là ô đang quay, "*****" là ô chưa tới lượt.
// Mã tỉnh (13 = Tây Ninh…) chỉ tra được trong HTML trang trực tiếp (span#loaive_13 nằm trong cột đài).
// Đây là mã tải từ mạng về: không eval, chuyển object literal sang JSON rồi JSON.parse.

import { load } from 'cheerio/slim'
import { formatDate, sameDate, todayVN, type DateVN } from './dates'
import { slugFromHref, stationFilled, isComplete, type DayResult, type StationResult } from './parse'
import { fetchText, type FetchPageOptions } from './source'
import { NUMBERS_PER_STATION, emptyPrizes, type PrizeKey } from './stations'

export const LIVE_PAGE_URL = 'https://www.minhngoc.net.vn/xo-so-truc-tiep/mien-nam.html'
export const LIVE_FEED_PATH = '/xstt/js_m1.js'
/** Máy chủ trực tiếp thấy trên trang ngày 29-10-2026; nạp được trang trực tiếp thì dùng danh sách mới. */
export const LIVE_HOSTS: readonly string[] = [
  'https://server-live20.minhngoc.net.vn',
  'https://server-live30.minhngoc.net.vn',
  'https://server-live21.minhngoc.net.vn',
  'https://server-live36.minhngoc.net.vn'
]

/** Khoá giải trong feed (0 = ĐB) → khoá giải của app. */
const FEED_PRIZE: Readonly<Record<string, PrizeKey>> = {
  8: '8', 7: '7', 6: '6', 5: '5', 4: '4', 3: '3', 2: '2', 1: '1', 0: 'db'
}

export interface LiveFeed {
  /** Đang quay (run = 1). */
  running: boolean
  /** Ngày của phiên quay, tính từ ntime theo giờ VN. */
  date: DateVN
  /** Mã tỉnh của minhngoc, đúng thứ tự trên web. */
  ids: string[]
  /** Theo mã tỉnh: ký hiệu vé (lv) và các số đã quay xong. */
  stations: Record<string, Pick<StationResult, 'code' | 'prizes'>>
}

export interface LiveStation {
  slug: string
  name: string
}

export interface LiveIndex {
  /** Mã tỉnh → đài. */
  stations: Map<string, LiveStation>
  hosts: string[]
}

/** Cắt object literal bắt đầu ở `from` (dấu `{`), bỏ qua ngoặc nằm trong chuỗi. */
function objectAt(src: string, from: number): string | null {
  let depth = 0
  for (let i = from; i < src.length; i++) {
    const c = src[i]
    if (c === '"') {
      for (i++; i < src.length && src[i] !== '"'; i++) if (src[i] === '\\') i++
    } else if (c === '{') {
      depth++
    } else if (c === '}' && --depth === 0) {
      return src.slice(from, i + 1)
    }
  }
  return null
}

/** `{run:1,kq:{13:{lv:"10K5"}}}` → JSON: thêm ngoặc kép cho khoá, giữ nguyên chuỗi. */
function literalToJson(lit: string): unknown {
  const json = lit.replace(/"(?:[^"\\]|\\.)*"|([{,]\s*)([A-Za-z_$][\w$]*|\d+)(?=\s*:)/g, (m, pre, key) =>
    key === undefined ? m : `${pre}"${key}"`
  )
  try {
    return JSON.parse(json)
  } catch {
    return null
  }
}

const fullDigits = (v: unknown): v is string => typeof v === 'string' && /^\d+$/.test(v)

/** Đọc file js_m1.js; null nếu không có phần miền Nam hoặc sai cấu trúc. */
export function parseLiveFeed(js: string): LiveFeed | null {
  const at = js.search(/kqxs\.mn\s*=\s*\{/)
  if (at < 0) return null
  const lit = objectAt(js, js.indexOf('{', at))
  const raw = lit ? (literalToJson(lit) as Record<string, unknown> | null) : null
  if (!raw || typeof raw.tinh !== 'string' || typeof raw.ntime !== 'number' || !raw.kq || typeof raw.kq !== 'object') {
    return null
  }
  const kq = raw.kq as Record<string, Record<string, unknown> | undefined>
  const ids = raw.tinh.split(',').map((s) => s.trim()).filter(Boolean)
  const stations: LiveFeed['stations'] = {}
  for (const id of ids) {
    const st = kq[id]
    if (!st || typeof st !== 'object') return null
    const prizes = emptyPrizes()
    for (const [k, prize] of Object.entries(FEED_PRIZE)) {
      const v = st[k]
      prizes[prize] = (Array.isArray(v) ? v : [v]).filter(fullDigits)
    }
    stations[id] = { code: typeof st.lv === 'string' ? st.lv.trim() : '', prizes }
  }
  return { running: raw.run === 1, date: todayVN(new Date(raw.ntime * 1000)), ids, stations }
}

/** Đọc trang trực tiếp: mã tỉnh của từng cột đài và danh sách máy chủ trực tiếp. */
export function parseLivePage(html: string): LiveIndex {
  const $ = load(html)
  const stations = new Map<string, LiveStation>()
  $('table.bkqmiennam').first().find('table.rightcl').each((_, el) => {
    const t = $(el)
    const id = t.find('[id^="loaive_"]').first().attr('id')?.slice('loaive_'.length)
    const tinh = t.find('td.tinh').first()
    const name = tinh.text().replace(/\s+/g, ' ').trim()
    if (id && name) stations.set(id, { slug: slugFromHref(tinh.find('a').attr('href'), name), name })
  })
  const list = html.match(/rawDomainStr\s*=\s*"([^"]*)"/)?.[1] ?? ''
  const hosts = [...new Set(list.split(',').map((s) => s.trim()))]
    .filter((h) => /^https:\/\/[a-z0-9-]+\.minhngoc\.net\.vn$/.test(h))
  return { stations, hosts }
}

/** Ghép feed với bảng mã tỉnh; null nếu còn mã tỉnh chưa biết là đài nào. */
export function liveResult(feed: LiveFeed, index: ReadonlyMap<string, LiveStation>): DayResult | null {
  const stations: StationResult[] = []
  for (const id of feed.ids) {
    const st = index.get(id)
    if (!st) return null
    stations.push({ slug: st.slug, name: st.name, ...feed.stations[id] })
  }
  const total = stations.length * NUMBERS_PER_STATION
  const filled = stations.reduce((n, st) => n + stationFilled(st), 0)
  const complete = stations.length > 0 && stations.every(isComplete)
  return {
    date: formatDate(feed.date),
    status: complete ? 'ok' : 'partial',
    pageDate: formatDate(feed.date, '/'),
    stations,
    filled,
    total,
    message: complete ? undefined : 'Đang quay trực tiếp, kết quả chưa đầy đủ.'
  }
}

/**
 * Nguồn trực tiếp, giữ bảng mã tỉnh và máy chủ đang dùng giữa các lần hỏi.
 * Mỗi lần hỏi chỉ tải js_m1.js; trang trực tiếp (~230 KB) chỉ tải khi gặp mã tỉnh lạ
 * hoặc mọi máy chủ trong danh sách đều lỗi.
 */
export class LiveSource {
  private stations = new Map<string, LiveStation>()
  private hosts: string[] = [...LIVE_HOSTS]
  /** Đã nạp trang trực tiếp cho bộ mã tỉnh này (tránh nạp lại mỗi lần hỏi). */
  private indexedFor: string | null = null
  /** Đang nạp trang trực tiếp (để lần hỏi chạy song song chờ chung, không bỏ qua bảng trực tiếp). */
  private indexing: Promise<boolean> | null = null

  /** Kết quả trực tiếp của `date`; null nếu feed không phải phiên của ngày đó hoặc không đọc được. */
  async load(date: DateVN, opts: FetchPageOptions = {}): Promise<{ running: boolean; result: DayResult } | null> {
    let js = await this.fetchFeed(opts)
    // Mọi máy chủ quen đều lỗi: có thể minhngoc đã đổi máy chủ, nạp trang trực tiếp lấy danh sách mới (một lần)
    if (js === null && this.indexedFor === null && (await this.index('', opts))) js = await this.fetchFeed(opts)
    // Hết phiên thì feed chỉ còn {run:0,…} không có kq (chụp 16h38) → null
    const feed = js === null ? null : parseLiveFeed(js)
    if (!feed || !sameDate(feed.date, date)) return null
    if (feed.ids.some((id) => !this.stations.has(id))) {
      // Mở app thì hai lần lấy chạy song song: lần sau chờ lần đầu tra xong mã tỉnh
      const key = feed.ids.join(',')
      if (this.indexing) await this.indexing
      else if (this.indexedFor !== key) await this.index(key, opts)
    }
    const result = liveResult(feed, this.stations)
    return result && { running: feed.running, result }
  }

  /**
   * Như trang web: dùng một máy chủ, tải lỗi thì chuyển nó xuống cuối và hỏi máy kế tiếp.
   * Chờ ngắn (trang web chờ 5 giây): máy chủ treo thì lần lấy đầu không bị đứng lâu trước khi về trang thường.
   * null = mọi máy đã hỏi đều lỗi.
   */
  private async fetchFeed(opts: FetchPageOptions): Promise<string | null> {
    for (let i = 0; i < Math.min(2, this.hosts.length); i++) {
      try {
        return await fetchText(this.hosts[0] + LIVE_FEED_PATH, { ...opts, retries: 0, timeoutMs: 4000 })
      } catch (e) {
        if (opts.signal?.aborted) throw e
        this.hosts.push(this.hosts.shift()!)
      }
    }
    return null
  }

  private index(key: string, opts: FetchPageOptions): Promise<boolean> {
    this.indexedFor = key
    this.indexing = this.loadIndex(opts).finally(() => { this.indexing = null })
    return this.indexing
  }

  private async loadIndex(opts: FetchPageOptions): Promise<boolean> {
    try {
      const { stations, hosts } = parseLivePage(await fetchText(LIVE_PAGE_URL, { ...opts, retries: 0, timeoutMs: 10000 }))
      stations.forEach((st, id) => this.stations.set(id, st))
      // Máy đang chạy tốt (đầu danh sách) giữ ở đầu nếu vẫn còn trong danh sách mới
      const cur = this.hosts[0]
      if (hosts.length) this.hosts = hosts.includes(cur) ? [cur, ...hosts.filter((h) => h !== cur)] : hosts
      return true
    } catch (e) {
      if (opts.signal?.aborted) throw e
      return false
    }
  }
}
