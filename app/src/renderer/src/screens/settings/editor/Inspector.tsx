import { useState, type ReactElement, type ReactNode } from 'react'
import { maxCardSizeCm, viNumber } from '../../../../../core/layout'
import type { SheetStation } from '../../../../../core/select'
import type { CellStyle, HeaderLineStyle, HeaderText } from '../../../../../core/settings'
import { DEFAULT_FONT, HEADER_AFTER_MAX, HEADER_SIZE_MAX, HEADER_SIZE_MIN } from '../../../../../core/settings'
import { STATIONS } from '../../../../../core/stations'
import { AlignGrid, alignName } from '../../../components/AlignGrid'
import { CompactInput } from '../../../components/CompactInput'
import { Segmented } from '../../../components/controls'
import {
  IconCalendar, IconEye, IconEyeOff, IconHash, IconLine, IconPage, IconPanelTop, IconReceipt, IconRows, IconTable,
  IconTag, IconType
} from '../../../components/icons'
import { LineAlignPicker } from '../../../components/LineAlignPicker'
import { PagePositionPicker } from '../../../components/PagePositionPicker'
import { useLocalFonts } from '../../../hooks'
import { PAPER_OPTIONS } from '../../../labels'
import type { DraftProps } from '../../../useSettingsDraft'
import { findNode, shownOf, toggleShown, type NodeId } from './nodes'

type LineKey = 'name' | 'addr' | 'contact'
type TextKey = 'label' | LineKey
const LINE_OF: Record<'line1' | 'line2' | 'line3', LineKey> = { line1: 'name', line2: 'addr', line3: 'contact' }
const TEXT_OF: Partial<Record<NodeId, TextKey>> = { 'line1.label': 'label', 'line1.text': 'name', 'line2.text': 'addr', 'line3.text': 'contact' }

const KIND: Record<NodeId, string> = {
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
  numbers: 'Các số trúng thưởng'
}

const ICON: Record<NodeId, () => ReactElement> = {
  card: IconReceipt, head: IconPanelTop, line1: IconLine, line2: IconLine, line3: IconLine,
  'line1.label': IconType, 'line1.text': IconType, 'line2.text': IconType, 'line3.text': IconType,
  date: IconCalendar, table: IconTable, hdr: IconRows, labels: IconTag, numbers: IconHash
}

function Sec({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="insp-sec">
      <h3 className="insp-h">{title}</h3>
      {children}
    </section>
  )
}

/** Cột phải tab Phiếu: thuộc tính phần đang chọn; không chọn gì thì là thuộc tính trang giấy. */
export function Inspector(props: DraftProps & {
  selected: NodeId | null
  /** Cỡ số kết quả đang dùng thật (pt). */
  numberSizePt: number
  /** Dòng thứ, ngày của phiếu đang xem, ví dụ "Thứ Hai (26-10-2026)". */
  dateLine: string
  /** Các đài trên phiếu đang xem (để sửa nhanh tên viết tắt). */
  stations: SheetStation[]
}) {
  const { selected: id, draft } = props
  const name = id ? findNode(id)?.name ?? '' : 'Trang giấy'
  const kind = id ? KIND[id] : 'Chưa chọn phần nào trên phiếu'
  const Icon = id ? ICON[id] : IconPage
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

function Body(props: Parameters<typeof Inspector>[0]) {
  const { selected: id, draft, setDraft } = props
  if (!id) return <PageProps {...props} />
  if (id === 'card') return <CardProps {...props} />
  if (id === 'line1' || id === 'line2' || id === 'line3') {
    const n = id.slice(-1)
    return (
      <>
        <LineStyle {...props} lineKey={LINE_OF[id]} label={`Dòng ${n}`} afterHint="Khoảng cách tới dòng dưới." />
        <p className="hint">
          {id === 'line1'
            ? 'Label và Text in liền nhau trên cùng một dòng, căn chung một khối. Để trống Label thì dòng chỉ còn Text.'
            : 'Chọn Text bên trong để sửa chữ và cỡ chữ.'}
        </p>
      </>
    )
  }
  const textKey = TEXT_OF[id]
  if (textKey) {
    const group = id.slice(0, 5)
    return (
      <>
        <TextProps {...props} textKey={textKey} label={findNode(id)?.name ?? ''} />
        <p className="hint">In đúng như chữ đã gõ. Căn lề và khoảng cách: chọn {findNode(group as NodeId)?.name} trong cây.</p>
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
          <SizeInput id="f-date-size" label="Thứ, ngày" value={h.size} onChange={(v) => setDraft((d) => { d.header.date.size = v })} />
        </Sec>
        <LineStyle {...props} lineKey="date" label="Thứ, ngày" afterHint="Khoảng cách tới bảng kết quả." />
      </>
    )
  }
  if (id === 'head') return <p className="hint">Chọn một dòng trong cây (Dòng 1–3, Thứ, ngày) để chỉnh. Phần đầu cao lên thì bảng kết quả tự co lại cho vừa phiếu.</p>
  if (id === 'table') return <p className="hint">Chọn Hàng tiêu đề, Tên giải hoặc Số kết quả trong cây để chỉnh chữ và số trong bảng. Viền đơn 0,75 pt, cả trong lẫn ngoài bảng.</p>
  if (id === 'hdr') return <HeaderRowProps {...props} />
  if (id === 'labels') {
    return (
      <>
        <CellProps {...props} cellKey="textCell" name="chữ" />
        <p className="hint">Hàng tiêu đề luôn nằm giữa ô theo chiều dọc, lấy căn ngang và padding ngang ở đây.</p>
      </>
    )
  }
  return <NumberProps {...props} />
}

function SizeInput(props: { id: string; label: string; value: number; onChange: (v: number) => void }) {
  return (
    <CompactInput id={props.id} kind="size" label={`cỡ chữ ${props.label}`} unit="pt" title={`Cỡ chữ ${props.label}`}
      value={props.value} min={HEADER_SIZE_MIN} max={HEADER_SIZE_MAX} step={0.5}
      onChange={(v) => props.onChange(v ?? props.value)} />
  )
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
      </div>
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

function NumberProps(props: Parameters<typeof Inspector>[0]) {
  const { draft, setDraft, numberSizePt } = props
  const { numberFontPt } = draft.print
  const pt = viNumber(numberSizePt)
  return (
    <>
      <Sec title="Chữ số">
        <div className="row">
          <CompactInput id="f-nsize" kind="size" label="cỡ số kết quả" unit="pt"
            title="Cỡ số kết quả. Để trống hoặc gõ auto: lớn nhất vừa phiếu"
            value={numberFontPt} min={8} max={30} step={0.5} allowAuto autoValue={numberSizePt}
            onChange={(v) => setDraft((d) => { d.print.numberFontPt = v })} />
        </div>
        <p className="hint">
          {numberFontPt === null
            ? `Cỡ Auto là lớn nhất vừa phiếu, đang là ${pt} pt.`
            : numberSizePt < numberFontPt
              ? `Cỡ ${viNumber(numberFontPt)} pt to quá, đang dùng ${pt} pt cho vừa phiếu.`
              : `Cỡ số cố định ${pt} pt.`}{' '}
          Nhấp đúp chữ “Cỡ”, xoá số hoặc gõ “auto” để về Auto. Số ĐB lớn hơn 1 pt.
        </p>
      </Sec>
      <CellProps {...props} cellKey="numberCell" name="số" />
    </>
  )
}

/** Tên viết tắt in trên phiếu: các đài đang xem trước, mở ra thì đủ 21 đài. */
function HeaderRowProps(props: Parameters<typeof Inspector>[0]) {
  const { draft, setDraft, stations } = props
  const [all, setAll] = useState(false)
  const list = all || !stations.length ? STATIONS : STATIONS.filter((st) => stations.some((s) => s.slug === st.slug))
  return (
    <>
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
      <p className="hint">Cỡ tên đài tự chọn 12, 10 hoặc 8 pt tuỳ bề rộng cột. Căn lề và padding đi theo Tên giải.</p>
    </>
  )
}
