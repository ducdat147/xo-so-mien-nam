import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import JSZip from 'jszip'
import { XMLValidator } from 'fast-xml-parser'
import { describe, expect, it } from 'vitest'
import { parseResults } from '../src/core/parse'
import { documentXml, renderDocx } from '../src/core/render-docx'
import { defaultSettings, importConf, type Paper, type Settings } from '../src/core/settings'
import { buildSheet } from '../src/core/sheet'
import { agentSettings, D24, D26, GOLDEN, HTML_24, HTML_26 } from './helpers'

const day26 = parseResults(HTML_26, D26)
const day24 = parseResults(HTML_24, D24)
const golden = (name: string) => readFileSync(join(GOLDEN, `${name}.document.xml`), 'utf8')

/** Cài đặt tương đương chạy bản bash với golden/custom.conf (bash không có config thì không có fax). */
function customSettings(): Settings {
  // cỡ chữ đầu phiếu như bản bash; bash không có config thì không có fax
  const base = agentSettings()
  base.header.fax.value = ''
  return importConf(readFileSync(join(GOLDEN, 'custom.conf'), 'utf8'), base).settings
}

describe('render-docx giống hệt build_docx của cli/xsmn.sh', () => {
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
    s.print.cardGapCm = 0
    const { layout } = buildSheet(s, day26, { date: D26, paper: 'A4', blank: false })
    const xml = documentXml(layout)
    expect(XMLValidator.validate(xml)).toBe(true)
    expect(xml).not.toContain('</w:tbl><w:tbl>')
    expect(xml.match(/w:type="column"/g)).toHaveLength(1)
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
