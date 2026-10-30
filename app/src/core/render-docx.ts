// Sinh .docx (OOXML + jszip) từ layout — port build_docx của bản bash cũ (đã bỏ; SPEC §8.2).
// Giữ nguyên cấu trúc XML của bản bash: với cùng cài đặt, document.xml giống hệt từng ký tự.

import JSZip from 'jszip'
import type { CellBox, SheetLayout } from './layout'
import { CELL_MARGIN, BORDER_SZ, LABEL_AFTER, SPACER_H } from './layout'
import { PRIZES } from './stations'
import type { Align, VAlign } from './settings'

const W_NS = 'xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"'
const XML_DECL = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n'

export function xmlEscape(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')
}

interface RunStyle {
  bold: boolean
  italic?: boolean
  underline?: boolean
}

/** Thứ tự trong w:rPr theo OOXML: b, bCs, i, iCs, color, sz, szCs, u. */
function run(text: string, color: string, size: number, st: RunStyle = { bold: true }): string {
  const b = st.bold ? '<w:b/><w:bCs/>' : ''
  const i = st.italic ? '<w:i/><w:iCs/>' : ''
  const u = st.underline ? '<w:u w:val="single"/>' : ''
  return (
    `<w:r><w:rPr>${b}${i}<w:color w:val="${color}"/><w:sz w:val="${size}"/><w:szCs w:val="${size}"/>${u}</w:rPr>` +
    `<w:t xml:space="preserve">${xmlEscape(text)}</w:t></w:r>`
  )
}

/** Đoạn văn; exact = chiều cao dòng cố định (twips), bỏ trống = dòng đơn tự động. */
function para(align: Align, after: number, runs: string, exact?: number, ind = '', before = 0): string {
  const ln = exact ? `w:line="${exact}" w:lineRule="exact"` : 'w:line="240" w:lineRule="auto"'
  return `<w:p><w:pPr><w:spacing w:before="${before}" w:after="${after}" ${ln}/>${ind}<w:jc w:val="${align}"/></w:pPr>${runs}</w:p>`
}

/** Một đoạn trong ô: nội dung + khoảng sau riêng của nó. */
interface CellPara {
  runs: string
  after: number
  exact?: number
}

/**
 * Các đoạn của một ô theo CellBox: căn ngang, thụt lề ở phía được căn, khoảng đệm dọc thành
 * khoảng trước đoạn đầu / sau đoạn cuối. `alwaysInd`: luôn ghi w:ind (ô số, giống bản bash).
 */
function cellParas(box: CellBox, items: CellPara[], alwaysInd: boolean, vertical = true): string {
  const ind =
    alwaysInd || box.indentLeft || box.indentRight ? `<w:ind w:left="${box.indentLeft}" w:right="${box.indentRight}"/>` : ''
  if (!items.length) return para(box.alignX, 0, '', undefined, ind)
  return items
    .map((it, i) => {
      const before = vertical && i === 0 ? box.padTop : 0
      const after = it.after + (vertical && i === items.length - 1 ? box.padBottom : 0)
      return para(box.alignX, after, it.runs, it.exact, ind, before)
    })
    .join('')
}

/** fill: màu nền ô (hex); w:shd đứng giữa tcW và vAlign theo OOXML. */
function cell(width: number, vAlign: VAlign, paras: string, fill: string | null = null): string {
  const shd = fill ? `<w:shd w:val="clear" w:color="auto" w:fill="${fill}"/>` : ''
  return `<w:tc><w:tcPr><w:tcW w:w="${width}" w:type="dxa"/>${shd}<w:vAlign w:val="${vAlign}"/></w:tcPr>${paras}</w:tc>`
}

const spacerPara = (h: number) =>
  `<w:p><w:pPr><w:spacing w:before="0" w:after="0" w:line="${h}" w:lineRule="exact"/></w:pPr></w:p>`

function linesXml(l: SheetLayout, lines: SheetLayout['header']['lines']): string {
  const { left, right } = l.header.indent
  const ind = left > 0 || right > 0 ? `<w:ind w:left="${left}" w:right="${right}"/>` : ''
  return lines
    .map((line) => para(line.align, line.after, line.runs.map((r) => run(r.text, r.color, r.size, r)).join(''), line.lineH, ind))
    .join('')
}

function headerXml(l: SheetLayout): string {
  return l.header.lines.length ? linesXml(l, l.header.lines) : spacerPara(SPACER_H)
}

function tableXml(l: SheetLayout): string {
  const t = l.table
  const border = l.borderColor
  const bd = `w:val="single" w:sz="${BORDER_SZ}" w:space="0" w:color="${border}"`
  const m = CELL_MARGIN
  let x =
    `<w:tbl><w:tblPr><w:tblW w:w="${t.width}" w:type="dxa"/><w:jc w:val="${l.cardAlign}"/>` +
    `<w:tblBorders><w:top ${bd}/><w:left ${bd}/><w:bottom ${bd}/><w:right ${bd}/><w:insideH ${bd}/><w:insideV ${bd}/></w:tblBorders>` +
    `<w:tblLayout w:type="fixed"/>` +
    `<w:tblCellMar><w:top w:w="${m.top}" w:type="dxa"/><w:left w:w="${m.left}" w:type="dxa"/>` +
    `<w:bottom w:w="${m.bottom}" w:type="dxa"/><w:right w:w="${m.right}" w:type="dxa"/></w:tblCellMar></w:tblPr>`
  x += `<w:tblGrid><w:gridCol w:w="${t.labW}"/>` + l.stations.map(() => `<w:gridCol w:w="${t.stW}"/>`).join('') + '</w:tblGrid>'

  const tr = (height: number, cells: string) =>
    `<w:tr><w:trPr><w:cantSplit/><w:trHeight w:val="${height}" w:hRule="exact"/></w:trPr>${cells}</w:tr>`

  const [hdr, ...prizeRows] = t.rows
  // Hàng tiêu đề (Giải, tên đài) luôn giữa ô theo chiều dọc; chỉ lấy căn ngang + padding ngang của chữ
  const head = (runs: string) => cellParas(t.text, [{ runs, after: 0 }], false, false)
  const hs = { bold: t.head.bold }
  let cells = cell(t.labW, 'center', head(run(hdr.label, t.head.color, t.head.labelSize, hs)))
  for (const st of l.stations) cells += cell(t.stW, 'center', head(run(st.short, t.head.color, t.stationSize, hs)))
  x += tr(hdr.height, cells)

  PRIZES.forEach((k, i) => {
    const r = t.prizeRows[k]
    const lab: CellPara[] = [
      { runs: run(prizeRows[i].label, r.labelColor, r.labelSize, { bold: r.labelBold }), after: k === 'db' ? 0 : LABEL_AFTER }
    ]
    let row = cell(t.labW, t.text.alignY, cellParas(t.text, lab, false), r.fill)
    for (const st of l.stations) {
      const nums = st.prizes[k].map((n) => ({ runs: run(n, r.numberColor, r.size, r), after: 0, exact: r.line }))
      row += cell(t.stW, t.number.alignY, cellParas(t.number, nums, true), r.fill)
    }
    x += tr(prizeRows[i].height, row)
  })
  return x + '</w:tbl>'
}

export function documentXml(l: SheetLayout): string {
  const header = headerXml(l)
  // Dòng tự do cuối phiếu: đoạn văn ngay sau bảng, trước khoảng cách / ngắt cột của phiếu sau
  const tbl = tableXml(l) + linesXml(l, l.footer.lines)
  const colBreak = '<w:r><w:br w:type="column"/></w:r>'
  const gapPara = spacerPara(l.gapY)
  // Dàn theo hàng: đoạn đệm phía trên phiếu đầu mỗi cột
  const topPara = l.topPad > 0 ? spacerPara(l.topPad) : ''
  let body = ''
  for (let c = 1; c <= l.copies; c++) {
    let hx = header
    const newCol = c === 1 || (c - 1) % l.nrow === 0
    if (newCol) {
      const first = topPara || hx
      // sang cột mới: ngắt cột nằm trong đoạn đầu tiên của cột
      const withBreak = c > 1 ? first.replace('</w:pPr>', `</w:pPr>${colBreak}`) : first
      hx = topPara ? withBreak + hx : withBreak
    } else if (l.gapY > 0) {
      hx = gapPara + hx // khoảng cách giữa 2 phiếu trong cột
    }
    body += hx + tbl
  }
  body += spacerPara(20)

  const cols = l.ncol > 1 ? `<w:cols w:num="${l.ncol}" w:space="${l.gapX}"/>` : ''
  const mg = l.margin
  const sect =
    `<w:sectPr><w:pgSz w:w="${l.page.w}" w:h="${l.page.h}" w:orient="${l.page.orient}"/>` +
    `<w:pgMar w:top="${mg.top}" w:right="${mg.right}" w:bottom="${mg.bottom}" w:left="${mg.left}" w:header="0" w:footer="0" w:gutter="0"/>${cols}</w:sectPr>`
  return `${XML_DECL}<w:document ${W_NS}><w:body>${body}${sect}</w:body></w:document>\n`
}

export function stylesXml(l: SheetLayout): string {
  const f = xmlEscape(l.font)
  return (
    `${XML_DECL}<w:styles ${W_NS}><w:docDefaults><w:rPrDefault><w:rPr>` +
    `<w:rFonts w:ascii="${f}" w:hAnsi="${f}" w:eastAsia="${f}" w:cs="${f}"/><w:sz w:val="22"/><w:szCs w:val="22"/><w:lang w:val="vi-VN"/>` +
    `</w:rPr></w:rPrDefault><w:pPrDefault><w:pPr><w:spacing w:before="0" w:after="0" w:line="240" w:lineRule="auto"/></w:pPr></w:pPrDefault></w:docDefaults>` +
    `<w:style w:type="paragraph" w:default="1" w:styleId="Normal"><w:name w:val="Normal"/><w:qFormat/></w:style>` +
    `<w:style w:type="table" w:default="1" w:styleId="TableNormal"><w:name w:val="Normal Table"/><w:tblPr><w:tblInd w:w="0" w:type="dxa"/>` +
    `<w:tblCellMar><w:top w:w="0" w:type="dxa"/><w:left w:w="108" w:type="dxa"/><w:bottom w:w="0" w:type="dxa"/><w:right w:w="108" w:type="dxa"/></w:tblCellMar>` +
    `</w:tblPr></w:style></w:styles>\n`
  )
}

const CONTENT_TYPES =
  `${XML_DECL}<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">` +
  `<Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>` +
  `<Default Extension="xml" ContentType="application/xml"/>` +
  `<Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/>` +
  `<Override PartName="/word/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.styles+xml"/>` +
  `<Override PartName="/docProps/core.xml" ContentType="application/vnd.openxmlformats-package.core-properties+xml"/></Types>\n`

const ROOT_RELS =
  `${XML_DECL}<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">` +
  `<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/>` +
  `<Relationship Id="rId2" Type="http://schemas.openxmlformats.org/package/2006/relationships/metadata/core-properties" Target="docProps/core.xml"/></Relationships>\n`

const DOC_RELS =
  `${XML_DECL}<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">` +
  `<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/></Relationships>\n`

function coreXml(title: string, now: Date): string {
  const ts = now.toISOString().replace(/\.\d{3}Z$/, 'Z')
  return (
    `${XML_DECL}<cp:coreProperties xmlns:cp="http://schemas.openxmlformats.org/package/2006/metadata/core-properties" ` +
    `xmlns:dc="http://purl.org/dc/elements/1.1/" xmlns:dcterms="http://purl.org/dc/terms/" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance">` +
    `<dc:title>${xmlEscape(title)}</dc:title><dc:creator>Xổ Số Đại Lý</dc:creator>` +
    `<dcterms:created xsi:type="dcterms:W3CDTF">${ts}</dcterms:created><dcterms:modified xsi:type="dcterms:W3CDTF">${ts}</dcterms:modified></cp:coreProperties>\n`
  )
}

export interface DocxOptions {
  /** Tiêu đề trong thuộc tính file, ví dụ "Kết quả XSMN 26-10-2026". */
  title?: string
  now?: Date
}

/** Các phần của gói .docx (đường dẫn trong zip → nội dung). */
export function docxParts(l: SheetLayout, opts: DocxOptions = {}): Record<string, string> {
  return {
    '[Content_Types].xml': CONTENT_TYPES,
    '_rels/.rels': ROOT_RELS,
    'docProps/core.xml': coreXml(opts.title ?? `Kết quả XSMN ${l.title}`, opts.now ?? new Date()),
    'word/_rels/document.xml.rels': DOC_RELS,
    'word/document.xml': documentXml(l),
    'word/styles.xml': stylesXml(l)
  }
}

export async function renderDocx(l: SheetLayout, opts: DocxOptions = {}): Promise<Uint8Array> {
  const zip = new JSZip()
  const date = opts.now ?? new Date()
  for (const [path, content] of Object.entries(docxParts(l, opts))) zip.file(path, content, { date })
  return zip.generateAsync({ type: 'uint8array', compression: 'DEFLATE' })
}
