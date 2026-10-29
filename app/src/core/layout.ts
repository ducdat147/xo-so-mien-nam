// Bố cục phiếu (SPEC §6). Một mô tả hình học duy nhất, tính bằng twips (1 cm = 567, 1 pt = 20),
// dùng chung cho render-html (PDF, xem trước, in) và render-docx. Số đo port từ build_docx của
// bản bash cũ (đã bỏ): giữ nguyên phép chia nguyên của bash để ra đúng từng twip.

import type { Align, CellStyle, Colors, HeaderSettings, HeaderText, Paper, PrintSettings, VAlign } from './settings'
import { PRIZES, PRIZE_COUNT, PRIZE_LABEL, type PrizeKey, type Prizes } from './stations'

export const TWIPS_PER_CM = 567
export const TWIPS_PER_PT = 20

export interface PaperSpec {
  w: number
  h: number
  orient: 'portrait' | 'landscape'
  ncol: number
  nrow: number
  widthMm: number
  heightMm: number
}

export const PAPER_SPECS: Readonly<Record<Paper, PaperSpec>> = {
  A4: { w: 11906, h: 16838, orient: 'portrait', ncol: 2, nrow: 2, widthMm: 210, heightMm: 297 },
  A5: { w: 11906, h: 8391, orient: 'landscape', ncol: 2, nrow: 1, widthMm: 210, heightMm: 148 },
  A6: { w: 5953, h: 8391, orient: 'portrait', ncol: 1, nrow: 1, widthMm: 105, heightMm: 148 }
}

export const PAGE_MARGIN = 454
/** Trừ hao cho sai số ước lượng phần đầu phiếu. */
export const SAFETY = 160
export const ROW_PAD = 60
export const CELL_MARGIN = { top: 30, left: 28, bottom: 20, right: 28 } as const
/** Viền 0,75 pt (OOXML tính theo 1/8 pt). */
export const BORDER_SZ = 6
export const LABEL_SIZE = 24
export const DB_LABEL_SIZE = 28
export const LABEL_AFTER = 40
/** Nhập đúng số cm làm tròn hiện trên màn hình (vd 13,2) có thể nhỉnh hơn chỗ trống vài twip: bỏ qua. */
const ROUNDING_TOLERANCE = 28
/** Đoạn đệm khi phần đầu phiếu bị ẩn hết (Word cần một đoạn giữa hai bảng). */
export const SPACER_H = 20

export type RowKey = 'hdr' | PrizeKey
export const ROW_KEYS: readonly RowKey[] = ['hdr', ...PRIZES]
/** Tỉ lệ chia phần chiều cao dư (giải Tư cao nhất); tổng = 168. */
export const ROW_WEIGHT: Readonly<Record<RowKey, number>> = {
  hdr: 10, '8': 10, '7': 10, '6': 26, '5': 10, '4': 52, '3': 18, '2': 10, '1': 10, db: 12
}
const WEIGHT_SUM = 168

/** Một đoạn chữ cùng cỡ; size tính bằng half-point như OOXML. */
export interface Run {
  text: string
  size: number
}

export interface HeaderLine {
  id: 'name' | 'addr' | 'contact' | 'date'
  runs: Run[]
  /** Chiều cao mỗi dòng (exact). */
  lineH: number
  /** Khoảng cách sau đoạn. */
  after: number
  /** Số dòng ước lượng khi chữ dài phải xuống dòng. */
  lines: number
}

/**
 * Cách đặt nội dung trong một loại ô (chữ hoặc số), tính từ CellStyle. Ô luôn có lề trong mặc định
 * CELL_MARGIN; padding lớn hơn lề đó thì phần dư thành thụt lề (ngang) / khoảng cách đoạn (dọc),
 * chỉ ở phía nội dung được căn (căn giữa: cả hai phía).
 */
export interface CellBox {
  alignX: Align
  alignY: VAlign
  indentLeft: number
  indentRight: number
  padTop: number
  padBottom: number
}

export function cellBox(c: CellStyle): CellBox {
  const x = Math.max(0, cmToTwips(c.padXCm) - CELL_MARGIN.left)
  const y = Math.max(0, cmToTwips(c.padYCm) - CELL_MARGIN.top)
  return {
    alignX: c.alignX,
    alignY: c.alignY,
    indentLeft: c.alignX === 'right' ? 0 : x,
    indentRight: c.alignX === 'left' ? 0 : x,
    padTop: c.alignY === 'bottom' ? 0 : y,
    padBottom: c.alignY === 'top' ? 0 : y
  }
}

export interface TableRow {
  key: RowKey
  label: string
  height: number
}

export interface LayoutStation {
  short: string
  prizes: Prizes
}

/**
 * Bề rộng chữ đậm của font in so với Times New Roman (1 = bằng). Số đo gốc của bản bash tính
 * theo Times; font rộng hơn (Verdana, Tahoma…) thì ước lượng theo tỉ lệ này để số không tràn ô.
 * Nhỏ hơn 1 vẫn tính như 1. Renderer đo bằng canvas (main không đo được).
 */
export interface FontScale {
  /** Chữ số 0–9. */
  digits: number
  /** Chữ thường gặp ở đầu phiếu. */
  text: number
}

export interface LayoutInput {
  header: HeaderSettings
  print: PrintSettings
  paper: Paper
  /** "Thứ Hai (26-10-2026)" */
  title: string
  stations: LayoutStation[]
  blank?: boolean
  fontScale?: FontScale
}

export interface SheetLayout {
  paper: Paper
  page: { w: number; h: number; orient: 'portrait' | 'landscape'; widthMm: number; heightMm: number }
  margin: { top: number; right: number; bottom: number; left: number }
  ncol: number
  nrow: number
  copies: number
  /** Khoảng cách ngang giữa hai cột phiếu. */
  gapX: number
  /** Khoảng cách dọc giữa hai hàng phiếu (giữa 2 bản trong cùng cột). */
  gapY: number
  /** Bề ngang một cột chữ trên trang (nhiều cột: đúng bằng cardW). */
  colW: number
  cardW: number
  cardH: number
  /** Chiều cao lớn nhất một phiếu có thể có trên khổ giấy này (khi để tự động thì cardH = cardHMax). */
  cardHMax: number
  cardAlign: Align
  header: {
    lines: HeaderLine[]
    /** Tổng chiều cao ước lượng, gồm cả khoảng sau đoạn. */
    height: number
    /** Thụt lề phần đầu phiếu để nằm đúng trên bảng (chỉ khác 0 khi trang một cột). */
    indent: { left: number; right: number }
  }
  table: {
    width: number
    labW: number
    stW: number
    /** Chiều cao dành cho bảng (cardH − header − SAFETY). */
    available: number
    height: number
    rows: TableRow[]
    stationSize: number
    numberSize: number
    dbSize: number
    /** Chiều cao một dòng số / dòng ĐB (exact). */
    numberLine: number
    dbLine: number
    /** Khoảng đệm thêm của mỗi hàng (ROW_PAD + padding dọc lớn nhất). */
    rowPad: number
    /** Cách đặt chữ (Giải, tên giải, tên đài) và số kết quả trong ô. */
    text: CellBox
    number: CellBox
  }
  stations: LayoutStation[]
  title: string
  blank: boolean
  font: string
  colors: Colors
  warnings: string[]
}

/** Chia nguyên cắt phần lẻ như $(( )) của bash. */
const idiv = (a: number, b: number) => Math.trunc(a / b)
/** cm → twips, cắt phần lẻ như awk printf "%d". */
export const cmToTwips = (cm: number) => Math.trunc(cm * TWIPS_PER_CM)
const ptToHalf = (pt: number) => Math.round(pt * 2)

/** Định dạng số kiểu Việt Nam: 13.5 → "13,5". */
export function viNumber(n: number, digits = 1): string {
  return String(Number(n.toFixed(digits))).replace('.', ',')
}

/** Bề rộng / chiều cao phiếu lớn nhất vừa khổ giấy (cm, làm tròn 0,1), cùng cách tính với computeLayout. */
export function maxCardSizeCm(paper: Paper, gapXCm: number, gapYCm: number): { w: number; h: number } {
  const s = PAPER_SPECS[paper]
  const cm = (tw: number) => Math.round((tw / TWIPS_PER_CM) * 10) / 10
  const gapX = Math.max(0, cmToTwips(gapXCm))
  const gapY = Math.max(0, cmToTwips(gapYCm))
  return {
    w: cm(idiv(s.w - 2 * PAGE_MARGIN - (s.ncol - 1) * gapX, s.ncol)),
    h: cm(idiv(s.h - 2 * PAGE_MARGIN - (s.nrow - 1) * gapY, s.nrow))
  }
}

const charCount = (s: string) => [...s.normalize('NFC')].length

/** Tỉ lệ font dùng trong layout: chặn dưới 1 (giữ đúng số đo bash), chặn trên 2. */
const scaleOf = (v: number | undefined) => (v !== undefined && Number.isFinite(v) ? Math.min(2, Math.max(1, v)) : 1)

/** Ước lượng số dòng: chữ đậm ~0,5 em mỗi ký tự (Times), nhân `scale` cho font rộng hơn. */
function estimateLines(runs: Run[], widthTw: number, scale: number): number {
  // len × pt × 0,5 (pt) = len × half-point × 5 (twips)
  const w = runs.reduce((sum, r) => sum + charCount(r.text) * r.size * 5, 0) * scale
  return Math.max(1, Math.ceil(w / Math.max(1, widthTw)))
}

/** Gộp các run liền nhau cùng cỡ (để bản Word giống hệt bản bash khi cùng cỡ chữ). */
function mergeRuns(runs: Run[]): Run[] {
  const out: Run[] = []
  for (const r of runs) {
    const last = out[out.length - 1]
    if (last && last.size === r.size) last.text += r.text
    else out.push({ ...r })
  }
  return out
}

function headerLines(h: HeaderSettings, title: string, widthTw: number, textScale: number): HeaderLine[] {
  const lines: HeaderLine[] = []
  const val = (t: HeaderText) => (t.show ? t.value.trim() : '')
  // factor tính theo phần trăm để làm tròn bằng số nguyên: lineH = ⌊pt × 20 × factor⌋
  const push = (id: HeaderLine['id'], runs: Run[], factor: number, after: number) => {
    runs = mergeRuns(runs.filter((r) => r.text))
    if (!runs.length) return
    const maxSize = Math.max(...runs.map((r) => r.size))
    lines.push({ id, runs, lineH: idiv(maxSize * 10 * factor, 100), after, lines: estimateLines(runs, widthTw, textScale) })
  }

  const label = val(h.label)
  const name = val(h.name)
  push('name', [
    { text: label && name ? `${label} ` : label, size: ptToHalf(h.label.size) },
    { text: name, size: ptToHalf(h.name.size) }
  ], 136, 60)

  const addr = val(h.addr)
  push('addr', [{ text: addr && `ĐC: ${addr}`, size: ptToHalf(h.addr.size) }], 120, 0)

  const phones = h.phones.show ? h.phones.values.map((p) => p.trim()).filter(Boolean) : []
  push('contact', [{ text: phones.map((p) => `DĐ: ${p}`).join('  '), size: ptToHalf(h.phones.size) }], 120, 0)

  if (h.date.show) push('date', [{ text: title, size: ptToHalf(h.date.size) }], 131, 60)
  return lines
}

export function computeLayout(input: LayoutInput): SheetLayout {
  const { header: hs, print: ps, paper } = input
  const warnings: string[] = []
  const spec = PAPER_SPECS[paper]
  const { ncol, nrow } = spec
  const margin = PAGE_MARGIN
  const gapX = Math.max(0, cmToTwips(ps.cardGapXCm))
  const gapY = Math.max(0, cmToTwips(ps.cardGapYCm))
  const usableW = spec.w - 2 * margin
  const usableH = spec.h - 2 * margin
  let colW = idiv(usableW - (ncol - 1) * gapX, ncol)

  // Bề rộng phiếu: tự động (null) = rộng nhất vừa một cột; tự nhập thì không vượt chỗ trống
  let cardW = ps.cardWidthCm === null ? colW : cmToTwips(ps.cardWidthCm)
  if (cardW <= 0) cardW = 4536
  if (cardW > colW && cardW - colW <= ROUNDING_TOLERANCE) cardW = colW
  if (cardW > colW) {
    warnings.push(
      `Bề ngang phiếu ${viNumber(ps.cardWidthCm ?? 0, 2)} cm rộng hơn chỗ trống trên khổ ${paper} ` +
        `(${viNumber(colW / TWIPS_PER_CM)} cm), đã dùng tối đa.`
    )
    cardW = colW
  }

  // Nhiều cột: mỗi cột đúng bằng bề ngang phiếu, phần dư dồn vào lề theo cardAlign
  let marginL = margin
  let marginR = margin
  if (ncol > 1) {
    colW = cardW
    const left = usableW - ncol * cardW - (ncol - 1) * gapX
    if (ps.cardAlign === 'left') marginR = margin + left
    else if (ps.cardAlign === 'right') marginL = margin + left
    else {
      marginL = margin + idiv(left, 2)
      marginR = margin + left - idiv(left, 2)
    }
  }
  // Một cột: thụt lề phần đầu phiếu để nằm đúng trên bảng
  const spare = colW - cardW
  const indent =
    ps.cardAlign === 'left' ? { left: 0, right: spare }
      : ps.cardAlign === 'right' ? { left: spare, right: 0 }
        : { left: idiv(spare, 2), right: idiv(spare, 2) }
  // Chiều cao phiếu: tự động = cao hết chỗ trống; tự chọn thì không vượt quá chỗ trống
  const cardHMax = idiv(usableH - (nrow - 1) * gapY, nrow)
  let cardH = cardHMax
  if (ps.cardHeightCm) {
    const want = cmToTwips(ps.cardHeightCm)
    if (want > cardHMax && want - cardHMax <= ROUNDING_TOLERANCE) {
      cardH = cardHMax
    } else if (want > cardHMax) {
      warnings.push(
        `Chiều cao phiếu ${viNumber(ps.cardHeightCm, 2)} cm cao hơn chỗ trống trên khổ ${paper} ` +
          `(${viNumber(cardHMax / TWIPS_PER_CM)} cm), đã dùng tối đa.`
      )
    } else {
      cardH = want
    }
  }

  // --- Phần đầu phiếu
  const lines = headerLines(hs, input.title, cardW, scaleOf(input.fontScale?.text))
  const headerH = lines.length ? lines.reduce((sum, l) => sum + l.lineH * l.lines + l.after, 0) : SPACER_H

  // --- Cột của bảng
  const n = Math.max(1, input.stations.length)
  const labW = Math.min(900, Math.max(600, idiv(cardW * 16, 100)))
  const stW = idiv(cardW - labW, n)
  const tblW = labW + stW * n
  const stationSize = stW >= 1200 ? 24 : stW >= 900 ? 20 : 16

  // --- Cỡ số: lớn nhất mà vẫn vừa chiều cao phiếu và bề ngang ô (half-point)
  const textBox = cellBox(ps.textCell)
  const numBox = cellBox(ps.numberCell)
  const rowPad = ROW_PAD + Math.max(textBox.padTop + textBox.padBottom, numBox.padTop + numBox.padBottom)
  const available = cardH - headerH - SAFETY
  // 6 chữ số đậm ≈ 6 × 0,5 em = 30 twips mỗi half-point (Times); 76 = lề trong ô + chừa viền
  const perHalfPoint = Math.ceil(30 * scaleOf(input.fontScale?.digits))
  const maxW = idiv(stW - 76 - numBox.indentLeft - numBox.indentRight, perHalfPoint)
  const top = ps.numberFontPt ? Math.trunc(ps.numberFontPt * 2) : 36
  const baseFor = (sz: number, db: number) => 18 * sz * 11 + db * 11 + 10 * rowPad
  let numSz = top
  for (; numSz > 14; numSz--) {
    if (numSz > maxW) continue
    if (baseFor(numSz, numSz + 2) <= available) break
  }
  if (numSz < 15) numSz = 15
  if (ps.numberFontPt && numSz < top) {
    warnings.push(`Cỡ số ${viNumber(ps.numberFontPt)} pt quá lớn so với phiếu, đã dùng ${viNumber(numSz / 2)} pt.`)
  }
  if (numSz > maxW) {
    warnings.push('Ô số quá hẹp, số có thể bị cắt. Bớt đài, tăng bề ngang phiếu hoặc giảm padding ngang của số.')
  }
  let dbSz = numSz + 2
  if (dbSz > maxW - 1) dbSz = maxW - 1 // ĐB 6 chữ số phải vừa ô
  if (dbSz < numSz) dbSz = numSz
  const L = numSz * 11 // dòng số cao 1,1 lần cỡ chữ
  const LDB = dbSz * 11
  let extra = available - baseFor(numSz, dbSz)
  if (extra < 0) {
    extra = 0
    warnings.push(
      ps.cardHeightCm
        ? 'Phiếu hơi chật, có thể tràn trang. Tăng chiều cao phiếu, bớt nội dung đầu phiếu hoặc giảm cỡ chữ.'
        : 'Phiếu hơi chật, có thể tràn trang. Thử bớt nội dung đầu phiếu hoặc giảm cỡ chữ.'
    )
  }

  const rows: TableRow[] = ROW_KEYS.map((key) => {
    const h = key === 'hdr' ? L + rowPad : key === 'db' ? LDB + rowPad : PRIZE_COUNT[key] * L + rowPad
    return {
      key,
      label: key === 'hdr' ? 'Giải' : PRIZE_LABEL[key],
      height: h + idiv(extra * ROW_WEIGHT[key], WEIGHT_SUM)
    }
  })

  return {
    paper,
    page: { w: spec.w, h: spec.h, orient: spec.orient, widthMm: spec.widthMm, heightMm: spec.heightMm },
    margin: { top: margin, right: marginR, bottom: margin, left: marginL },
    ncol,
    nrow,
    copies: ncol * nrow,
    gapX,
    gapY,
    colW,
    cardW,
    cardH,
    cardHMax,
    cardAlign: ps.cardAlign,
    header: { lines, height: headerH, indent: spare > 0 ? indent : { left: 0, right: 0 } },
    table: {
      width: tblW,
      labW,
      stW,
      available,
      height: rows.reduce((s, r) => s + r.height, 0),
      rows,
      stationSize,
      numberSize: numSz,
      dbSize: dbSz,
      numberLine: L,
      dbLine: LDB,
      rowPad,
      text: textBox,
      number: numBox
    },
    stations: input.stations,
    title: input.title,
    blank: input.blank ?? false,
    font: ps.font,
    colors: ps.colors,
    warnings
  }
}
