import { describe, expect, it } from 'vitest'
import { computeLayout, PAGE_MARGIN, PAPER_SPECS, SAFETY, type LayoutInput } from '../src/core/layout'
import { PAPERS, type HeaderSettings, type Settings } from '../src/core/settings'
import { agentSettings } from './helpers'
import { emptyPrizes, type Prizes } from '../src/core/stations'

const FULL: Prizes = {
  '8': ['74'], '7': ['010'], '6': ['3452', '9687', '3427'], '5': ['3987'],
  '4': ['78899', '13421', '69122', '62142', '48887', '90540', '68727'],
  '3': ['79446', '35158'], '2': ['54677'], '1': ['78600'], db: ['472899']
}
const stations = (n: number) => Array.from({ length: n }, (_, i) => ({ short: `Đài ${i + 1}`, prizes: FULL }))

function input(over: { settings?: Settings; paper?: LayoutInput['paper']; n?: number } = {}): LayoutInput {
  const s = over.settings ?? agentSettings()
  return { header: s.header, print: s.print, paper: over.paper ?? 'A4', title: 'Thứ Hai (26-10-2026)', stations: stations(over.n ?? 3) }
}

function withHeader(edit: (h: HeaderSettings) => void): Settings {
  const s = agentSettings()
  edit(s.header)
  return s
}

const HEADERS: Record<string, Settings> = {
  'mặc định': agentSettings(),
  'ẩn bớt': withHeader((h) => { h.addr.show = false; h.fax.show = false; h.label.show = false }),
  'ẩn hết': withHeader((h) => { for (const k of Object.keys(h) as (keyof HeaderSettings)[]) h[k].show = false }),
  'cỡ to': withHeader((h) => {
    h.name.size = 20; h.label.size = 12; h.addr.size = 10; h.fax.size = 10; h.phones.size = 10; h.date.size = 16
    h.note.show = true; h.note.value = 'Cần so lại với fax'
  }),
  'chữ dài': withHeader((h) => { h.addr.value = 'Số 123 đường Trần Hưng Đạo, Phường 1, Quận 5, Thành phố Hồ Chí Minh, Việt Nam' })
}

describe('computeLayout — mọi khổ × số đài × phần đầu phiếu', () => {
  for (const paper of PAPERS) {
    for (const n of [3, 4]) {
      for (const [name, settings] of Object.entries(HEADERS)) {
        it(`${paper}, ${n} đài, đầu phiếu ${name}`, () => {
          const l = computeLayout(input({ settings, paper, n }))
          const spec = PAPER_SPECS[paper]
          const usableH = spec.h - 2 * PAGE_MARGIN
          expect(l.copies).toBe(spec.ncol * spec.nrow)
          expect(l.warnings.filter((w) => w.includes('chật'))).toEqual([])

          // Bảng nằm gọn trong phần dành cho nó, phiếu nằm gọn trong ô chia
          expect(l.table.height).toBeLessThanOrEqual(l.table.available)
          expect(l.header.height + l.table.height + SAFETY).toBeLessThanOrEqual(l.cardH)
          // Tổng chiều cao một cột ≤ chiều cao vùng in
          const column = l.nrow * (l.header.height + l.table.height) + (l.nrow - 1) * l.gap
          expect(column).toBeLessThanOrEqual(usableH)

          // Bề ngang: các cột phiếu + khoảng cách + lề = đúng bề ngang trang
          expect(l.margin.left + l.margin.right + l.ncol * l.colW + (l.ncol - 1) * l.gap).toBeLessThanOrEqual(spec.w)
          expect(l.table.width).toBeLessThanOrEqual(l.cardW)

          // Số 6 chữ số (ĐB) vừa ô: 6 × 0,5 em ≈ 30 twips mỗi half-point
          const room = l.table.stW - 76 - l.table.numberIndent
          expect(30 * l.table.dbSize).toBeLessThanOrEqual(room)
          expect(l.table.dbSize).toBeGreaterThanOrEqual(l.table.numberSize)
          expect(l.table.numberSize).toBeGreaterThanOrEqual(15)
        })
      }
    }
  }
})

describe('computeLayout — số đo chuẩn (khớp cli/xsmn.sh)', () => {
  it('A4, 3 đài: số 13,5 pt, ĐB 14,5 pt', () => {
    const l = computeLayout(input())
    expect(l.table.numberSize).toBe(27)
    expect(l.table.dbSize).toBe(29)
    expect(l.warnings).toEqual([])
    expect(l.gap).toBe(340)
    expect(l.cardW).toBe(4536)
    expect(l.cardH).toBe(7795)
    expect(l.margin).toEqual({ top: 454, right: 2040, bottom: 454, left: 454 })
    expect(l.table).toMatchObject({ labW: 725, stW: 1270, width: 4535, stationSize: 24, numberIndent: 142 })
    expect(l.header.height).toBe(1200)
    expect(l.header.lines.map((x) => [x.lineH, x.after, x.lines])).toEqual([[380, 60, 1], [180, 0, 1], [180, 0, 1], [340, 60, 1]])
    expect(l.header.lines[2].runs).toEqual([{ text: 'Fax: 0623 881 519  DĐ: 01212 019 343  DĐ: 0983 019 343', size: 15 }])
  })

  it('A4, 4 đài (Thứ Bảy): số 12 pt, bị giới hạn bề ngang', () => {
    const l = computeLayout(input({ n: 4 }))
    expect(l.table.numberSize).toBe(24)
    expect(l.table.dbSize).toBe(24)
    expect(l.table.stationSize).toBe(20)
  })

  it('chiều cao hàng chia phần dư theo trọng số, giải Tư cao nhất', () => {
    const l = computeLayout(input())
    const h = Object.fromEntries(l.table.rows.map((r) => [r.key, r.height]))
    expect(h['4']).toBeGreaterThan(h['6'])
    expect(h['8']).toBe(h['7'])
    expect(l.table.rows.map((r) => r.label)).toEqual(['Giải', 'Tám', 'Bảy', 'Sáu', 'Năm', 'Tư', 'Ba', 'Nhì', 'Nhất', 'ĐB'])
  })

  it('A6 một cột: phần đầu phiếu thụt lề theo vị trí cụm phiếu', () => {
    const s = agentSettings()
    expect(computeLayout(input({ paper: 'A6' })).header.indent).toEqual({ left: 0, right: 509 })
    s.print.cardAlign = 'center'
    expect(computeLayout(input({ settings: s, paper: 'A6' })).header.indent).toEqual({ left: 254, right: 254 })
    s.print.cardAlign = 'right'
    const l = computeLayout(input({ settings: s, paper: 'A6' }))
    expect(l.header.indent).toEqual({ left: 509, right: 0 })
    expect(l.margin).toEqual({ top: 454, right: 454, bottom: 454, left: 454 })
  })

  it('nhiều cột: phần dư dồn vào lề theo cardAlign', () => {
    const s = agentSettings()
    s.print.cardAlign = 'center'
    expect(computeLayout(input({ settings: s })).margin).toMatchObject({ left: 454 + 793, right: 454 + 793 })
    s.print.cardAlign = 'right'
    expect(computeLayout(input({ settings: s })).margin).toMatchObject({ left: 2040, right: 454 })
  })
})

describe('computeLayout — cảnh báo', () => {
  it('phiếu rộng quá chỗ trống → dùng tối đa', () => {
    const s = agentSettings()
    s.print.cardWidthCm = 12
    const l = computeLayout(input({ settings: s }))
    expect(l.cardW).toBe(5329)
    expect(l.warnings[0]).toMatch(/rộng hơn chỗ trống trên khổ A4 \(9,4 cm\)/)
  })

  it('cỡ số chọn tay vừa thì giữ nguyên, quá lớn thì hạ xuống và báo', () => {
    const s = agentSettings()
    s.print.numberFontPt = 13
    expect(computeLayout(input({ settings: s })).table.numberSize).toBe(26)
    s.print.numberFontPt = 20
    const l = computeLayout(input({ settings: s }))
    expect(l.table.numberSize).toBe(27)
    expect(l.warnings[0]).toMatch(/Cỡ số 20 pt quá lớn so với phiếu, đã dùng 13,5 pt/)
  })

  it('chữ dài tự xuống dòng được tính vào chiều cao đầu phiếu', () => {
    const l = computeLayout(input({ settings: HEADERS['chữ dài'] }))
    expect(l.header.lines[1].lines).toBe(2)
    expect(l.header.height).toBe(1200 + 180)
  })

  it('phiếu trống vẫn cùng bố cục với phiếu có số', () => {
    const blank = computeLayout({ ...input(), stations: stations(3).map((s) => ({ ...s, prizes: emptyPrizes() })), blank: true })
    const full = computeLayout(input())
    expect(blank.table.rows).toEqual(full.table.rows)
    expect(blank.blank).toBe(true)
  })
})
