// Trang HTML in phiếu (xem trước, PDF, in) từ layout (SPEC §8.1).
// Mọi kích thước lấy từ layout (twips ÷ 20 = pt) nên bản PDF khớp bản Word.

import type { CellBox, SheetLayout } from './layout'
import { CELL_MARGIN, LABEL_AFTER, SPACER_H } from './layout'
import { PRIZES } from './stations'

export interface HtmlOptions {
  /** sheet = cả trang in; card = một phiếu (xem trước ở màn Cài đặt). */
  mode?: 'sheet' | 'card'
  docTitle?: string
  /** Gắn data-part cho từng phần của phiếu (trình sửa phiếu bấm chọn được); bản in không cần. */
  parts?: boolean
}

/** ` data-part="…"` khi bật đánh dấu phần, rỗng khi không. */
const partAttr = (on: boolean, part: string) => (on ? ` data-part="${part}"` : '')

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

/** Màu và kiểu chữ (chữ trên phiếu mặc định đậm, đen theo body). */
const ink = (st: { color: string; bold: boolean; italic?: boolean; underline?: boolean }) =>
  `;color:#${st.color}${st.bold ? '' : ';font-weight:400'}${st.italic ? ';font-style:italic' : ''}${st.underline ? ';text-decoration:underline' : ''}`

function headerHtml(l: SheetLayout, withIndent: boolean, parts: boolean, footer = false): string {
  const { left, right } = withIndent ? l.header.indent : { left: 0, right: 0 }
  const pad = left || right ? ` style="padding-left:${pt(left)};padding-right:${pt(right)}"` : ''
  const src = footer ? l.footer.lines : l.header.lines
  if (footer && !src.length) return ''
  if (!src.length) return `<div class="head"${pad}><div style="height:${pt(SPACER_H)}"></div></div>`
  const prefix = footer ? 'foot' : 'line'
  const lines = src
    .map((line) => {
      const maxSize = Math.max(...line.runs.map((r) => r.size))
      const runs = line.runs.map((r) => `<span style="font-size:${hp(r.size)}${ink(r)}">${htmlEscape(r.text)}</span>`).join('')
      const align = line.align === 'center' ? '' : `;text-align:${line.align}`
      return `<p${partAttr(parts, `${prefix}-${line.id}`)} style="font-size:${hp(maxSize)};line-height:${pt(line.lineH)};margin-bottom:${pt(line.after)}${align}">${runs}</p>`
    })
    .join('')
  return `<div class="head"${pad}>${lines}</div>`
}

function tableHtml(l: SheetLayout, parts: boolean): string {
  const t = l.table
  const cols = `grid-template-columns:${pt(t.labW)}${` ${pt(t.stW)}`.repeat(l.stations.length)}`
  const jc = l.cardAlign === 'center' ? 'margin-left:auto;margin-right:auto' : l.cardAlign === 'right' ? 'margin-left:auto' : ''
  const [hdr, ...prizeRows] = t.rows

  let rows = `<div class="tr"${partAttr(parts, 'hdr')} style="height:${pt(hdr.height)};${cols}">`
  const hs = ink(t.head)
  rows += `<div class="td hd t-text"><p style="font-size:${hp(t.head.labelSize)}${hs}">${hdr.label}</p></div>`
  for (const st of l.stations) {
    rows += `<div class="td hd t-text"><p style="font-size:${hp(t.stationSize)}${hs}">${htmlEscape(st.short)}</p></div>`
  }
  rows += '</div>'

  PRIZES.forEach((k, i) => {
    const row = prizeRows[i]
    const r = t.prizeRows[k]
    const fill = r.fill ? ` style="background:#${r.fill}"` : ''
    rows += `<div class="tr"${partAttr(parts, `row-${k}`)} style="height:${pt(row.height)};${cols}">`
    const after = k === 'db' ? '' : `;margin-bottom:${pt(LABEL_AFTER)}`
    const lab = `<p style="font-size:${hp(r.labelSize)}${after}${ink({ color: r.labelColor, bold: r.labelBold })}">${row.label}</p>`
    rows += `<div class="td lab t-text"${partAttr(parts, 'labels')}${fill}>${lab}</div>`
    const numStyle = `font-size:${hp(r.size)};line-height:${pt(r.line)}${ink({ ...r, color: r.numberColor })}`
    for (const st of l.stations) {
      const nums = st.prizes[k].map((n) => `<p style="${numStyle}">${htmlEscape(n)}</p>`).join('')
      rows += `<div class="td n-text"${partAttr(parts, 'numbers')}${fill}>${nums}</div>`
    }
    rows += '</div>'
  })
  return `<div class="tbl"${partAttr(parts, 'table')} style="width:${pt(t.width)};${jc}">${rows}</div>`
}

function cardHtml(l: SheetLayout, withIndent: boolean, parts = false): string {
  return `<section class="card">${headerHtml(l, withIndent, parts)}${tableHtml(l, parts)}${headerHtml(l, withIndent, parts, true)}</section>`
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
  const t = l.table
  const border = l.borderColor
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
body{font-family:${fontFamilyCss(l.font)};font-weight:700;color:#000;
-webkit-print-color-adjust:exact;print-color-adjust:exact;font-kerning:normal;text-rendering:geometricPrecision}
p{margin:0}
.head{text-align:center;white-space:pre-wrap}
.head span{line-height:1}
.tbl{outline:0.75pt solid #${border};outline-offset:-0.375pt}
.tr{display:grid;box-sizing:border-box;overflow:hidden}
.tr+.tr{border-top:0.75pt solid #${border}}
.td{box-sizing:border-box;min-width:0;overflow:hidden;display:flex;flex-direction:column}
.td+.td{border-left:0.75pt solid #${border}}
.td.hd{justify-content:center;${cellPadding(t.text, false)}}
.t-text{text-align:${t.text.alignX};overflow-wrap:anywhere}
.td.lab{justify-content:${JUSTIFY[t.text.alignY]};${cellPadding(t.text, true)}}
.n-text{text-align:${t.number.alignX};justify-content:${JUSTIFY[t.number.alignY]};${cellPadding(t.number, true)}}
.n-text p{white-space:nowrap}`
}

export function renderHtml(l: SheetLayout, opts: HtmlOptions = {}): string {
  const mode = opts.mode ?? 'sheet'
  let body: string
  if (mode === 'card') {
    body = `<div class="page"${partAttr(!!opts.parts, 'card')}>${cardHtml(l, false, !!opts.parts)}</div>`
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
