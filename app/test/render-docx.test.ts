import { readFileSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import JSZip from 'jszip'
import { XMLValidator } from 'fast-xml-parser'
import { describe, expect, it } from 'vitest'
import { parseResults } from '../src/core/parse'
import { documentXml, renderDocx } from '../src/core/render-docx'
import { renderHtml } from '../src/core/render-html'
import { importConf } from '../src/core/conf'
import { defaultSettings, newFreeLine, type Paper, type Settings } from '../src/core/settings'
import { buildSheet } from '../src/core/sheet'
import { agentSettings, D24, D26, GOLDEN, HTML_24, HTML_26 } from './helpers'

const day26 = parseResults(HTML_26, D26)
const day24 = parseResults(HTML_24, D24)
const golden = (name: string) => readFileSync(join(GOLDEN, `${name}.document.xml`), 'utf8')

/** Cài đặt tương đương chạy bản bash với golden/custom.conf. */
function customSettings(): Settings {
  // cỡ chữ đầu phiếu như bản bash
  const base = agentSettings()
  return importConf(readFileSync(join(GOLDEN, 'custom.conf'), 'utf8'), base).settings
}

/** Màu, kiểu chữ riêng từng phần và từng hàng giải (cài đặt bản 3, không có ở bản bash). */
function styledSettings(): Settings {
  const s = customSettings()
  s.header.label = { ...s.header.label, bold: false, italic: true }
  s.header.date.color = '7F1D1D'
  s.print.headRow = { labelSize: 11, color: '1D4ED8', bold: false }
  s.print.prizeLabels = { ...s.print.prizeLabels, size: 11, dbSize: 15 }
  s.print.numbers = { ...s.print.numbers, italic: true }
  s.print.rows.db = { sizeDeltaPt: 2, numberColor: 'C00000', labelColor: 'C00000', bold: null, italic: false, underline: true, fill: 'F3F4F6' }
  s.print.rows['4'] = { ...s.print.rows['4'], sizeDeltaPt: -1, bold: false }
  return s
}

/** Label dòng địa chỉ, dòng tự do xen giữa phần đầu và hai dòng dưới bảng (cài đặt bản 4). */
function linesSettings(): Settings {
  const s = agentSettings()
  s.header.addr.value = 'Chợ Tapao - Đ.Kho - T.Linh – B.Thuận'
  s.header.addrLabel = { ...s.header.addrLabel, value: 'ĐC:', size: 7.5, bold: false }
  s.header.extra = [{ ...newFreeLine('h1'), text: { ...newFreeLine('h1').text, value: 'Zalo: 0983 019 343', size: 8 } }]
  s.header.order = ['name', 'h1', 'addr', 'contact']
  s.header.footer = [
    { ...newFreeLine('f1'), text: { ...newFreeLine('f1').text, value: 'Chúc quý khách may mắn!', bold: false, italic: true } },
    { ...newFreeLine('f2'), label: { ...newFreeLine('f2').label, value: 'Lưu ý:', size: 8 }, text: { ...newFreeLine('f2').text, value: 'Vé rách, mất góc không đổi thưởng', size: 8 }, align: 'left' }
  ]
  return s
}

// test/golden/*.document.xml: bản chụp file Word do bản bash cũ (build_docx, nay đã bỏ) sinh ra.
// App phải ra giống hệt từng ký tự. Cố ý đổi bố cục thì cập nhật bản chụp: `make golden`
// (UPDATE_GOLDEN=1) rồi xem kỹ diff trước khi commit.
describe('render-docx giống hệt bản chụp chuẩn (từ bản bash cũ, styled-A4 từ app)', () => {
  const cases: [string, () => Settings, typeof day26, typeof D26, Paper][] = [
    ['default-A4', agentSettings, day26, D26, 'A4'],
    ['default-A5', agentSettings, day26, D26, 'A5'],
    ['default-A6', agentSettings, day26, D26, 'A6'],
    ['default-A4-4dai', agentSettings, day24, D24, 'A4'],
    ['custom-A4', customSettings, day26, D26, 'A4'],
    ['custom-A6', customSettings, day26, D26, 'A6'],
    // bản chụp của app (bản bash không có màu, kiểu chữ riêng từng phần)
    ['styled-A4', styledSettings, day26, D26, 'A4'],
    ['lines-A4', linesSettings, day26, D26, 'A4']
  ]
  for (const [name, settings, day, date, paper] of cases) {
    it(name, () => {
      const { layout } = buildSheet(settings(), day, { date, paper, blank: false })
      if (process.env.UPDATE_GOLDEN) writeFileSync(join(GOLDEN, `${name}.document.xml`), documentXml(layout))
      expect(documentXml(layout)).toBe(golden(name))
    })
  }
})

describe('dòng tự do', () => {
  it('dòng cuối phiếu nằm ngay sau bảng của từng phiếu, trước khoảng cách / ngắt cột của phiếu sau', () => {
    const { layout } = buildSheet(linesSettings(), day26, { date: D26, paper: 'A4', blank: false })
    const xml = documentXml(layout)
    expect(xml.match(/<\/w:tbl><w:p><w:pPr>[^]*?Chúc quý khách may mắn!/g)).toHaveLength(4)
    // Label và Text cùng cỡ, cùng kiểu thì gộp một run như bản bash
    expect(xml).toContain('<w:t xml:space="preserve">Lưu ý: Vé rách, mất góc không đổi thưởng</w:t>')
    expect(XMLValidator.validate(xml)).toBe(true)
    // thứ tự phần đầu theo order: tên, dòng tự do, địa chỉ có Label
    const head = layout.header.lines.map((l) => l.id)
    expect(head).toEqual(['name', 'h1', 'addr', 'contact', 'date'])
    expect(layout.header.lines[2].runs.map((r) => r.text)).toEqual(['ĐC: ', 'Chợ Tapao - Đ.Kho - T.Linh – B.Thuận'])
  })

  it('dòng cuối phiếu trừ vào chiều cao bảng', () => {
    const plain = buildSheet(agentSettings(), day26, { date: D26, paper: 'A4', blank: false }).layout
    const l = buildSheet(linesSettings(), day26, { date: D26, paper: 'A4', blank: false }).layout
    expect(l.footer.height).toBeGreaterThan(0)
    expect(l.table.available).toBe(plain.cardH - l.header.height - l.footer.height - 160)
    expect(l.table.available).toBeLessThan(plain.table.available)
  })
})

describe('dàn cụm phiếu theo hàng', () => {
  it('đoạn đệm ở đầu mỗi cột, ngắt cột nằm trong đoạn đệm; HTML có khoảng trống đầu cột', () => {
    const s = agentSettings()
    s.print.cardHeightCm = 10
    s.print.cardAlignY = 'even'
    const { layout } = buildSheet(s, day26, { date: D26, paper: 'A4', blank: false })
    const xml = documentXml(layout)
    const pad = `<w:p><w:pPr><w:spacing w:before="0" w:after="0" w:line="${layout.topPad}" w:lineRule="exact"/></w:pPr>`
    expect(xml).toContain(`<w:body>${pad}</w:p>`)
    expect(xml).toContain(`${pad}<w:r><w:br w:type="column"/></w:r></w:p>`)
    expect(xml.match(/w:type="column"/g)).toHaveLength(1)
    expect(XMLValidator.validate(xml)).toBe(true)
    expect(renderHtml(layout).match(/<div class="top" style="height:/g)).toHaveLength(2)
  })
})

describe('màu, kiểu chữ riêng từng phần', () => {
  it('ô hàng ĐB có w:shd giữa tcW và vAlign; run có đúng thứ tự b, i, color, sz, u', () => {
    const { layout } = buildSheet(styledSettings(), day26, { date: D26, paper: 'A4', blank: false })
    const xml = documentXml(layout)
    expect(xml).toMatch(/<w:tcW w:w="\d+" w:type="dxa"\/><w:shd w:val="clear" w:color="auto" w:fill="F3F4F6"\/><w:vAlign/)
    expect(xml).toMatch(/<w:rPr><w:b\/><w:bCs\/><w:color w:val="C00000"\/><w:sz w:val="\d+"\/><w:szCs w:val="\d+"\/><w:u w:val="single"\/><\/w:rPr><w:t xml:space="preserve">472899/)
    // hàng Tư bỏ đậm, số nghiêng theo mức chung
    expect(xml).toMatch(/<w:rPr><w:i\/><w:iCs\/><w:color w:val="000000"\/><w:sz w:val="\d+"\/><w:szCs w:val="\d+"\/><\/w:rPr><w:t xml:space="preserve">78899/)
    expect(XMLValidator.validate(xml)).toBe(true)
  })
})

async function unzip(bytes: Uint8Array) {
  const zip = await JSZip.loadAsync(bytes)
  const files: Record<string, string> = {}
  for (const name of Object.keys(zip.files)) if (!zip.files[name].dir) files[name] = await zip.files[name].async('string')
  return { names: Object.keys(zip.files).filter((n) => !zip.files[n].dir), files }
}

/** Tên các phần tử con trực tiếp của mọi <w:tblPr> trong tài liệu. */
function tblPrChildren(xml: string): string[][] {
  return [...xml.matchAll(/<w:tblPr>(.*?)<\/w:tblPr>/g)].map(([, inner]) => {
    const names: string[] = []
    let depth = 0
    for (const [, close, name, self] of inner.matchAll(/<(\/?)(w:\w+)[^>]*?(\/?)>/g)) {
      if (close) { depth--; continue }
      if (depth === 0) names.push(name)
      if (!self) depth++
    }
    return names
  })
}

describe('renderDocx', () => {
  it('gói zip đủ phần, XML hợp lệ, đúng thứ tự phần tử trong tblPr', async () => {
    const { layout } = buildSheet(agentSettings(), day26, { date: D26, paper: 'A4', blank: false })
    const { names, files } = await unzip(await renderDocx(layout, { now: new Date('2026-10-26T10:00:00Z') }))
    expect(names[0]).toBe('[Content_Types].xml')
    expect(names.sort()).toEqual(
      ['[Content_Types].xml', '_rels/.rels', 'docProps/core.xml', 'word/_rels/document.xml.rels', 'word/document.xml', 'word/styles.xml'].sort()
    )
    for (const [name, xml] of Object.entries(files)) expect(XMLValidator.validate(xml), name).toBe(true)

    const doc = files['word/document.xml']
    const orders = tblPrChildren(doc)
    expect(orders).toHaveLength(4)
    for (const o of orders) expect(o).toEqual(['w:tblW', 'w:jc', 'w:tblBorders', 'w:tblLayout', 'w:tblCellMar'])
    expect(doc.match(/w:type="column"/g)).toHaveLength(1)
    expect(doc.match(/w:hRule="exact"/g)).toHaveLength(40)
    expect(doc.match(/<w:cantSplit\/>/g)).toHaveLength(40)
    expect(files['word/styles.xml']).toContain('w:ascii="Times New Roman"')
    expect(files['docProps/core.xml']).toContain('<dc:title>Kết quả XSMN Thứ Hai (26-10-2026)</dc:title>')
    expect(files['docProps/core.xml']).toContain('2026-10-26T10:00:00Z')
  })

  it('font Word dùng tên thật (Arial), không phải Arimo', async () => {
    const s = defaultSettings()
    s.print.font = 'Arial'
    const { layout } = buildSheet(s, day26, { date: D26, paper: 'A6', blank: false })
    const { files } = await unzip(await renderDocx(layout))
    expect(files['word/styles.xml']).toContain('w:ascii="Arial"')
    expect(files['word/document.xml']).not.toMatch(/Arimo|Tinos/)
  })

  it('đầu phiếu căn từng dòng theo cài đặt', () => {
    const s = agentSettings()
    s.header.addr.align = 'left'
    s.header.date.align = 'right'
    const { layout } = buildSheet(s, day26, { date: D26, paper: 'A6', blank: false })
    const xml = documentXml(layout)
    const jc = (text: string) => xml.match(new RegExp(`<w:jc w:val="(\\w+)"/></w:pPr>(?:(?!</w:p>).)*${text}`))?.[1]
    expect([jc('ĐỨC QUYẾT'), jc('ĐC: Chợ Tapao'), jc('DĐ: 01212'), jc('Thứ Hai')]).toEqual(['center', 'left', 'center', 'right'])
  })

  it('ẩn hết các dòng ẩn được, khoảng cách 0: vẫn có đoạn ngăn giữa hai bảng', () => {
    const s = defaultSettings()
    for (const k of ['label', 'name', 'addr', 'contact'] as const) s.header[k].show = false
    s.print.cardGapXCm = 0
    s.print.cardGapYCm = 0
    const { layout } = buildSheet(s, day26, { date: D26, paper: 'A4', blank: false })
    const xml = documentXml(layout)
    expect(XMLValidator.validate(xml)).toBe(true)
    expect(xml).not.toContain('</w:tbl><w:tbl>')
    expect(xml.match(/w:type="column"/g)).toHaveLength(1)
  })

  it('số căn giữa-dưới, chữ căn trái-giữa: vAlign và thụt lề theo phía được căn', () => {
    const s = agentSettings()
    s.print.numberCell = { padXCm: 0.3, padYCm: 0.2, alignX: 'center', alignY: 'bottom' }
    s.print.textCell = { padXCm: 0.3, padYCm: 0.05, alignX: 'left', alignY: 'center' }
    const xml = documentXml(buildSheet(s, day26, { date: D26, paper: 'A4', blank: false }).layout)
    expect(XMLValidator.validate(xml)).toBe(true)
    expect(xml).toContain('<w:ind w:left="142" w:right="142"/><w:jc w:val="center"/>')
    expect(xml).toContain('<w:ind w:left="142" w:right="0"/><w:jc w:val="left"/>')
    expect(xml).toContain('<w:vAlign w:val="bottom"/>')
    // padding dọc của số: khoảng sau đoạn cuối ô (căn dưới)
    expect(xml).toContain('w:before="0" w:after="83" w:line=')
  })

  it('khoảng cách ngang vào w:cols, dọc vào đoạn đệm giữa 2 phiếu', () => {
    const s = agentSettings()
    s.print.cardGapXCm = 1
    s.print.cardGapYCm = 0.2
    const xml = documentXml(buildSheet(s, day26, { date: D26, paper: 'A4', blank: false }).layout)
    expect(xml).toContain('<w:cols w:num="2" w:space="567"/>')
    expect(xml).toContain('w:line="113" w:lineRule="exact"')
  })

  it('chiều cao phiếu tự chọn: XML hợp lệ, hàng bảng thấp lại', () => {
    const s = agentSettings()
    s.print.cardHeightCm = 10
    const short = documentXml(buildSheet(s, day26, { date: D26, paper: 'A4', blank: false }).layout)
    const full = documentXml(buildSheet(agentSettings(), day26, { date: D26, paper: 'A4', blank: false }).layout)
    expect(XMLValidator.validate(short)).toBe(true)
    const rowSum = (xml: string) =>
      [...xml.matchAll(/<w:trHeight w:val="(\d+)"/g)].slice(0, 10).reduce((n, m) => n + Number(m[1]), 0)
    expect(rowSum(short)).toBeLessThan(rowSum(full))
    expect(rowSum(short) + 1200 + 160).toBeLessThanOrEqual(5670)
  })

  it('phiếu trống: ô số có một đoạn rỗng, chữ đặc biệt được escape', () => {
    const s = defaultSettings()
    s.header.name.value = 'A & B <C>'
    const { layout } = buildSheet(s, day26, { date: D26, paper: 'A6', blank: true })
    const xml = documentXml(layout)
    expect(XMLValidator.validate(xml)).toBe(true)
    expect(xml).toContain('A &amp; B &lt;C&gt;')
    expect(xml).not.toContain('472899')
  })
})
