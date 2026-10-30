import { describe, expect, it } from 'vitest'
import { cellBox, computeLayout, maxCardSizeCm, PAGE_MARGIN, PAPER_SPECS, SAFETY, type LayoutInput } from '../src/core/layout'
import { PAPERS, type HeaderSettings, type Settings } from '../src/core/settings'
import { agentSettings, D26, HTML_26 } from './helpers'
import { parseResults } from '../src/core/parse'
import { buildSheet } from '../src/core/sheet'
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
  'ẩn bớt': withHeader((h) => { h.addr.show = false; h.contact.show = false; h.label.show = false }),
  'ẩn hết': withHeader((h) => { for (const k of ['label', 'name', 'addr', 'contact'] as const) h[k].show = false }),
  'cỡ to': withHeader((h) => {
    h.name.size = 20; h.label.size = 12; h.addr.size = 10; h.contact.size = 10; h.date.size = 16
  }),
  'cách rộng': withHeader((h) => { h.name.afterPt = 20; h.addr.afterPt = 20; h.contact.afterPt = 20; h.date.afterPt = 20 }),
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
          const column = l.nrow * (l.header.height + l.table.height) + (l.nrow - 1) * l.gapY
          expect(column).toBeLessThanOrEqual(usableH)

          // Bề ngang: các cột phiếu + khoảng cách + lề = đúng bề ngang trang
          expect(l.margin.left + l.margin.right + l.ncol * l.colW + (l.ncol - 1) * l.gapX).toBeLessThanOrEqual(spec.w)
          expect(l.table.width).toBeLessThanOrEqual(l.cardW)

          // Số 6 chữ số (ĐB) vừa ô: 6 × 0,5 em ≈ 30 twips mỗi half-point
          const room = l.table.stW - 76 - l.table.number.indentLeft - l.table.number.indentRight
          expect(30 * l.table.dbSize).toBeLessThanOrEqual(room)
          expect(l.table.dbSize).toBeGreaterThanOrEqual(l.table.numberSize)
          expect(l.table.numberSize).toBeGreaterThanOrEqual(15)
        })
      }
    }
  }
})

describe('computeLayout — số đo chuẩn (khớp bản bash cũ)', () => {
  it('A4, 3 đài: số 13,5 pt, ĐB 14,5 pt', () => {
    const l = computeLayout(input())
    expect(l.table.numberSize).toBe(27)
    expect(l.table.dbSize).toBe(29)
    expect(l.warnings).toEqual([])
    expect(l.gapX).toBe(340)
    expect(l.gapY).toBe(340)
    expect(l.cardW).toBe(4536)
    expect(l.cardH).toBe(7795)
    expect(l.margin).toEqual({ top: 454, right: 2040, bottom: 454, left: 454 })
    expect(l.table).toMatchObject({ labW: 725, stW: 1270, width: 4535, stationSize: 24, rowPad: 60 })
    expect(l.table.number).toEqual({ alignX: 'right', alignY: 'center', indentLeft: 0, indentRight: 142, padTop: 0, padBottom: 0 })
    expect(l.table.text).toEqual({ alignX: 'center', alignY: 'top', indentLeft: 0, indentRight: 0, padTop: 0, padBottom: 0 })
    expect(l.header.height).toBe(1200)
    expect(l.header.lines.map((x) => [x.lineH, x.after, x.lines])).toEqual([[380, 60, 1], [180, 0, 1], [180, 0, 1], [340, 60, 1]])
    expect(l.header.lines[2].runs).toEqual([
      { text: 'DĐ: 01212 019 343  DĐ: 0983 019 343', size: 15, color: '000000', bold: true, italic: false }
    ])
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

  it('căn lề và khoảng cách từng dòng lấy từ cài đặt; dòng thứ, ngày luôn có', () => {
    const l = computeLayout(input({
      settings: withHeader((h) => {
        h.addr.align = 'left'
        h.contact.align = 'right'
        h.name.afterPt = 6
        h.date.afterPt = 0.5
        for (const k of ['label', 'name', 'addr', 'contact'] as const) h[k].show = false
        h.addr.show = true
        h.contact.show = true
      })
    }))
    expect(l.header.lines.map((x) => [x.id, x.align, x.after])).toEqual([
      ['addr', 'left', 0], ['contact', 'right', 0], ['date', 'center', 10]
    ])
    // nhãn ẩn tên thì nhãn vẫn theo căn lề, khoảng cách của dòng tên
    const label = computeLayout(input({ settings: withHeader((h) => { h.name.show = false; h.name.align = 'right'; h.name.afterPt = 6 }) }))
    expect(label.header.lines[0]).toMatchObject({ id: 'name', align: 'right', after: 120, runs: [{ text: 'Đại lý vé số:', size: 16 }] })
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

describe('computeLayout — chiều cao phiếu', () => {
  it('tự động (mặc định): cao hết chỗ trống trên khổ giấy', () => {
    const l = computeLayout(input())
    expect(l.cardH).toBe(7795)
    expect(l.cardHMax).toBe(7795)
  })

  it('tự chọn 10 cm: phiếu thấp lại, cỡ số tự co cho vừa, mọi khổ', () => {
    for (const paper of PAPERS) {
      const s = agentSettings()
      s.print.cardHeightCm = 10
      const l = computeLayout(input({ settings: s, paper }))
      expect(l.cardH).toBe(5670)
      expect(l.warnings).toEqual([])
      expect(l.header.height + l.table.height + SAFETY).toBeLessThanOrEqual(l.cardH)
      expect(l.table.numberSize).toBeLessThan(computeLayout(input({ paper })).table.numberSize)
    }
  })

  it('cao hơn chỗ trống → dùng tối đa và báo', () => {
    const s = agentSettings()
    s.print.cardHeightCm = 20
    const l = computeLayout(input({ settings: s }))
    expect(l.cardH).toBe(l.cardHMax)
    expect(l.warnings[0]).toMatch(/Chiều cao phiếu 20 cm cao hơn chỗ trống trên khổ A4 \(13,7 cm\)/)
  })

  it('thấp quá không đủ chỗ cho số → báo phiếu chật, gợi ý tăng chiều cao', () => {
    const s = agentSettings()
    s.print.cardHeightCm = 5
    const l = computeLayout(input({ settings: s }))
    expect(l.table.numberSize).toBe(15)
    expect(l.warnings.join(' ')).toMatch(/Tăng chiều cao phiếu/)
  })
})

describe('computeLayout — khoảng cách ngang / dọc riêng', () => {
  it('ngang đổi lề và độ rộng cột, dọc đổi chiều cao phiếu', () => {
    const s = agentSettings()
    s.print.cardGapXCm = 1
    s.print.cardGapYCm = 0.2
    const l = computeLayout(input({ settings: s }))
    expect(l.gapX).toBe(567)
    expect(l.gapY).toBe(113)
    // lề phải = phần dư sau 2 phiếu + khoảng cách ngang
    expect(l.margin.right).toBe(454 + (10998 - 2 * 4536 - 567))
    // chiều cao phiếu tự động = (vùng in − khoảng cách dọc) / 2
    expect(l.cardH).toBe(Math.trunc((15930 - 113) / 2))
  })
})

describe('computeLayout — bề rộng Auto', () => {
  it('Auto = rộng nhất vừa một cột, không cảnh báo, phần dư lề bằng 0', () => {
    const s = agentSettings()
    s.print.cardWidthCm = null
    const a4 = computeLayout(input({ settings: s }))
    expect(a4.cardW).toBe(5329)
    expect(a4.margin).toMatchObject({ left: 454, right: 454 })
    expect(a4.warnings).toEqual([])
    const a6 = computeLayout(input({ settings: s, paper: 'A6' }))
    expect(a6.cardW).toBe(5045)
    expect(a6.header.indent).toEqual({ left: 0, right: 0 })
  })
})

describe('computeLayout — nhập đúng số làm tròn hiện trên màn hình', () => {
  it('cao 13,2 cm trên A5 (chỗ trống 13,197 cm) và rộng 9,4 cm trên A4 không bị báo vượt', () => {
    const s = agentSettings()
    s.print.cardHeightCm = 13.2
    s.print.cardWidthCm = 9.4
    const a5 = computeLayout(input({ settings: s, paper: 'A5' }))
    expect(a5.cardH).toBe(a5.cardHMax)
    expect(a5.warnings).toEqual([])
    const a4 = computeLayout(input({ settings: s }))
    expect(a4.cardW).toBe(5329)
    expect(a4.warnings).toEqual([])
  })

  it('maxCardSizeCm: mức tối đa màn Cài đặt hiện, nhập đúng số đó không bị báo vượt', () => {
    expect(maxCardSizeCm('A4', 0.6, 0.6)).toEqual({ w: 9.4, h: 13.7 })
    expect(maxCardSizeCm('A5', 0.6, 0.6)).toEqual({ w: 9.4, h: 13.2 })
    expect(maxCardSizeCm('A6', 0.6, 0.6)).toEqual({ w: 8.9, h: 13.2 })
    for (const paper of PAPERS) {
      const s = agentSettings()
      const max = maxCardSizeCm(paper, s.print.cardGapXCm, s.print.cardGapYCm)
      s.print.cardWidthCm = max.w
      s.print.cardHeightCm = max.h
      expect(computeLayout(input({ settings: s, paper })).warnings).toEqual([])
    }
  })
})

describe('Chữ / số trong bảng: padding + align', () => {
  it('padding tính từ mép ô, chỉ ở phía nội dung được căn (căn giữa: cả hai phía)', () => {
    // 0,3 cm = 170 twips, trừ lề trong ô 28 (ngang) / 30 (dọc)
    expect(cellBox({ padXCm: 0.3, padYCm: 0.3, alignX: 'right', alignY: 'center' }))
      .toEqual({ alignX: 'right', alignY: 'center', indentLeft: 0, indentRight: 142, padTop: 140, padBottom: 140 })
    expect(cellBox({ padXCm: 0.3, padYCm: 0.3, alignX: 'left', alignY: 'top' }))
      .toMatchObject({ indentLeft: 142, indentRight: 0, padTop: 140, padBottom: 0 })
    expect(cellBox({ padXCm: 0.3, padYCm: 0.3, alignX: 'center', alignY: 'bottom' }))
      .toMatchObject({ indentLeft: 142, indentRight: 142, padTop: 0, padBottom: 140 })
    // nhỏ hơn lề trong ô thì không thụt thêm
    expect(cellBox({ padXCm: 0, padYCm: 0, alignX: 'center', alignY: 'center' }))
      .toMatchObject({ indentLeft: 0, indentRight: 0, padTop: 0, padBottom: 0 })
  })

  it('số căn giữa: bề rộng dành cho số trừ cả hai bên; padding dọc làm hàng cao thêm, số nhỏ lại', () => {
    const s = agentSettings()
    s.print.numberCell = { padXCm: 0.3, padYCm: 0.2, alignX: 'center', alignY: 'center' }
    const l = computeLayout(input({ settings: s }))
    expect(l.table.rowPad).toBe(60 + 2 * (113 - 30))
    expect(30 * l.table.dbSize).toBeLessThanOrEqual(l.table.stW - 76 - 2 * 142)
    expect(l.table.numberSize).toBeLessThan(27)
    expect(l.header.height + l.table.height + SAFETY).toBeLessThanOrEqual(l.cardH)
  })
})

describe('computeLayout — bề rộng font máy (fontScale)', () => {
  // địa chỉ vừa đúng 1 dòng khi tính theo Times
  const long = () => withHeader((h) => { h.addr.value = 'Số 123 đường Lê Lợi, phường 1, thành phố Tân An, Long An' })

  it('Times (1) hoặc hẹp hơn: y như không truyền, giữ đúng số đo bash', () => {
    const base = computeLayout(input({ settings: long(), n: 4 }))
    expect(computeLayout({ ...input({ settings: long(), n: 4 }), fontScale: { digits: 1, text: 1 } })).toEqual(base)
    expect(computeLayout({ ...input({ settings: long(), n: 4 }), fontScale: { digits: 0.9, text: 0.8 } })).toEqual(base)
  })

  it('font rộng hơn (Verdana đậm ≈ 1,42 / 1,31): số nhỏ lại vừa ô, đầu phiếu tính thêm dòng', () => {
    const base = computeLayout(input({ settings: long(), n: 4 }))
    const wide = computeLayout({ ...input({ settings: long(), n: 4 }), fontScale: { digits: 1.42, text: 1.31 } })
    expect(wide.table.numberSize).toBeLessThan(base.table.numberSize)
    expect(Math.ceil(30 * 1.42) * wide.table.dbSize).toBeLessThanOrEqual(wide.table.stW - 76 - wide.table.number.indentLeft - wide.table.number.indentRight)
    const lines = (l: typeof base) => l.header.lines.reduce((n, x) => n + x.lines, 0)
    expect(lines(wide)).toBeGreaterThan(lines(base))
  })
})

describe('cỡ số từng hàng giải', () => {
  const day26 = parseResults(HTML_26, D26)
  const at = (edit: (s: ReturnType<typeof agentSettings>) => void) => {
    const s = agentSettings()
    edit(s)
    return buildSheet(s, day26, { date: D26, paper: 'A4', blank: false }).layout.table
  }

  it('mặc định: ĐB +1 pt, hàng khác theo cỡ chung', () => {
    const t = at(() => {})
    expect([t.numberSize, t.dbSize]).toEqual([27, 29])
    expect(t.prizeRows.db).toMatchObject({ size: 29, line: 319 })
    expect(t.prizeRows['4']).toMatchObject({ size: 27, line: 297 })
  })

  it('ĐB không cộng thêm thì bằng cỡ chung; hàng Tư +1 pt thì cỡ chung tự nhỏ lại cho vừa phiếu', () => {
    const flat = at((s) => { s.print.rows.db.sizeDeltaPt = 0 })
    expect(flat.dbSize).toBe(flat.numberSize)
    // phiếu thấp: chiều cao giới hạn cỡ số (phiếu mặc định bị giới hạn bởi bề ngang ô)
    const low = at((s) => { s.print.cardHeightCm = 10 })
    const big4 = at((s) => { s.print.cardHeightCm = 10; s.print.rows['4'].sizeDeltaPt = 1 })
    expect(big4.numberSize).toBeLessThan(low.numberSize)
    expect(big4.prizeRows['4'].size).toBe(big4.numberSize + 2)
    expect(big4.rows.reduce((sum, r) => sum + r.height, 0)).toBeLessThanOrEqual(big4.available)
  })

  it('hàng nhỏ hơn cỡ chung; màu, kiểu chữ của hàng ghi đè mức chung', () => {
    const t = at((s) => {
      s.print.rows['6'] = { ...s.print.rows['6'], sizeDeltaPt: -2, numberColor: 'C00000', italic: true }
      s.print.numbers.underline = true
    })
    expect(t.prizeRows['6']).toMatchObject({ size: t.numberSize - 4, numberColor: 'C00000', italic: true, underline: true, bold: true })
    expect(t.prizeRows['5']).toMatchObject({ numberColor: '000000', italic: false, underline: true })
  })
})

describe('dàn cụm phiếu theo cột / theo hàng', () => {
  const day26 = parseResults(HTML_26, D26)
  const at = (paper: 'A4' | 'A5' | 'A6', edit: (s: ReturnType<typeof agentSettings>) => void) => {
    const s = agentSettings()
    edit(s)
    return buildSheet(s, day26, { date: D26, paper, blank: false }).layout
  }
  const usableW = PAPER_SPECS.A4.w - 2 * PAGE_MARGIN
  const usableH = PAPER_SPECS.A4.h - 2 * PAGE_MARGIN

  it('Hai bên: hai cột sát hai lề, khoảng giữa nới ra', () => {
    const l = at('A4', (s) => { s.print.cardAlign = 'between' })
    expect([l.margin.left, l.margin.right]).toEqual([PAGE_MARGIN, PAGE_MARGIN])
    expect(l.gapX).toBe(usableW - 2 * l.cardW)
    expect(l.cardAlign).toBe('center')
  })

  it('Đều: phần trống chia đều cho hai lề và khoảng giữa; không nhỏ hơn khoảng đã đặt', () => {
    const l = at('A4', (s) => { s.print.cardAlign = 'even' })
    const s3 = Math.trunc((usableW - 2 * l.cardW) / 3)
    expect(l.gapX).toBe(s3)
    expect(l.margin.left - PAGE_MARGIN).toBe(Math.trunc((usableW - 2 * l.cardW - s3) / 2))
    expect(l.margin.left + l.margin.right + l.gapX + 2 * l.cardW).toBe(PAPER_SPECS.A4.w)
    // phiếu rộng gần hết trang: khoảng đã đặt (0,6 cm) là tối thiểu
    const wide = at('A4', (s) => { s.print.cardAlign = 'even'; s.print.cardWidthCm = null })
    expect(wide.gapX).toBe(340)
  })

  it('theo hàng: khoảng trống phía trên và khoảng giữa hai hàng khi phiếu thấp', () => {
    const base = at('A4', (s) => { s.print.cardHeightCm = 10 })
    const free = usableH - 2 * base.cardH - base.gapY
    expect(base.topPad).toBe(0)
    expect(at('A4', (s) => { s.print.cardHeightCm = 10; s.print.cardAlignY = 'bottom' }).topPad).toBe(free)
    expect(at('A4', (s) => { s.print.cardHeightCm = 10; s.print.cardAlignY = 'center' }).topPad).toBe(Math.trunc(free / 2))
    const between = at('A4', (s) => { s.print.cardHeightCm = 10; s.print.cardAlignY = 'between' })
    expect([between.topPad, between.gapY]).toEqual([0, base.gapY + free])
    const even = at('A4', (s) => { s.print.cardHeightCm = 10; s.print.cardAlignY = 'even' })
    expect(even.gapY).toBe(Math.trunc((usableH - 2 * base.cardH) / 3))
    expect(2 * even.topPad + 2 * even.cardH + even.gapY).toBeLessThanOrEqual(usableH)
  })

  it('khổ một cột / một hàng: Hai bên, Đều như Giữa', () => {
    const mid = at('A6', (s) => { s.print.cardAlign = 'center'; s.print.cardHeightCm = 10 })
    for (const pos of ['between', 'even'] as const) {
      const l = at('A6', (s) => { s.print.cardAlign = pos; s.print.cardAlignY = pos; s.print.cardHeightCm = 10 })
      expect(l.header.indent).toEqual(mid.header.indent)
      expect(l.cardAlign).toBe('center')
      expect(l.topPad).toBe(Math.trunc((PAPER_SPECS.A6.h - 2 * PAGE_MARGIN - l.cardH) / 2))
    }
  })
})
