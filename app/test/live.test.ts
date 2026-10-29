import { afterEach, describe, expect, it, vi } from 'vitest'
import { LIVE_FEED_PATH, LIVE_HOSTS, LIVE_PAGE_URL, LiveSource, liveResult, parseLiveFeed, parseLivePage } from '../src/core/live'
import { loadResults, sourceUrl, type FetchLike } from '../src/core/source'
import { HTML_26, fixture } from './helpers'

/** Chụp lúc 16h25 (đang quay), 16h36 (vừa quay xong, run vẫn = 1), 16h38 (hết phiên, không còn kq). */
const FEED = fixture('live-feed-29-10-2026-dang-quay.js')
const FEED_DONE = fixture('live-feed-29-10-2026-xong.js')
const FEED_OVER = fixture('live-feed-29-10-2026-het-phien.js')
const PAGE = fixture('live-page-29-10-2026.html')
const D29 = { y: 2026, m: 10, d: 29 } // Thứ Năm: Tây Ninh, An Giang, Bình Thuận

const ok = (body: string) => new Response(body, { status: 200 })
const feedUrl = (i = 0) => LIVE_HOSTS[i] + LIVE_FEED_PATH

/** fetch giả theo URL; URL lạ thì báo lỗi 404. */
function routes(map: Record<string, string | (() => never)>) {
  return vi.fn<FetchLike>(async (url) => {
    const r = map[url]
    if (r === undefined) return new Response('', { status: 404 })
    return typeof r === 'function' ? r() : ok(r)
  })
}

describe('parseLiveFeed', () => {
  it('đọc feed lúc đang quay: chỉ lấy ô đã đủ chữ số, bỏ ô đang quay (+++++) và chưa quay (*****)', () => {
    const f = parseLiveFeed(FEED)!
    expect(f.running).toBe(true)
    expect(f.date).toEqual(D29)
    expect(f.ids).toEqual(['13', '14', '15'])
    expect(f.stations['13'].code).toBe('10K5')
    expect(f.stations['13'].prizes['8']).toEqual(['15'])
    expect(f.stations['13'].prizes['6']).toEqual(['0969', '9301', '9684'])
    expect(f.stations['13'].prizes['1']).toEqual(['26571'])
    expect(f.stations['13'].prizes.db).toEqual([])
    expect(f.stations['14'].code).toBe('AG-10K5')
    expect(f.stations['14'].prizes['4']).toEqual(['65401', '14542', '69401'])
    expect(f.stations['14'].prizes['3']).toEqual([])
  })

  it('không chạy mã tải về; sai cấu trúc hoặc không có phần miền Nam thì trả null', () => {
    expect(parseLiveFeed('')).toBeNull()
    expect(parseLiveFeed(FEED_OVER)).toBeNull()
    expect(parseLiveFeed('kqxs.mt={run:1,tinh:"30",ntime:1793264429,kq:{30:{}}};')).toBeNull()
    expect(parseLiveFeed('kqxs.mn={run:1,tinh:"13",ntime:1793264429,kq:{13:{8:alert(1)}}};')).toBeNull()
    expect(parseLiveFeed('kqxs.mn={run:1,tinh:"13,14",ntime:1793264429,kq:{13:{}}};')).toBeNull()
  })

  it('chuỗi có dấu ngoặc, dấu hai chấm không làm hỏng; số đang lộ dần (12+++) bỏ qua', () => {
    const f = parseLiveFeed('kqxs.mn={run:1,tinh:"9",ntime:1793264429,kq:{9:{lv:"K:{1}",8:"12",7:"34+",4:["11111","22***"]}}};')!
    expect(f.stations['9'].code).toBe('K:{1}')
    expect(f.stations['9'].prizes['8']).toEqual(['12'])
    expect(f.stations['9'].prizes['7']).toEqual([])
    expect(f.stations['9'].prizes['4']).toEqual(['11111'])
  })
})

describe('parseLivePage', () => {
  it('tra mã tỉnh ra đài theo cột của bảng trực tiếp, lấy danh sách máy chủ', () => {
    const { stations, hosts } = parseLivePage(PAGE)
    expect([...stations]).toEqual([
      ['13', { slug: 'tay-ninh', name: 'Tây Ninh' }],
      ['14', { slug: 'an-giang', name: 'An Giang' }],
      ['15', { slug: 'binh-thuan', name: 'Bình Thuận' }]
    ])
    expect(hosts.length).toBeGreaterThan(0)
    expect(new Set(hosts).size).toBe(hosts.length)
    expect(hosts.every((h) => /^https:\/\/server-live\d+\.minhngoc\.net\.vn$/.test(h))).toBe(true)
  })
})

describe('liveResult', () => {
  const { stations } = parseLivePage(PAGE)

  it('đang quay → partial, đếm số đã có', () => {
    const r = liveResult(parseLiveFeed(FEED)!, stations)!
    expect(r.status).toBe('partial')
    expect(r.date).toBe('29-10-2026')
    expect(r.stations.map((s) => s.slug)).toEqual(['tay-ninh', 'an-giang', 'binh-thuan'])
    expect(r.total).toBe(54)
    expect(r.filled).toBe(17 + 9 + 16)
  })

  it('đủ số → ok', () => {
    const r = liveResult(parseLiveFeed(FEED_DONE)!, stations)!
    expect(r.status).toBe('ok')
    expect(r.filled).toBe(54)
    expect(r.stations[1].prizes.db).toEqual(['111082'])
  })

  it('mã tỉnh chưa biết là đài nào → null (không đoán theo lịch)', () => {
    expect(liveResult(parseLiveFeed(FEED)!, new Map([...stations].slice(0, 2)))).toBeNull()
  })
})

describe('LiveSource', () => {
  it('lần đầu tải feed + trang trực tiếp để tra mã tỉnh, các lần sau chỉ tải feed', async () => {
    const fetch = routes({ [feedUrl()]: FEED, [LIVE_PAGE_URL]: PAGE })
    const live = new LiveSource()
    const a = await live.load(D29, { fetch })
    expect(a?.running).toBe(true)
    expect(a?.result.stations[0].slug).toBe('tay-ninh')
    expect(fetch.mock.calls.map((c) => c[0])).toEqual([feedUrl(), LIVE_PAGE_URL])

    fetch.mockClear()
    await live.load(D29, { fetch })
    expect(fetch.mock.calls.map((c) => c[0])).toEqual([feedUrl()])
  })

  it('hai lần hỏi song song lúc mở app: lần sau chờ lần đầu tra xong mã tỉnh, trang trực tiếp tải một lần', async () => {
    const fetch = routes({ [feedUrl()]: FEED, [LIVE_PAGE_URL]: PAGE })
    const live = new LiveSource()
    const [a, b] = await Promise.all([live.load(D29, { fetch }), live.load(D29, { fetch })])
    expect(a?.result.stations[0].slug).toBe('tay-ninh')
    expect(b?.result.stations[0].slug).toBe('tay-ninh')
    expect(fetch.mock.calls.filter((c) => c[0] === LIVE_PAGE_URL)).toHaveLength(1)
  })

  it('hết phiên (feed không còn kq) → null, không hỏi máy khác, không tải trang trực tiếp', async () => {
    const fetch = routes({ [feedUrl()]: FEED_OVER, [LIVE_PAGE_URL]: PAGE })
    expect(await new LiveSource().load(D29, { fetch })).toBeNull()
    expect(fetch.mock.calls.map((c) => c[0])).toEqual([feedUrl()])
  })

  it('feed là phiên của ngày khác → null, không tải trang trực tiếp', async () => {
    const fetch = routes({ [feedUrl()]: FEED, [LIVE_PAGE_URL]: PAGE })
    expect(await new LiveSource().load({ y: 2026, m: 10, d: 30 }, { fetch })).toBeNull()
    expect(fetch).toHaveBeenCalledTimes(1)
  })

  it('máy chủ đầu lỗi thì hỏi máy kế tiếp, lần sau bắt đầu từ máy đang chạy', async () => {
    const down = () => { throw new TypeError('fetch failed') }
    const page = PAGE.replace(/var rawDomainStr = "[^"]*"/, `var rawDomainStr = "${LIVE_HOSTS[0]},${LIVE_HOSTS[1]}"`)
    const fetch = routes({ [feedUrl(0)]: down, [feedUrl(1)]: FEED, [LIVE_PAGE_URL]: page })
    const live = new LiveSource()
    expect((await live.load(D29, { fetch }))?.running).toBe(true)
    fetch.mockClear()
    await live.load(D29, { fetch })
    expect(fetch.mock.calls.map((c) => c[0])).toEqual([feedUrl(1)])
  })
})

describe('loadResults + bảng trực tiếp', () => {
  afterEach(() => { vi.useRealTimers() })
  const at = (vnTime: string) => vi.useFakeTimers({ now: new Date(`2026-10-29T${vnTime}+07:00`), toFake: ['Date'] })

  it('16h25 đang quay → dùng bảng trực tiếp, không tải trang kết quả', async () => {
    at('16:25:00')
    const fetch = routes({ [feedUrl()]: FEED, [LIVE_PAGE_URL]: PAGE, [sourceUrl(D29)]: HTML_26 })
    const r = await loadResults(D29, { fetch, live: new LiveSource() })
    expect(r.live).toBe(true)
    expect(r.status).toBe('partial')
    expect(fetch.mock.calls.map((c) => c[0])).not.toContain(sourceUrl(D29))
  })

  it('đủ số mà feed vẫn báo đang quay → tải trang kết quả; trang chưa có thì dùng bảng trực tiếp', async () => {
    at('16:36:00')
    const fetch = routes({ [feedUrl()]: FEED_DONE, [LIVE_PAGE_URL]: PAGE, [sourceUrl(D29)]: HTML_26 })
    const r = await loadResults(D29, { fetch, live: new LiveSource() })
    expect(fetch.mock.calls.map((c) => c[0])).toContain(sourceUrl(D29))
    expect(r.status).toBe('ok')
    expect(r.live).toBe(true)
  })

  it('ngoài khung 16h–17h không hỏi máy chủ trực tiếp', async () => {
    for (const t of ['15:59:00', '17:00:00']) {
      at(t)
      const fetch = routes({ [feedUrl()]: FEED, [LIVE_PAGE_URL]: PAGE, [sourceUrl(D29)]: HTML_26 })
      const r = await loadResults(D29, { fetch, live: new LiveSource() })
      expect(r.status).toBe('none')
      expect(fetch.mock.calls.map((c) => c[0])).toEqual([sourceUrl(D29)])
    }
  })

  it('ngày khác hôm nay không hỏi máy chủ trực tiếp', async () => {
    at('16:25:00')
    const fetch = routes({ [feedUrl()]: FEED, [sourceUrl({ y: 2026, m: 10, d: 26 })]: HTML_26 })
    await loadResults({ y: 2026, m: 10, d: 26 }, { fetch, live: new LiveSource() })
    expect(fetch).toHaveBeenCalledTimes(1)
  })

  it('hết phiên → đọc trang kết quả như cũ', async () => {
    at('16:40:00')
    const fetch = routes({ [feedUrl()]: FEED_OVER, [sourceUrl(D29)]: HTML_26 })
    const r = await loadResults(D29, { fetch, live: new LiveSource() })
    expect(r.status).toBe('none')
    expect(r.live).toBeUndefined()
    expect(fetch.mock.calls.map((c) => c[0])).toEqual([feedUrl(), sourceUrl(D29)])
  })

  it('máy chủ trực tiếp lỗi → như cũ, chỉ đọc trang kết quả', async () => {
    at('16:25:00')
    const fetch = routes({ [sourceUrl(D29)]: HTML_26 })
    const r = await loadResults(D29, { fetch, live: new LiveSource(), retryDelayMs: 1 })
    expect(r.status).toBe('none')
    expect(r.live).toBeUndefined()
  })
})
