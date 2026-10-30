import type { HeaderLineStyle, HeaderText } from '../../../../core/settings'
import { HEADER_AFTER_MAX, HEADER_SIZE_MAX, HEADER_SIZE_MIN } from '../../../../core/settings'
import { CompactInput } from '../../components/CompactInput'
import { LineAlignPicker } from '../../components/LineAlignPicker'
import { Calendar, Eye, EyeOff } from '../../components/icons'
import type { DraftProps } from '../../useSettingsDraft'

type TextKey = 'label' | 'name' | 'addr' | 'contact'
type RowKey = TextKey | 'date'

const TEXT_ROWS: { key: TextKey; label: string }[] = [
  { key: 'label', label: 'Nhãn trước tên' },
  { key: 'name', label: 'Tên đại lý' },
  { key: 'addr', label: 'Địa chỉ' },
  { key: 'contact', label: 'Số điện thoại' }
]

/**
 * Thẻ Thông tin: các dòng in ở đầu phiếu, đúng chữ đã gõ. Mỗi dòng ẩn/hiện, cỡ chữ, căn lề, khoảng
 * cách tới dòng dưới riêng. Dòng thứ, ngày luôn in, luôn là dòng cuối.
 */
export function AgentSection(props: DraftProps & {
  /** Dòng thứ, ngày của phiếu đang xem trước, ví dụ "Thứ Hai (26-10-2026)". */
  dateLine: string
}) {
  const { dateLine, ...edit } = props
  return (
    <div className="agent">
      <div className="agent-head" aria-hidden="true">
        <span>Cỡ chữ</span>
        <span>Căn lề</span>
        <span>Cách dưới</span>
      </div>
      <div role="list" className="agent-list">
        {TEXT_ROWS.map((f) => <TextRow key={f.key} field={f} {...edit} />)}
        <div role="listitem" className="agent-row">
          <span className="eye fixed" title="Dòng thứ, ngày luôn in"><Calendar /></span>
          <div className="agent-body">
            <div className="agent-label">
              <span className="field-label">Thứ, ngày</span>
              <span className="badge small">Luôn in</span>
            </div>
            <div className="auto-line">Tự động theo ngày xổ, ví dụ “{dateLine}”</div>
            <span className="hint">Luôn là dòng cuối, ngay trên bảng kết quả.</span>
          </div>
          <LineFormat rowKey="date" label="Thứ, ngày" {...edit} />
        </div>
      </div>
    </div>
  )
}

function TextRow(props: DraftProps & { field: (typeof TEXT_ROWS)[number] }) {
  const { field: f, draft, setDraft } = props
  const h = draft.header[f.key]
  const id = `f-${f.key}`
  const setText = (change: Partial<HeaderText>) => setDraft((d) => { Object.assign(d.header[f.key], change) })

  return (
    <div role="listitem" className={`agent-row${h.show ? '' : ' is-hidden'}`}>
      <button
        type="button"
        className="eye"
        aria-pressed={h.show}
        aria-label={`Hiện dòng ${f.label} trên phiếu`}
        title={h.show ? 'Đang hiện – bấm để ẩn' : 'Đang ẩn – bấm để hiện'}
        onClick={() => setText({ show: !h.show })}
      >
        {h.show ? <Eye /> : <EyeOff />}
      </button>
      <div className="agent-body">
        <div className="agent-label">
          <label htmlFor={id} className="field-label">{f.label}</label>
          {!h.show && <span className="badge small">Đang ẩn</span>}
        </div>
        <input id={id} className="input" value={h.value} onChange={(e) => setText({ value: e.target.value })} />
      </div>
      <LineFormat rowKey={f.key} label={f.label} draft={draft} setDraft={setDraft} />
    </div>
  )
}

/** Cỡ chữ · căn lề · cách dưới của một dòng. Nhãn in chung dòng tên nên chỉ có cỡ chữ. */
function LineFormat(props: DraftProps & { rowKey: RowKey; label: string }) {
  const { rowKey, label, draft, setDraft } = props
  const id = `f-${rowKey}`
  const size = draft.header[rowKey].size
  const setSize = (v: number | null) => setDraft((d) => { d.header[rowKey].size = v ?? size })
  const sizeInput = (
    <CompactInput id={`${id}-size`} kind="size" label={`cỡ chữ ${label}`} unit="pt"
      title={`Cỡ chữ dòng ${label}`} value={size} min={HEADER_SIZE_MIN} max={HEADER_SIZE_MAX} step={0.5}
      onChange={setSize} />
  )
  if (rowKey === 'label') {
    return (
      <div className="agent-fmt">
        {sizeInput}
        <span className="agent-same">Chung dòng với tên đại lý</span>
      </div>
    )
  }

  const line: HeaderLineStyle = draft.header[rowKey]
  const setLine = (change: Partial<HeaderLineStyle>) => setDraft((d) => { Object.assign(d.header[rowKey], change) })
  return (
    <div className="agent-fmt">
      {sizeInput}
      <LineAlignPicker label={`Căn lề dòng ${label}`} value={line.align} onChange={(align) => setLine({ align })} />
      <CompactInput id={`${id}-after`} kind="gap-y" label={`khoảng cách dưới dòng ${label}`} unit="pt"
        title={rowKey === 'date' ? 'Khoảng cách tới bảng kết quả' : 'Khoảng cách tới dòng dưới'}
        value={line.afterPt} min={0} max={HEADER_AFTER_MAX} step={0.5}
        onChange={(v) => setLine({ afterPt: v ?? line.afterPt })} />
    </div>
  )
}
