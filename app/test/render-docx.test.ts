import { readFileSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import JSZip from 'jszip'
import { XMLValidator } from 'fast-xml-parser'
import { describe, expect, it } from 'vitest'
import { parseResults } from '../src/core/parse'
import { documentXml, renderDocx } from '../src/core/render-docx'
import { importConf } from '../src/core/conf'
import { defaultSettings, type Paper, type Settings } from '../src/core/settings'
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

// test/golden/*.document.xml: bản chụp file Word do bản bash cũ (build_docx, nay đã bỏ) sinh ra.
// App phải ra giống hệt từng ký tự. Cố ý đổi bố cục thì cập nhật bản chụp: `make golden`
// (UPDATE_GOLDEN=1) rồi xem kỹ diff trước khi commit.
describe('render-docx giống hệt bản chụp chuẩn (từ bản bash cũ)', () => {
  const cases: [string, () => Settings, typeof day26, typeof D26, Paper][] = [
    ['default-A4', agentSettings, day26, D26, 'A4'],
    ['default-A5', agentSettings, day26, D26, 'A5'],
    ['default-A6', agentSettings, day26, D26, 'A6'],
    ['default-A4-4dai', agentSettings, day24, D24, 'A4'],
    ['custom-A4', customSettings, day26, D26, 'A4'],
    ['custom-A6', customSettings, day26, D26, 'A6']
  ]
  for (const [name, settings, day, date, paper] of cases) {
    it(name, () => {
      const { layout } = buildSheet(settings(), day, { date, paper, blank: false })
      if (process.env.UPDATE_GOLDEN) writeFileSync(join(GOLDEN, `${name}.document.xml`), documentXml(layout))
      expect(documentXml(layout)).toBe(golden(name))
    })
  }
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

  it('ẩn hết đầu phiếu, khoảng cách 0: vẫn có đoạn ngăn giữa hai bảng', () => {
    const s = defaultSettings()
    for (const h of Object.values(s.header)) h.show = false
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
