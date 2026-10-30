import { useState, type ReactElement, type ReactNode } from 'react'
import { maxCardSizeCm, viNumber } from '../../../../../core/layout'
import type { SheetStation } from '../../../../../core/select'
import type { CellStyle, HeaderLineStyle, HeaderText, PrizeRowStyle, TextStyle } from '../../../../../core/settings'
import {
  defaultRow, DEFAULT_FONT, HEADER_AFTER_MAX, HEADER_SIZE_MAX, HEADER_SIZE_MIN, LABEL_SIZE_MAX, LABEL_SIZE_MIN, ROW_DELTA_MAX,
  ROW_DELTA_MIN
} from '../../../../../core/settings'
import { STATIONS, type PrizeKey } from '../../../../../core/stations'
import { AlignGrid, alignName } from '../../../components/AlignGrid'
import { ColorField } from '../../../components/ColorField'
import { CompactInput } from '../../../components/CompactInput'
import { Segmented } from '../../../components/controls'
import {
  IconCalendar, IconEye, IconEyeOff, IconHash, IconLine, IconPage, IconPanelTop, IconReceipt, IconRows, IconTable,
  IconTag, IconType
} from '../../../components/icons'
import { LineAlignPicker } from '../../../components/LineAlignPicker'
import { PagePositionPicker } from '../../../components/PagePositionPicker'
import { TextStyleToggles } from '../../../components/TextStyleToggles'
import { useLocalFonts } from '../../../hooks'
import { PAPER_OPTIONS } from '../../../labels'
import type { DraftProps } from '../../../useSettingsDraft'
import { findNode, prizeOf, shownOf, toggleShown, type NodeId } from './nodes'

type LineKey = 'name' | 'addr' | 'contact'
type TextKey = 'label' | LineKey
const LINE_OF: Record<'line1' | 'line2' | 'line3', LineKey> = { line1: 'name', line2: 'addr', line3: 'contact' }
const TEXT_OF: Partial<Record<NodeId, TextKey>> = { 'line1.label': 'label', 'line1.text': 'name', 'line2.text': 'addr', 'line3.text': 'contact' }

const KIND: Partial<Record<NodeId, string>> = {
  card: 'Khung ngoài cùng của phiếu',
  head: 'Các dòng in trên bảng kết quả',
  line1: 'Nhóm Label + Text',
  'line1.label': 'Dòng 1 · nhãn trước Text',
  'line1.text': 'Dòng 1 · chữ chính',
  line2: 'Nhóm Label + Text',
  'line2.text': 'Dòng 2 · chữ chính',
  line3: 'Nhóm Label + Text',
  'line3.text': 'Dòng 3 · chữ chính',
  date: 'Luôn in · sát trên bảng kết quả',
  table: 'Khung và viền bảng',
  hdr: 'Chữ “Giải” và tên đài',
  labels: 'Tám … Nhất và ĐB',
  numbers: 'Các số trúng thưởng, mọi hàng',
  rows: 'Chỉnh riêng từng hàng'
}

const ICON: Partial<Record<NodeId, () => ReactElement>> = {
  card: IconReceipt, head: IconPanelTop, line1: IconLine, line2: IconLine, line3: IconLine,
  'line1.label': IconType, 'line1.text': IconType, 'line2.text': IconType, 'line3.text': IconType,
  date: IconCalendar, table: IconTable, hdr: IconRows, labels: IconTag, numbers: IconHash, rows: IconRows
}

function Sec({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="insp-sec">
      <h3 className="insp-h">{title}</h3>
      {children}
    </section>
  )
}

/** Hàng có nhãn ngắn bên trái (Màu số, Tên giải…). */
function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="insp-field">
      <span className="insp-label">{label}</span>
      {children}
    </div>
  )
}

/** Cột phải tab Phiếu: thuộc tính phần đang chọn; không chọn gì thì là thuộc tính trang giấy. */
export function Inspector(props: DraftProps & {
  selected: NodeId | null
  /** Cỡ số kết quả đang dùng thật (pt). */
  numberSizePt: number
  /** Cỡ số đang dùng thật của từng hàng giải (pt). */
  rowSizePt: Record<PrizeKey, number>
  /** Dòng thứ, ngày của phiếu đang xem, ví dụ "Thứ Hai (26-10-2026)". */
  dateLine: string
  /** Các đài trên phiếu đang xem (để sửa nhanh tên viết tắt). */
  stations: SheetStation[]
}) {
  const { selected: id, draft } = props
  const name = id ? findNode(id)?.name ?? '' : 'Trang giấy'
  const kind = id ? KIND[id] ?? 'Hàng giải' : 'Chưa chọn phần nào trên phiếu'
  const Icon = id ? ICON[id] ?? IconRows : IconPage
  const shown = id ? shownOf(draft, id) : null

  return (
    <div className="inspector" aria-labelledby="h-insp">
      <div className="insp-head">
        <span className="insp-icon"><Icon /></span>
        <div className="insp-title">
          <h2 id="h-insp">{name}</h2>
          <span className="hint">{kind}</span>
        </div>
        {id && shown !== null && (
          <button type="button" className="eye" aria-pressed={shown} aria-label={`Hiện ${name} trên phiếu`}
            title={shown ? 'Đang hiện – bấm để ẩn' : 'Đang ẩn – bấm để hiện'}
            onClick={() => props.setDraft((d) => toggleShown(d, id))}>
            {shown ? <IconEye /> : <IconEyeOff />}
          </button>
        )}
      </div>
      <div className="insp-body">
        <Body {...props} />
      </div>
    </div>
  )
}

type Props = Parameters<typeof Inspector>[0]

function Body(props: Props) {
  const { selected: id, draft, setDraft } = props
  if (!id) return <PageProps {...props} />
  if (id === 'card') return <CardProps {...props} />
  if (id === 'line1' || id === 'line2' || id === 'line3') {
    return (
      <>
        <LineStyle {...props} lineKey={LINE_OF[id]} label={`Dòng ${id.slice(-1)}`} afterHint="Khoảng cách tới dòng dưới." />
        <p className="hint">
          {id === 'line1'
            ? 'Label và Text in liền nhau trên cùng một dòng, căn chung một khối. Để trống Label thì dòng chỉ còn Text.'
            : 'Chọn Text bên trong để sửa chữ, cỡ chữ, màu.'}
        </p>
      </>
    )
  }
  const textKey = TEXT_OF[id]
  if (textKey) {
    const group = id.slice(0, 5) as NodeId
    return (
      <>
        <TextProps {...props} textKey={textKey} label={findNode(id)?.name ?? ''} />
        <p className="hint">In đúng như chữ đã gõ. Căn lề và khoảng cách: chọn {findNode(group)?.name} trong cây.</p>
      </>
    )
  }
  if (id === 'date') {
    const h = draft.header.date
    return (
      <>
        <Sec title="Chữ">
          <input className="input" value={props.dateLine} readOnly aria-label="Dòng thứ, ngày (tự động)" />
          <p className="hint">Tự đổi theo ngày xổ, không sửa chữ được.</p>
          <div className="row">
            <SizeInput id="f-date-size" label="Thứ, ngày" value={h.size} onChange={(v) => setDraft((d) => { d.header.date.size = v })} />
            <InkToggles label="Thứ, ngày" value={h} onChange={(c) => setDraft((d) => { Object.assign(d.header.date, c) })} />
          </div>
          <Field label="Màu chữ">
            <ColorField label="Màu chữ Thứ, ngày" value={h.color} onChange={(c) => setDraft((d) => { d.header.date.color = c ?? h.color })} />
          </Field>
        </Sec>
        <LineStyle {...props} lineKey="date" label="Thứ, ngày" afterHint="Khoảng cách tới bảng kết quả." />
      </>
    )
  }
  if (id === 'head') return <p className="hint">Chọn một dòng trong cây (Dòng 1–3, Thứ, ngày) để chỉnh. Phần đầu cao lên thì bảng kết quả tự co lại cho vừa phiếu.</p>
  if (id === 'table') return <TableProps {...props} />
  if (id === 'hdr') return <HeaderRowProps {...props} />
  if (id === 'labels') return <PrizeLabelProps {...props} />
  if (id === 'numbers') return <NumberProps {...props} />
  const k = prizeOf(id)
  if (k) return <PrizeRowProps {...props} prize={k} />
  return <p className="hint">Mở nhóm và chọn một hàng giải để chỉnh cỡ số, màu, kiểu chữ, nền riêng của hàng đó. Phần không chỉnh thì theo Số kết quả và Tên giải.</p>
}

function SizeInput(props: { id: string; label: string; value: number; onChange: (v: number) => void; kind?: 'size' | 'size-giai' | 'size-db'; min?: number; max?: number }) {
  return (
    <CompactInput id={props.id} kind={props.kind ?? 'size'} label={`cỡ chữ ${props.label}`} unit="pt" title={`Cỡ chữ ${props.label}`}
      value={props.value} min={props.min ?? HEADER_SIZE_MIN} max={props.max ?? HEADER_SIZE_MAX} step={0.5}
      onChange={(v) => props.onChange(v ?? props.value)} />
  )
}

/** Đậm / Nghiêng của một đoạn chữ. */
function InkToggles(props: { label: string; value: TextStyle; onChange: (c: Partial<TextStyle>) => void }) {
  const { label, value, onChange } = props
  return <TextStyleToggles label={`Kiểu chữ ${label}`} value={{ bold: value.bold, italic: value.italic }} onChange={onChange} />
}

function TextProps(props: DraftProps & { textKey: TextKey; label: string }) {
  const { draft, setDraft, textKey, label } = props
  const h: HeaderText = draft.header[textKey]
  const set = (change: Partial<HeaderText>) => setDraft((d) => { Object.assign(d.header[textKey], change) })
  return (
    <Sec title="Chữ">
      <input id={`f-${textKey}`} className="input" value={h.value} aria-label={`Chữ ${label}`}
        onChange={(e) => set({ value: e.target.value })} />
      <div className="row">
        <SizeInput id={`f-${textKey}-size`} label={label} value={h.size} onChange={(size) => set({ size })} />
        <InkToggles label={label} value={h} onChange={set} />
      </div>
      <Field label="Màu chữ">
        <ColorField label={`Màu chữ ${label}`} value={h.color} onChange={(c) => set({ color: c ?? h.color })} />
      </Field>
    </Sec>
  )
}

function LineStyle(props: DraftProps & { lineKey: LineKey | 'date'; label: string; afterHint: string }) {
  const { draft, setDraft, lineKey, label, afterHint } = props
  const line: HeaderLineStyle = draft.header[lineKey]
  const set = (change: Partial<HeaderLineStyle>) => setDraft((d) => { Object.assign(d.header[lineKey], change) })
  return (
    <Sec title="Căn lề và khoảng cách">
      <div className="row">
        <LineAlignPicker label={`Căn lề ${label}`} value={line.align} onChange={(align) => set({ align })} />
        <CompactInput id={`f-${lineKey}-after`} kind="gap-y" label={`khoảng cách dưới ${label}`} unit="pt"
          title={afterHint} value={line.afterPt} min={0} max={HEADER_AFTER_MAX} step={0.5}
          onChange={(v) => set({ afterPt: v ?? line.afterPt })} />
      </div>
      <p className="hint">{afterHint}</p>
    </Sec>
  )
}

function PageProps({ draft, setDraft }: DraftProps) {
  const p = draft.print
  return (
    <>
      <Segmented id="l-kho" label="Khổ giấy mặc định" options={PAPER_OPTIONS} value={p.paper}
        onChange={(v) => setDraft((d) => { d.print.paper = v })} variant="tall" />
      <Sec title="Khoảng cách giữa các phiếu">
        <div className="row">
          <CompactInput id="f-gap-x" kind="gap-x" label="khoảng cách ngang giữa hai cột phiếu"
            title="Khoảng cách ngang giữa hai cột phiếu (A4, A5)" value={p.cardGapXCm}
            onChange={(v) => setDraft((d) => { d.print.cardGapXCm = v ?? 0 })} />
          <CompactInput id="f-gap-y" kind="gap-y" label="khoảng cách dọc giữa hai hàng phiếu"
            title="Khoảng cách dọc giữa hai hàng phiếu (A4)" value={p.cardGapYCm}
            onChange={(v) => setDraft((d) => { d.print.cardGapYCm = v ?? 0 })} />
        </div>
        <p className="hint">Ngang: giữa 2 cột (A4, A5). Dọc: giữa 2 hàng (A4). Kéo trên biểu tượng để chỉnh nhanh.</p>
      </Sec>
      <Sec title="Vị trí cụm phiếu trên trang">
        <PagePositionPicker id="l-calign" paper={p.paper} value={p.cardAlign}
          onChange={(v) => setDraft((d) => { d.print.cardAlign = v })} />
        <p className="hint">
          {p.paper === 'A6'
            ? 'Khổ A6 chỉ có một phiếu: lệch trái / giữa / phải trong phần trống của trang.'
            : 'Phần giấy còn trống dồn sang phía đối diện; chọn Giữa để chia đều hai bên.'}
        </p>
      </Sec>
      <p className="hint">Bấm vào một phần trên phiếu, hoặc chọn trong cây bên trái, để chỉnh riêng phần đó.</p>
    </>
  )
}

function CardProps({ draft, setDraft }: DraftProps) {
  const p = draft.print
  const max = (paper: typeof p.paper) => maxCardSizeCm(paper, p.cardGapXCm, p.cardGapYCm)
  const cur = max(p.paper)
  const localFonts = useLocalFonts()
  // Chưa đọc được danh sách thì đưa vài font phổ biến để vẫn chọn được
  const fontMissing = !!localFonts?.length && !localFonts.includes(p.font)
  const fontChoices = localFonts?.length ? localFonts : [DEFAULT_FONT, 'Arial']
  const fontList = fontChoices.includes(p.font) ? fontChoices : [p.font, ...fontChoices]
  return (
    <>
      <Sec title="Kích thước">
        <div className="row">
          <CompactInput id="f-cw" kind="width" label="bề rộng phiếu" title="Bề rộng mỗi phiếu. Để trống hoặc gõ auto: rộng nhất vừa khổ giấy"
            value={p.cardWidthCm} min={4} max={10} allowAuto autoValue={cur.w}
            onChange={(v) => setDraft((d) => { d.print.cardWidthCm = v })} />
          <CompactInput id="f-ch" kind="height" label="chiều cao phiếu" title="Chiều cao mỗi phiếu. Để trống hoặc gõ auto: cao hết chỗ trống"
            value={p.cardHeightCm} min={4} max={max('A4').h} allowAuto autoValue={cur.h}
            onChange={(v) => setDraft((d) => { d.print.cardHeightCm = v })} />
        </div>
        <p className="hint">
          Tối đa rộng {viNumber(max('A4').w)} cm (A4, A5), {viNumber(max('A6').w)} cm (A6); cao {viNumber(max('A4').h)} cm (A4),{' '}
          {viNumber(max('A5').h)} cm (A5, A6). Auto là lấy mức tối đa; nhấp đúp chữ “Rộng”/“Cao”, xoá số hoặc gõ “auto” để về Auto.
        </p>
      </Sec>
      <Sec title="Font chữ">
        <select id="f-font" className="input" aria-label="Font chữ trên phiếu" value={p.font}
          onChange={(e) => setDraft((d) => { d.print.font = e.target.value })}>
          {fontList.map((f) => (
            <option key={f} value={f}>{f === p.font && fontMissing ? `${f} (máy chưa cài)` : f}</option>
          ))}
        </select>
        <p className={fontMissing ? 'hint warn' : 'hint'}>
          {fontMissing
            ? `Máy này chưa cài font “${p.font}”, phiếu sẽ in bằng font thay thế.`
            : 'Lấy từ các font đã cài trên máy, dùng cho cả phiếu.'}
        </p>
      </Sec>
    </>
  )
}

function TableProps({ draft, setDraft }: DraftProps) {
  return (
    <>
      <Sec title="Viền">
        <Field label="Màu viền">
          <ColorField label="Màu viền bảng" value={draft.print.borderColor}
            onChange={(c) => setDraft((d) => { d.print.borderColor = c ?? d.print.borderColor })} />
        </Field>
        <p className="hint">Viền đơn 0,75 pt, cả trong lẫn ngoài bảng.</p>
      </Sec>
      <p className="hint">Chọn Hàng tiêu đề, Tên giải, Số kết quả hoặc từng hàng giải trong cây để chỉnh chữ và số trong bảng.</p>
    </>
  )
}

function CellProps(props: DraftProps & { cellKey: 'textCell' | 'numberCell'; name: string }) {
  const { draft, setDraft, cellKey, name } = props
  const c = draft.print[cellKey]
  const set = (patch: Partial<CellStyle>) => setDraft((d) => { Object.assign(d.print[cellKey], patch) })
  return (
    <Sec title="Vị trí trong ô">
      <div className="row insp-cell">
        <AlignGrid label={`Căn ${name} trong ô`} x={c.alignX} y={c.alignY} onChange={(x, y) => set({ alignX: x, alignY: y })} />
        <div className="insp-col">
          <CompactInput id={`${cellKey}-px`} kind="pad-x" label={`padding ngang của ${name}`}
            title={`Khoảng cách ngang từ mép ô tới ${name}, ở phía được căn`}
            value={c.padXCm} min={0} max={1.5} step={0.05} onChange={(v) => set({ padXCm: v ?? 0 })} />
          <CompactInput id={`${cellKey}-py`} kind="pad-y" label={`padding dọc của ${name}`}
            title={`Khoảng cách dọc từ mép ô tới ${name}, ở phía được căn`}
            value={c.padYCm} min={0} max={1} step={0.05} onChange={(v) => set({ padYCm: v ?? 0 })} />
        </div>
      </div>
      <p className="hint">{alignName(c.alignX, c.alignY)}. Padding tính từ mép ô tới {name}, ở phía {name} được căn (căn giữa: cả hai bên).</p>
    </Sec>
  )
}

function PrizeLabelProps(props: Props) {
  const { draft, setDraft } = props
  const pl = draft.print.prizeLabels
  const set = (c: Partial<typeof pl>) => setDraft((d) => { Object.assign(d.print.prizeLabels, c) })
  return (
    <>
      <Sec title="Chữ">
        <div className="row">
          <SizeInput id="f-pl-size" label="tên giải" value={pl.size} min={LABEL_SIZE_MIN} max={LABEL_SIZE_MAX} onChange={(size) => set({ size })} />
          <SizeInput id="f-pl-db" kind="size-db" label="ĐB" value={pl.dbSize} min={LABEL_SIZE_MIN} max={LABEL_SIZE_MAX} onChange={(dbSize) => set({ dbSize })} />
        </div>
        <div className="row">
          <TextStyleToggles label="Kiểu chữ tên giải" value={{ bold: pl.bold }} onChange={(c) => set({ bold: !!c.bold })} />
          <ColorField label="Màu tên giải" value={pl.color} onChange={(c) => set({ color: c ?? pl.color })} />
        </div>
        <p className="hint">Màu tên giải của từng hàng chỉnh riêng được trong Hàng giải.</p>
      </Sec>
      <CellProps {...props} cellKey="textCell" name="chữ" />
      <p className="hint">Hàng tiêu đề luôn nằm giữa ô theo chiều dọc, lấy căn ngang và padding ngang ở đây.</p>
    </>
  )
}

function NumberProps(props: Props) {
  const { draft, setDraft, numberSizePt } = props
  const { numberFontPt, numbers: nb } = draft.print
  const pt = viNumber(numberSizePt)
  const set = (c: Partial<typeof nb>) => setDraft((d) => { Object.assign(d.print.numbers, c) })
  return (
    <>
      <Sec title="Chữ số">
        <div className="row">
          <CompactInput id="f-nsize" kind="size" label="cỡ số kết quả" unit="pt"
            title="Cỡ số kết quả. Để trống hoặc gõ auto: lớn nhất vừa phiếu"
            value={numberFontPt} min={8} max={30} step={0.5} allowAuto autoValue={numberSizePt}
            onChange={(v) => setDraft((d) => { d.print.numberFontPt = v })} />
          <TextStyleToggles label="Kiểu chữ số" value={nb} onChange={set} />
        </div>
        <Field label="Màu số">
          <ColorField label="Màu số kết quả" value={nb.color} onChange={(c) => set({ color: c ?? nb.color })} />
        </Field>
        <p className="hint">
          {numberFontPt === null
            ? `Cỡ Auto là lớn nhất vừa phiếu, đang là ${pt} pt.`
            : numberSizePt < numberFontPt
              ? `Cỡ ${viNumber(numberFontPt)} pt to quá, đang dùng ${pt} pt cho vừa phiếu.`
              : `Cỡ số cố định ${pt} pt.`}{' '}
          Nhấp đúp chữ “Cỡ”, xoá số hoặc gõ “auto” để về Auto.
        </p>
      </Sec>
      <CellProps {...props} cellKey="numberCell" name="số" />
      <p className="hint">Từng hàng giải chỉnh riêng được: mở Hàng giải trong cây bên trái.</p>
    </>
  )
}

/** Một hàng giải: phần nào để trống (Chung) thì theo Số kết quả / Tên giải. */
function PrizeRowProps(props: Props & { prize: PrizeKey }) {
  const { draft, setDraft, prize: k, numberSizePt, rowSizePt } = props
  const r = draft.print.rows[k]
  const nb = draft.print.numbers
  const set = (c: Partial<PrizeRowStyle>) => setDraft((d) => { Object.assign(d.print.rows[k], c) })
  const cur = { bold: r.bold ?? nb.bold, italic: r.italic ?? nb.italic, underline: r.underline ?? nb.underline }
  const changed = JSON.stringify(r) !== JSON.stringify(defaultRow(k))
  return (
    <>
      <Sec title="Cỡ số">
        <div className="row">
          <CompactInput id={`f-row-${k}-delta`} kind="delta" label="cỡ số cộng thêm của hàng" unit="pt"
            title="Cộng thêm (hoặc bớt, số âm) so với cỡ số chung"
            value={r.sizeDeltaPt} min={ROW_DELTA_MIN} max={ROW_DELTA_MAX} step={0.5}
            onChange={(v) => set({ sizeDeltaPt: v ?? 0 })} />
        </div>
        <p className="hint">
          Cỡ số chung {viNumber(numberSizePt)} pt, hàng này đang dùng {viNumber(rowSizePt[k])} pt. Cỡ chung vẫn tự co cho vừa phiếu.
        </p>
      </Sec>
      <Sec title="Màu">
        <Field label="Số">
          <ColorField label="Màu số của hàng" value={r.numberColor} emptyLabel="Chung" fallback={nb.color}
            onChange={(c) => set({ numberColor: c })} />
        </Field>
        <Field label="Tên giải">
          <ColorField label="Màu tên giải của hàng" value={r.labelColor} emptyLabel="Chung" fallback={draft.print.prizeLabels.color}
            onChange={(c) => set({ labelColor: c })} />
        </Field>
      </Sec>
      <Sec title="Kiểu chữ số">
        <TextStyleToggles label="Kiểu chữ số của hàng" value={cur} onChange={set} />
      </Sec>
      <Sec title="Nền hàng">
        <ColorField label="Màu nền hàng" value={r.fill} emptyLabel="Không" onChange={(c) => set({ fill: c })} />
        <p className="hint">Máy in đen trắng in nền màu thành xám nhạt.</p>
      </Sec>
      <button type="button" className="btn subtle" disabled={!changed}
        onClick={() => setDraft((d) => { d.print.rows[k] = defaultRow(k) })}>
        Đặt lại hàng này
      </button>
    </>
  )
}

/** Hàng tiêu đề: cỡ chữ "Giải", kiểu, màu; tên viết tắt các đài trên phiếu, mở ra thì đủ 21 đài. */
function HeaderRowProps(props: Props) {
  const { draft, setDraft, stations } = props
  const [all, setAll] = useState(false)
  const hr = draft.print.headRow
  const set = (c: Partial<typeof hr>) => setDraft((d) => { Object.assign(d.print.headRow, c) })
  const list = all || !stations.length ? STATIONS : STATIONS.filter((st) => stations.some((s) => s.slug === st.slug))
  return (
    <>
      <Sec title="Chữ">
        <div className="row">
          <SizeInput id="f-hr-size" kind="size-giai" label="“Giải”" value={hr.labelSize} min={LABEL_SIZE_MIN} max={LABEL_SIZE_MAX}
            onChange={(labelSize) => set({ labelSize })} />
          <TextStyleToggles label="Kiểu chữ hàng tiêu đề" value={{ bold: hr.bold }} onChange={(c) => set({ bold: !!c.bold })} />
        </div>
        <Field label="Màu chữ">
          <ColorField label="Màu chữ hàng tiêu đề" value={hr.color} onChange={(c) => set({ color: c ?? hr.color })} />
        </Field>
        <p className="hint">Cỡ tên đài tự chọn 12, 10 hoặc 8 pt tuỳ bề rộng cột. Căn lề và padding đi theo Tên giải.</p>
      </Sec>
      <Sec title="Tên viết tắt in trên phiếu">
        <div className="short-list">
          {list.map((st) => (
            <label key={st.slug} className="short-item">
              <span>{st.name}</span>
              <input
                className="input small"
                value={draft.stations.shortNames[st.slug] ?? st.short}
                placeholder={st.short}
                onChange={(e) => setDraft((d) => {
                  const v = e.target.value
                  if (v.trim() === st.short) delete d.stations.shortNames[st.slug]
                  else d.stations.shortNames[st.slug] = v
                })}
              />
            </label>
          ))}
        </div>
        <button type="button" className="link-btn" aria-expanded={all} onClick={() => setAll(!all)}>
          {all ? 'Chỉ hiện đài trên phiếu này' : `Sửa cả ${STATIONS.length} đài…`}
        </button>
        <p className="hint">Để trống thì dùng tên viết tắt mặc định.</p>
      </Sec>
    </>
  )
}
