import { dirname } from 'node:path'
import { createRequire } from 'node:module'
import { describe, expect, it } from 'vitest'
import { loadFontCss } from '../src/core/fonts'
import { parseResults } from '../src/core/parse'
import { renderHtml } from '../src/core/render-html'
import { buildSheet, outputBaseName } from '../src/core/sheet'
import { agentSettings, D26, HTML_26 } from './helpers'

const require = createRequire(import.meta.url)
const day26 = parseResults(HTML_26, D26)
const count = (s: string, re: RegExp) => s.match(re)?.length ?? 0

describe('renderHtml', () => {
  it('A4: đúng khổ giấy, 4 phiếu 2 cột, chiều cao hàng lấy từ layout', () => {
    const { layout } = buildSheet(agentSettings(), day26, { date: D26, paper: 'A4', blank: false })
    const html = renderHtml(layout)
    expect(html).toContain('@page{size:210mm 297mm;margin:0}')
    expect(count(html, /<section class="card">/g)).toBe(4)
    expect(count(html, /<div class="col">/g)).toBe(2)
    expect(count(html, /<div class="gap">/g)).toBe(2)
    expect(count(html, /class="tr"/g)).toBe(40)
    for (const r of layout.table.rows) expect(html).toContain(`height:${r.height / 20}pt`)
    expect(html).toContain('padding:22.7pt 102pt 22.7pt 22.7pt')
    expect(html).toContain('font-size:13.5pt;line-height:14.85pt')
    expect(html).toContain('>472899<')
    expect(html).toContain("font-family:'Tinos', 'Times New Roman'")
  })

  it('A5 ngang, A6 đứng', () => {
    const a5 = buildSheet(agentSettings(), day26, { date: D26, paper: 'A5', blank: false }).layout
    expect(renderHtml(a5)).toContain('@page{size:210mm 148mm;margin:0}')
    const a6 = buildSheet(agentSettings(), day26, { date: D26, paper: 'A6', blank: false }).layout
    const html = renderHtml(a6)
    expect(html).toContain('@page{size:105mm 148mm;margin:0}')
    expect(count(html, /<section class="card">/g)).toBe(1)
    expect(html).toContain('padding-left:0pt;padding-right:25.45pt')
  })

  it('chế độ một phiếu (xem trước ở Cài đặt): không có @page', () => {
    const { layout } = buildSheet(agentSettings(), day26, { date: D26, paper: 'A4', blank: false })
    const html = renderHtml(layout, { mode: 'card' })
    expect(html).not.toContain('@page')
    expect(count(html, /<section class="card">/g)).toBe(1)
  })

  it('escape chữ người dùng nhập và nhúng font', () => {
    const s = agentSettings()
    s.header.name.value = '<b>A</b>'
    const { layout } = buildSheet(s, day26, { date: D26, paper: 'A6', blank: true })
    const html = renderHtml(layout, { fontCss: '@font-face{font-family:Tinos}' })
    expect(html).toContain('&lt;b&gt;A&lt;/b&gt;')
    expect(html).toContain('@font-face{font-family:Tinos}')
    expect(html).not.toContain('472899')
  })
})

describe('loadFontCss', () => {
  it('nhúng subset latin, latin-ext, vietnamese dạng data URI', () => {
    const dir = dirname(require.resolve('@fontsource/tinos/package.json'))
    const css = loadFontCss('Times New Roman', dir)
    expect(count(css, /@font-face/g)).toBe(3)
    expect(count(css, /data:font\/woff2;base64,/g)).toBe(3)
    expect(css).toContain("font-family:'Tinos'")
    expect(css).toContain('font-weight:700')
    expect(css).toContain('U+1EA0-1EF9') // dải chữ Việt
    expect(css).not.toContain('./files/')
  })

  it('Arial → Arimo', () => {
    const dir = dirname(require.resolve('@fontsource/arimo/package.json'))
    expect(loadFontCss('Arial', dir)).toContain("font-family:'Arimo'")
  })
})

describe('outputBaseName', () => {
  it('tên file theo ngày, khổ, phiếu trống', () => {
    expect(outputBaseName({ date: D26, paper: 'A4', blank: false })).toBe('xsmn_26-10-2026_A4')
    expect(outputBaseName({ date: D26, paper: 'A6', blank: true })).toBe('xsmn_26-10-2026_A6_trong')
  })
})
