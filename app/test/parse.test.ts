import { describe, expect, it } from 'vitest'
import { parseResults } from '../src/core/parse'
import { formatTicketCode, PRIZES, PRIZE_COUNT } from '../src/core/stations'
import { D24, D26, HTML_24, HTML_26 } from './helpers'

const count = (prizes: Record<string, string[]>) => Object.values(prizes).reduce((n, a) => n + a.length, 0)

describe('parseResults', () => {
  it('đọc đúng 3 đài ngày 26-10-2026 dù HTML thiếu </td>', () => {
    const r = parseResults(HTML_26, D26)
    expect(r.status).toBe('ok')
    expect(r.date).toBe('26-10-2026')
    expect(r.pageDate).toBe('26/10/2026')
    expect(r.stations.map((s) => s.slug)).toEqual(['tp-hcm', 'dong-thap', 'ca-mau'])
    expect(r.stations.map((s) => s.name)).toEqual(['TP. HCM', 'Đồng Tháp', 'Cà Mau'])
    expect(r.stations.map((s) => s.code)).toEqual(['XSHCM - 10E2', 'XSDT - V43', 'XSCM - 26-T10K4'])
    expect(r.filled).toBe(54)
    expect(r.total).toBe(54)
    for (const st of r.stations) {
      expect(count(st.prizes)).toBe(18)
      for (const k of PRIZES) expect(st.prizes[k]).toHaveLength(PRIZE_COUNT[k])
    }
  })

  it('không lẫn số giữa các đài (cột lồng nhau do thiếu </td>)', () => {
    const [hcm, dt, cm] = parseResults(HTML_26, D26).stations
    expect(hcm.prizes['8']).toEqual(['74'])
    expect(dt.prizes['8']).toEqual(['46'])
    expect(cm.prizes['8']).toEqual(['67'])
    expect(hcm.prizes['6']).toEqual(['3452', '9687', '3427'])
    expect(dt.prizes['4']).toEqual(['07328', '63114', '84005', '11826', '10469', '70207', '57564'])
    expect(cm.prizes.db).toEqual(['929097'])
    expect(hcm.prizes.db).toEqual(['472899'])
  })

  it('chỉ lấy bảng đầu tiên (bỏ bảng ngày 25 phía dưới)', () => {
    const r = parseResults(HTML_26, D26)
    expect(r.stations.some((s) => s.slug === 'tien-giang')).toBe(false)
  })

  it('đọc đúng 4 đài Thứ Bảy 24-10-2026, giữ thứ tự trên web', () => {
    const r = parseResults(HTML_24, D24)
    expect(r.status).toBe('ok')
    expect(r.stations.map((s) => s.slug)).toEqual(['tp-hcm', 'long-an', 'binh-phuoc', 'hau-giang'])
    expect(r.stations[3].prizes.db).toEqual(['123456'])
    expect(r.total).toBe(72)
  })

  it('ngày trên trang khác ngày yêu cầu → none', () => {
    const r = parseResults(HTML_26, { y: 2026, m: 10, d: 27 })
    expect(r.status).toBe('none')
    expect(r.pageDate).toBe('26/10/2026')
    expect(r.stations).toEqual([])
    expect(r.message).toContain('27/10/2026')
  })

  it('thiếu số (đang quay trực tiếp) → partial, ô thiếu để trống', () => {
    // Giải nhất và ĐB của Cà Mau chưa quay: web hiện ảnh chờ thay cho số
    const html = HTML_26.replace('<div>83940</div>', '<div><img src="/loading.gif"></div>').replace(
      '<div>929097</div>',
      '<div></div>'
    )
    const r = parseResults(html, D26)
    expect(r.status).toBe('partial')
    expect(r.filled).toBe(52)
    expect(r.total).toBe(54)
    const cm = r.stations[2]
    expect(cm.prizes['1']).toEqual([])
    expect(cm.prizes.db).toEqual([])
    expect(r.stations[0].prizes.db).toEqual(['472899'])
  })

  it('không có bảng kết quả → error', () => {
    const r = parseResults('<html><body><p>Bảo trì</p></body></html>', D26)
    expect(r.status).toBe('error')
    expect(r.message).toMatch(/không có bảng kết quả/)
    expect(r.errorKind).toBe('parse')
  })

  it('đài lạ: lấy mã từ href, tên từ web', () => {
    const html = HTML_26.replace('/xo-so-mien-nam/ca-mau.html', '/xo-so-mien-nam/dai-moi.html').replace('>Cà Mau<', '>Đài Mới<')
    const st = parseResults(html, D26).stations[2]
    expect(st.slug).toBe('dai-moi')
    expect(st.name).toBe('Đài Mới')
  })
})

describe('formatTicketCode', () => {
  it('thay gạch đầu tiên bằng chấm giữa', () => {
    expect(formatTicketCode('XSHCM - 10E2')).toBe('XSHCM · 10E2')
    expect(formatTicketCode('XSCM - 26-T10K4')).toBe('XSCM · 26-T10K4')
  })
})
