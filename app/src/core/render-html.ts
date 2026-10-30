// Trang HTML in phiếu (xem trước, PDF, in) từ layout (SPEC §8.1).
// Mọi kích thước lấy từ layout (twips ÷ 20 = pt) nên bản PDF khớp bản Word.

import type { CellBox, SheetLayout } from './layout'
import { CELL_MARGIN, DB_LABEL_SIZE, LABEL_AFTER, LABEL_SIZE, SPACER_H } from './layout'
import { PRIZES } from './stations'

export interface HtmlOptions {
  /** sheet = cả trang in; card = một phiếu (xem trước ở màn Cài đặt). */
  mode?: 'sheet' | 'card'
  docTitle?: string
}

/**
 * font-family cho font máy: tên font (trong nháy đơn) + họ font chung làm dự phòng khi máy
 * không có font đó. Renderer dùng đúng chuỗi này để đo bề rộng chữ.
 */
export function fontFamilyCss(font: string): string {
  const generic = /mono|courier|consol|menlo/i.test(font)
    ? 'monospace'
    : /sans|arial|helvetica|verdana|tahoma|segoe|calibri|roboto|ubuntu|trebuchet/i.test(font)
      ? 'sans-serif'
      : 'serif'
  return `'${font.replace(/['\\]/g, '\\$&')}', ${generic}`
}

export function htmlEscape(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;')
}

/** twips → "12.35pt" */
const pt = (tw: number) => `${Number((tw / 20).toFixed(2))}pt`
/** half-point → "13.5pt" */
const hp = (size: number) => `${size / 2}pt`

function headerHtml(l: SheetLayout, withIndent: boolean): string {
  const { left, right } = withIndent ? l.header.indent : { left: 0, right: 0 }
  const pad = left || right ? ` style="padding-left:${pt(left)};padding-right:${pt(right)}"` : ''
  if (!l.header.lines.length) return `<div class="head"${pad}><div style="height:${pt(SPACER_H)}"></div></div>`
  const lines = l.header.lines
    .map((line) => {
      const maxSize = Math.max(...line.runs.map((r) => r.size))
      const runs = line.runs.map((r) => `<span style="font-size:${hp(r.size)}">${htmlEscape(r.text)}</span>`).join('')
      const align = line.align === 'center' ? '' : `;text-align:${line.align}`
      return `<p style="font-size:${hp(maxSize)};line-height:${pt(line.lineH)};margin-bottom:${pt(line.after)}${align}">${runs}</p>`
    })
    .join('')
  return `<div class="head"${pad}>${lines}</div>`
}

function tableHtml(l: SheetLayout): string {
  const t = l.table
  const cols = `grid-template-columns:${pt(t.labW)}${` ${pt(t.stW)}`.repeat(l.stations.length)}`
  const jc = l.cardAlign === 'center' ? 'margin-left:auto;margin-right:auto' : l.cardAlign === 'right' ? 'margin-left:auto' : ''
  const [hdr, ...prizeRows] = t.rows

  let rows = `<div class="tr" style="height:${pt(hdr.height)};${cols}">`
  rows += `<div class="td hd t-text"><p style="font-size:${hp(LABEL_SIZE)}">${hdr.label}</p></div>`
  for (const st of l.stations) {
    rows += `<div class="td hd t-text"><p style="font-size:${hp(t.stationSize)}">${htmlEscape(st.short)}</p></div>`
  }
  rows += '</div>'

  PRIZES.forEach((k, i) => {
    const row = prizeRows[i]
    const isDb = k === 'db'
    rows += `<div class="tr" style="height:${pt(row.height)};${cols}">`
    const labStyle = isDb ? `font-size:${hp(DB_LABEL_SIZE)}` : `font-size:${hp(LABEL_SIZE)};margin-bottom:${pt(LABEL_AFTER)}`
    const lab = `<p style="${labStyle}">${row.label}</p>`
    rows += `<div class="td lab t-text">${lab}</div>`
    const numStyle = isDb
      ? `font-size:${hp(t.dbSize)};line-height:${pt(t.dbLine)}`
      : `font-size:${hp(t.numberSize)};line-height:${pt(t.numberLine)}`
    for (const st of l.stations) {
      const nums = st.prizes[k].map((n) => `<p style="${numStyle}">${htmlEscape(n)}</p>`).join('')
      rows += `<div class="td n-text${isDb ? ' db' : ''}">${nums}</div>`
    }
    rows += '</div>'
  })
  return `<div class="tbl" style="width:${pt(t.width)};${jc}">${rows}</div>`
}

function cardHtml(l: SheetLayout, withIndent: boolean): string {
  return `<section class="card">${headerHtml(l, withIndent)}${tableHtml(l)}</section>`
}

const JUSTIFY = { top: 'flex-start', center: 'center', bottom: 'flex-end' } as const

/** Lề trong ô = lề mặc định + phần padding dư (cùng con số với thụt lề / khoảng đoạn bên Word). */
function cellPadding(box: CellBox, vertical: boolean): string {
  const m = CELL_MARGIN
  const top = m.top + (vertical ? box.padTop : 0)
  const bottom = m.bottom + (vertical ? box.padBottom : 0)
  return `padding:${pt(top)} ${pt(m.right + box.indentRight)} ${pt(bottom)} ${pt(m.left + box.indentLeft)}`
}

function styles(l: SheetLayout, mode: 'sheet' | 'card'): string {
  const c = l.colors
  const t = l.table
  const page =
    mode === 'sheet'
      ? `@page{size:${l.page.widthMm}mm ${l.page.heightMm}mm;margin:0}
.page{width:${l.page.widthMm}mm;height:${l.page.heightMm}mm;box-sizing:border-box;overflow:hidden;
padding:${pt(l.margin.top)} ${pt(l.margin.right)} ${pt(l.margin.bottom)} ${pt(l.margin.left)};display:flex;column-gap:${pt(l.gapX)}}
.col{flex:none;width:${pt(l.colW)};display:flex;flex-direction:column}
.gap{flex:none;height:${pt(l.gapY)}}`
      : `.page{width:${pt(l.cardW)};height:${pt(l.cardH)};overflow:hidden}`
  return `${page}
html,body{margin:0;padding:0;background:#fff}
@media screen{html,body{overflow:hidden}}
body{font-family:${fontFamilyCss(l.font)};font-weight:700;color:#${c.text};
-webkit-print-color-adjust:exact;print-color-adjust:exact;font-kerning:normal;text-rendering:geometricPrecision}
p{margin:0}
.head{text-align:center;white-space:pre-wrap;color:#${c.text}}
.head span{line-height:1}
.tbl{outline:0.75pt solid #${c.border};outline-offset:-0.375pt}
.tr{display:grid;box-sizing:border-box;overflow:hidden}
.tr+.tr{border-top:0.75pt solid #${c.border}}
.td{box-sizing:border-box;min-width:0;overflow:hidden;display:flex;flex-direction:column;color:#${c.accent}}
.td+.td{border-left:0.75pt solid #${c.border}}
.td.hd{justify-content:center;${cellPadding(t.text, false)}}
.t-text{text-align:${t.text.alignX};overflow-wrap:anywhere}
.td.lab{justify-content:${JUSTIFY[t.text.alignY]};${cellPadding(t.text, true)}}
.n-text{text-align:${t.number.alignX};color:#${c.number};justify-content:${JUSTIFY[t.number.alignY]};${cellPadding(t.number, true)}}
.n-text p{white-space:nowrap}
.n-text.db{color:#${c.accent}}`
}

export function renderHtml(l: SheetLayout, opts: HtmlOptions = {}): string {
  const mode = opts.mode ?? 'sheet'
  let body: string
  if (mode === 'card') {
    body = `<div class="page">${cardHtml(l, false)}</div>`
  } else {
    const cols: string[] = []
    for (let c = 0; c < l.ncol; c++) {
      const cards: string[] = []
      for (let r = 0; r < l.nrow; r++) cards.push(cardHtml(l, true))
      cols.push(`<div class="col">${cards.join(l.gapY > 0 ? '<div class="gap"></div>' : '')}</div>`)
    }
    body = `<div class="page">${cols.join('')}</div>`
  }
  const title = htmlEscape(opts.docTitle ?? `Kết quả XSMN ${l.title}`)
  return `<!doctype html>
<html lang="vi"><head><meta charset="utf-8"><title>${title}</title>
<style>${styles(l, mode)}</style></head>
<body>${body}</body></html>
`
}
