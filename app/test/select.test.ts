import { describe, expect, it } from 'vitest'
import { parseResults } from '../src/core/parse'
import { selectStations } from '../src/core/select'
import { defaultSettings, type StationSettings } from '../src/core/settings'
import { D24, D26, HTML_24, HTML_26 } from './helpers'

const day26 = parseResults(HTML_26, D26)
const day24 = parseResults(HTML_24, D24)
const slugs = (list: { slug: string }[]) => list.map((s) => s.slug)

function pick(byWeekday: StationSettings['byWeekday'], shortNames: Record<string, string> = {}): StationSettings {
  return { mode: 'pick', byWeekday: { ...defaultSettings().stations.byWeekday, ...byWeekday }, shortNames }
}

describe('selectStations', () => {
  it('mode all: mọi đài trên web, đúng thứ tự web, tên viết tắt mặc định', () => {
    const list = selectStations({ day: day26, weekday: 1, stations: defaultSettings().stations })
    expect(slugs(list)).toEqual(['tp-hcm', 'dong-thap', 'ca-mau'])
    expect(list.map((s) => s.short)).toEqual(['TP.HCM', 'Đ.Tháp', 'C.Mau'])
    expect(list[0].name).toBe('TP. Hồ Chí Minh')
    expect(list[0].code).toBe('XSHCM - 10E2')
    expect(list[0].prizes.db).toEqual(['472899'])
  })

  it('mode pick: giữ thứ tự trong mảng, bỏ đài tắt', () => {
    const stations = pick({
      1: [{ slug: 'ca-mau', on: true }, { slug: 'tp-hcm', on: true }, { slug: 'dong-thap', on: false }]
    })
    expect(slugs(selectStations({ day: day26, weekday: 1, stations }))).toEqual(['ca-mau', 'tp-hcm'])
  })

  it('mode pick: đài quay hôm đó mà thiếu trong danh sách thì thêm vào cuối', () => {
    const stations = pick({ 6: [{ slug: 'hau-giang', on: true }, { slug: 'tp-hcm', on: false }] })
    expect(slugs(selectStations({ day: day24, weekday: 6, stations }))).toEqual(['hau-giang', 'long-an', 'binh-phuoc'])
  })

  it('mode pick: đài trong danh sách nhưng không quay hôm đó thì bỏ', () => {
    const stations = pick({ 1: [{ slug: 'ben-tre', on: true }, { slug: 'ca-mau', on: true }, { slug: 'tp-hcm', on: false }, { slug: 'dong-thap', on: false }] })
    expect(slugs(selectStations({ day: day26, weekday: 1, stations }))).toEqual(['ca-mau'])
  })

  it('tắt hết → in đủ các đài', () => {
    const stations = pick({
      1: [{ slug: 'tp-hcm', on: false }, { slug: 'dong-thap', on: false }, { slug: 'ca-mau', on: false }]
    })
    expect(slugs(selectStations({ day: day26, weekday: 1, stations }))).toEqual(['tp-hcm', 'dong-thap', 'ca-mau'])
  })

  it('đài lạ trên web vẫn hiện, tên lấy từ web; mode pick thêm vào cuối', () => {
    const html = HTML_26.replace('/xo-so-mien-nam/dong-thap.html', '/xo-so-mien-nam/dai-moi.html').replace('>Đồng Tháp<', '>Đài Mới<')
    const day = parseResults(html, D26)
    const all = selectStations({ day, weekday: 1, stations: defaultSettings().stations })
    expect(all[1]).toMatchObject({ slug: 'dai-moi', name: 'Đài Mới', short: 'Đài Mới' })
    const picked = selectStations({ day, weekday: 1, stations: pick({}) })
    expect(slugs(picked)).toEqual(['tp-hcm', 'ca-mau', 'dai-moi'])
  })

  it('tên viết tắt tuỳ chỉnh', () => {
    const stations = { ...defaultSettings().stations, shortNames: { 'ca-mau': 'Cà Mau' } }
    expect(selectStations({ day: day26, weekday: 1, stations })[2].short).toBe('Cà Mau')
  })

  it('chưa có kết quả → theo lịch cố định, không có số', () => {
    for (const day of [null, parseResults(HTML_26, { y: 2026, m: 10, d: 31 })]) {
      const list = selectStations({ day, weekday: 6, stations: defaultSettings().stations })
      expect(slugs(list)).toEqual(['tp-hcm', 'long-an', 'binh-phuoc', 'hau-giang'])
      expect(list.every((s) => s.prizes.db.length === 0 && s.code === '')).toBe(true)
    }
  })

  it('phiếu trống: giữ đài, bỏ số', () => {
    const list = selectStations({ day: day26, weekday: 1, stations: defaultSettings().stations, blank: true })
    expect(slugs(list)).toEqual(['tp-hcm', 'dong-thap', 'ca-mau'])
    expect(list.every((s) => Object.values(s.prizes).every((a) => a.length === 0))).toBe(true)
    // không làm hỏng dữ liệu gốc
    expect(day26.stations[0].prizes.db).toEqual(['472899'])
  })
})
