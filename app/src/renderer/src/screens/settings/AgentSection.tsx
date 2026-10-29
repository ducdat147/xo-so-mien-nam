import type { HeaderKey, HeaderText } from '../../../../core/settings'
import { CompactInput } from '../../components/CompactInput'
import { Close, Eye, EyeOff } from '../../components/icons'
import type { DraftProps } from '../../useSettingsDraft'

type FieldKind = 'text' | 'phones' | 'auto'
interface AgentField {
  key: HeaderKey
  label: string
  kind: FieldKind
  placeholder?: string
  hint?: string
}

const AGENT_FIELDS: AgentField[] = [
  { key: 'label', label: 'Nhãn trước tên', kind: 'text' },
  { key: 'name', label: 'Tên đại lý', kind: 'text' },
  { key: 'addr', label: 'Địa chỉ', kind: 'text', hint: 'Phiếu tự thêm “ĐC: ” ở đầu.' },
  { key: 'phones', label: 'Số điện thoại (DĐ)', kind: 'phones', hint: 'Mỗi số in thành “DĐ: …”, chung một dòng.' },
  { key: 'date', label: 'Dòng thứ, ngày', kind: 'auto' }
]

/** Thẻ Thông tin đại lý: các dòng in ở đầu phiếu, mỗi dòng ẩn/hiện và chỉnh cỡ chữ riêng. */
export function AgentSection(props: DraftProps & {
  /** Dòng thứ, ngày của phiếu đang xem trước, ví dụ "Thứ Hai (26-10-2026)". */
  dateLine: string
}) {
  return (
    <div role="list" className="agent-list">
      {AGENT_FIELDS.map((f) => <AgentRow key={f.key} field={f} {...props} />)}
    </div>
  )
}

function AgentRow(props: DraftProps & { field: AgentField; dateLine: string }) {
  const { field: f, draft, setDraft, dateLine } = props
  const h = draft.header[f.key]
  const id = `f-${f.key}`
  const setHeader = (change: Partial<HeaderText & { values: string[] }>) =>
    setDraft((d) => { Object.assign(d.header[f.key], change) })

  return (
    <div role="listitem" className={`agent-row${h.show ? '' : ' is-hidden'}`}>
      <button
        type="button"
        className="eye"
        aria-pressed={h.show}
        aria-label={`Hiện dòng ${f.label} trên phiếu`}
        title={h.show ? 'Đang hiện – bấm để ẩn' : 'Đang ẩn – bấm để hiện'}
        onClick={() => setHeader({ show: !h.show })}
      >
        {h.show ? <Eye /> : <EyeOff />}
      </button>
      <div className="agent-body">
        <div className="agent-label">
          <label htmlFor={f.kind === 'phones' ? `${id}-0` : id} className="field-label">{f.label}</label>
          {!h.show && <span className="badge small">Đang ẩn</span>}
        </div>
        {f.kind === 'text' && (
          <input
            id={id}
            className="input"
            value={(h as HeaderText).value}
            placeholder={f.placeholder}
            onChange={(e) => setHeader({ value: e.target.value })}
          />
        )}
        {f.kind === 'phones' && <PhoneInputs id={id} draft={draft} setDraft={setDraft} />}
        {f.kind === 'auto' && <div id={id} className="auto-line">Tự động theo ngày xổ, ví dụ “{dateLine}”</div>}
        {f.hint && <span className="hint">{f.hint}</span>}
      </div>
      <div className="agent-size">
        <span className="field-label muted">Cỡ chữ</span>
        <CompactInput id={`${id}-size`} kind="size" label={`cỡ chữ ${f.label}`} unit="pt"
          title={`Cỡ chữ dòng ${f.label}`} value={h.size} min={5} max={30} step={0.5}
          onChange={(v) => setHeader({ size: v ?? h.size })} />
      </div>
    </div>
  )
}

/** Danh sách số điện thoại: thêm / xoá từng số. */
function PhoneInputs({ id, draft, setDraft }: DraftProps & { id: string }) {
  return (
    <div className="phones">
      {draft.header.phones.values.map((p, i) => (
        <div key={i} className="row">
          <input
            id={`${id}-${i}`}
            className="input grow"
            aria-label={`Số điện thoại ${i + 1}`}
            value={p}
            onChange={(e) => setDraft((d) => { d.header.phones.values[i] = e.target.value })}
          />
          <button
            type="button"
            className="btn square"
            aria-label={`Xoá số điện thoại ${i + 1}`}
            onClick={() => setDraft((d) => { d.header.phones.values.splice(i, 1) })}
          >
            <Close />
          </button>
        </div>
      ))}
      <button type="button" className="btn ghost" onClick={() => setDraft((d) => { d.header.phones.values.push('') })}>
        + Thêm số
      </button>
    </div>
  )
}
