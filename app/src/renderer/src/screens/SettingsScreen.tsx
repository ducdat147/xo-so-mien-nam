import { useMemo, useState, type ReactNode } from 'react'
import { formatDate, parseDate, todayVN } from '../../../core/dates'
import { PAPER_SPECS, TWIPS_PER_CM, viNumber } from '../../../core/layout'
import type { DayResult } from '../../../core/parse'
import { renderHtml } from '../../../core/render-html'
import {
  defaultSettings, FONTS, type Align, type HeaderKey, type HeaderText, type OutputFormat, type Paper, type Settings
} from '../../../core/settings'
import { buildSheet } from '../../../core/sheet'
import { STATIONS } from '../../../core/stations'
import { APP_NAME } from '../../../shared/brand'
import { api } from '../api'
import { NumberStepper, Segmented } from '../components/controls'
import { PrinterSelect } from '../components/PrinterSelect'
import { SheetPreview } from '../components/SheetPreview'
import { StationPicker } from '../components/StationPicker'
import { useFontCss, usePrinters } from '../hooks'
import { SAMPLE_DATE, SAMPLE_DAY } from '../sample'

type FieldKind = 'text' | 'phones' | 'auto'
const AGENT_FIELDS: { key: HeaderKey; label: string; kind: FieldKind; placeholder?: string; hint?: string }[] = [
  { key: 'label', label: 'Nhãn trước tên', kind: 'text' },
  { key: 'name', label: 'Tên đại lý', kind: 'text' },
  { key: 'addr', label: 'Địa chỉ', kind: 'text', hint: 'Phiếu tự thêm “ĐC: ” ở đầu.' },
  { key: 'fax', label: 'Fax', kind: 'text' },
  { key: 'phones', label: 'Số điện thoại (DĐ)', kind: 'phones', hint: 'In cùng dòng với Fax.' },
  { key: 'date', label: 'Dòng thứ, ngày', kind: 'auto' },
  { key: 'note', label: 'Ghi chú dưới chữ “Tư”', kind: 'text', placeholder: 'Ví dụ: Cần so lại với fax của c.ty', hint: 'In nhỏ trong ô “Tư” của cột Giải.' }
]

const PAPER_OPTIONS = [
  { value: 'A4', label: 'A4', sub: '4 bản/tờ' },
  { value: 'A5', label: 'A5', sub: '2 bản/tờ' },
  { value: 'A6', label: 'A6', sub: '1 bản/tờ' }
] as const
const FORMAT_OPTIONS = [
  { value: 'pdf', label: 'PDF' },
  { value: 'docx', label: 'Word' },
  { value: 'both', label: 'Cả hai' }
] as const
const ALIGN_LABEL: Record<Align, string> = { left: 'Trái', center: 'Giữa', right: 'Phải' }
const EXT: Record<OutputFormat, string> = { pdf: '.pdf', docx: '.docx', both: '.pdf + .docx' }

const EyeOpen = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <path d="M2 12s3.6-7 10-7 10 7 10 7-3.6 7-10 7S2 12 2 12z" />
    <circle cx="12" cy="12" r="3" />
  </svg>
)
const EyeOff = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <path d="M10.6 5.1A10.8 10.8 0 0 1 12 5c6.4 0 10 7 10 7a17.6 17.6 0 0 1-3.2 4.2M6.6 6.6C3.8 8.4 2 12 2 12s3.6 7 10 7a9.7 9.7 0 0 0 5.4-1.6" />
    <path d="M9.9 9.9a3 3 0 0 0 4.2 4.2" />
    <path d="M3 3l18 18" />
  </svg>
)
const Close = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true">
    <path d="M6 6l12 12M18 6L6 18" />
  </svg>
)

function Card(props: { id: string; title: string; desc?: string; badge?: string; children: ReactNode }) {
  return (
    <section className="card set-card" aria-labelledby={props.id}>
      <div className="set-head">
        <div className="set-title-row">
          <h2 id={props.id}>{props.title}</h2>
          {props.badge && <span className="badge">{props.badge}</span>}
        </div>
        {props.desc && <p className="set-desc">{props.desc}</p>}
      </div>
      {props.children}
    </section>
  )
}

function SelectField<T extends string | number>(props: {
  id: string
  label: string
  value: T
  options: { value: T; label: string }[]
  onChange: (v: T) => void
}) {
  const { id, label, value, options, onChange } = props
  return (
    <div className="field">
      <label htmlFor={id} className="field-label">{label}</label>
      <select
        id={id}
        className="input"
        value={String(value)}
        onChange={(e) => onChange(options.find((o) => String(o.value) === e.target.value)!.value)}
      >
        {options.map((o) => <option key={String(o.value)} value={String(o.value)}>{o.label}</option>)}
      </select>
    </div>
  )
}

export interface SettingsScreenProps {
  draft: Settings
  setDraft: (fn: (d: Settings) => void) => void
  replaceDraft: (s: Settings) => void
  dirty: boolean
  saving: boolean
  /** Trả chuỗi lỗi, rỗng nếu lưu được. */
  onSave: () => Promise<string>
  /** Kết quả tải gần nhất (đủ hoặc đang quay); null = dùng dữ liệu mẫu. */
  lastResult: DayResult | null
  /** Phiên bản app (package.json). */
  version: string
}

export function SettingsScreen(props: SettingsScreenProps) {
  const { draft, setDraft, replaceDraft, dirty, saving, onSave, lastResult, version } = props
  const [message, setMessage] = useState<{ kind: 'ok' | 'error'; text: string } | null>(null)
  const fontCss = useFontCss(draft.print.font)
  const { printers, loading: findingPrinters, refresh: refreshPrinters } = usePrinters()

  // ------------------------------------------------------------ xem trước một phiếu
  const day = lastResult ?? SAMPLE_DAY
  const date = (lastResult && parseDate(lastResult.date)) || SAMPLE_DATE
  const sheet = useMemo(
    () => buildSheet(draft, day, { date, paper: draft.print.paper, blank: false }),
    [draft, day, date.y, date.m, date.d] // eslint-disable-line react-hooks/exhaustive-deps
  )
  const html = useMemo(() => renderHtml(sheet.layout, { fontCss, mode: 'card' }), [sheet, fontCss])
  const l = sheet.layout
  const numberPt = viNumber(l.table.numberSize / 2)

  const setHeader = (key: HeaderKey, change: Partial<HeaderText & { values: string[] }>) =>
    setDraft((d) => Object.assign(d.header[key], change))

  const importConf = async () => {
    setMessage(null)
    try {
      const r = await api.importConf(draft)
      if (!r) return
      replaceDraft(r.settings)
      const name = r.file.split(/[\\/]/).pop()
      setMessage({
        kind: 'ok',
        text: `Đã nhập ${r.imported} khoá từ ${name}` + (r.ignored.length ? `, bỏ qua: ${r.ignored.join(', ')}` : '') + '. Bấm “Lưu cài đặt” để giữ.'
      })
    } catch (e) {
      setMessage({ kind: 'error', text: `Không đọc được file: ${(e as Error).message}` })
    }
  }

  const chooseDir = async () => {
    const dir = await api.chooseOutputDir(draft.output.dir)
    if (dir) setDraft((d) => { d.output.dir = dir })
  }

  const maxWidthCm = (paper: Paper) => {
    const s = PAPER_SPECS[paper]
    const gap = Math.trunc(draft.print.cardGapCm * TWIPS_PER_CM)
    return viNumber(Math.trunc((s.w - 908 - (s.ncol - 1) * gap) / s.ncol) / TWIPS_PER_CM)
  }

  const fontOptions = [null, 12, 13, 14]
  if (draft.print.numberFontPt !== null && !fontOptions.includes(draft.print.numberFontPt)) fontOptions.push(draft.print.numberFontPt)

  return (
    <div className="settings">
      <div className="settings-main">
        <Card
          id="h-daily"
          title="Thông tin đại lý"
          desc="Các dòng in ở đầu mỗi phiếu. Bấm biểu tượng con mắt để hiện hoặc ẩn từng dòng, chỉnh cỡ chữ theo pt. Phần đầu phiếu cao lên thì bảng kết quả tự co lại cho vừa."
        >
          <div role="list" className="agent-list">
            {AGENT_FIELDS.map((f) => {
              const h = draft.header[f.key]
              const id = `f-${f.key}`
              return (
                <div role="listitem" key={f.key} className={`agent-row${h.show ? '' : ' is-hidden'}`}>
                  <button
                    type="button"
                    className="eye"
                    aria-pressed={h.show}
                    aria-label={`Hiện dòng ${f.label} trên phiếu`}
                    title={h.show ? 'Đang hiện – bấm để ẩn' : 'Đang ẩn – bấm để hiện'}
                    onClick={() => setHeader(f.key, { show: !h.show })}
                  >
                    {h.show ? <EyeOpen /> : <EyeOff />}
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
                        onChange={(e) => setHeader(f.key, { value: e.target.value })}
                      />
                    )}
                    {f.kind === 'phones' && (
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
                        <button
                          type="button"
                          className="btn ghost"
                          onClick={() => setDraft((d) => { d.header.phones.values.push('') })}
                        >
                          + Thêm số
                        </button>
                      </div>
                    )}
                    {f.kind === 'auto' && (
                      <div id={id} className="auto-line">Tự động theo ngày xổ, ví dụ “{l.title}”</div>
                    )}
                    {f.hint && <span className="hint">{f.hint}</span>}
                  </div>
                  <div className="agent-size">
                    <span className="field-label muted">Cỡ chữ</span>
                    <NumberStepper
                      label={`cỡ chữ ${f.label}`}
                      value={h.size}
                      min={5}
                      max={30}
                      step={0.5}
                      unit="pt"
                      onChange={(v) => setHeader(f.key, { size: v })}
                    />
                  </div>
                </div>
              )
            })}
          </div>
        </Card>

        <Card
          id="h-dai"
          title="Đài cần in"
          desc="Kéo thả để đổi thứ tự; thứ tự từ trái sang phải là thứ tự cột trên phiếu. Bỏ chọn hết các đài của một thứ thì ngày đó in đủ các đài."
        >
          <div role="radiogroup" aria-label="Cách chọn đài" className="radios">
            <label className="check">
              <input
                type="radio"
                name="che-do-dai"
                checked={draft.stations.mode === 'all'}
                onChange={() => setDraft((d) => { d.stations.mode = 'all' })}
              />
              <span>Tất cả đài quay trong ngày</span>
            </label>
            <label className="check">
              <input
                type="radio"
                name="che-do-dai"
                checked={draft.stations.mode === 'pick'}
                onChange={() => setDraft((d) => { d.stations.mode = 'pick' })}
              />
              <span>Chọn đài theo thứ</span>
            </label>
          </div>
          <StationPicker
            byWeekday={draft.stations.byWeekday}
            locked={draft.stations.mode === 'all'}
            onChange={(day, list) => setDraft((d) => { d.stations.byWeekday[day] = list })}
          />
          <details className="short-names">
            <summary>Tên viết tắt in trên phiếu ({STATIONS.length} đài)</summary>
            <div className="short-grid">
              {STATIONS.map((st) => (
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
            <p className="hint">Để trống thì dùng tên viết tắt mặc định.</p>
          </details>
        </Card>

        <Card id="h-in" title="Bản in">
          <div className="grid-2 wide">
            <Segmented id="l-kho" label="Khổ giấy mặc định" options={PAPER_OPTIONS} value={draft.print.paper}
              onChange={(v) => setDraft((d) => { d.print.paper = v })} variant="tall" />
            <Segmented id="l-dd" label="Định dạng mặc định" options={FORMAT_OPTIONS} value={draft.print.format}
              onChange={(v) => setDraft((d) => { d.print.format = v })} variant="plain" />
            <div className="field">
              <label htmlFor="f-cw" className="field-label">Bề ngang phiếu</label>
              <NumberStepper id="f-cw" label="bề ngang phiếu" value={draft.print.cardWidthCm} min={4} max={10} step={0.1} unit="cm"
                onChange={(v) => setDraft((d) => { d.print.cardWidthCm = v })} />
              <span className="hint">Tối đa {maxWidthCm('A4')} cm với A4/A5, {maxWidthCm('A6')} cm với A6.</span>
            </div>
            <div className="field">
              <label htmlFor="f-gap" className="field-label">Khoảng cách giữa các phiếu</label>
              <NumberStepper id="f-gap" label="khoảng cách giữa các phiếu" value={draft.print.cardGapCm} min={0} max={3} step={0.1} unit="cm"
                onChange={(v) => setDraft((d) => { d.print.cardGapCm = v })} />
            </div>
            <div className="field">
              <label htmlFor="f-pad" className="field-label">Khoảng cách số tới lề phải ô</label>
              <NumberStepper id="f-pad" label="khoảng cách số tới lề phải ô" value={draft.print.numberPadRightCm} min={0} max={1.5} step={0.1} unit="cm"
                onChange={(v) => setDraft((d) => { d.print.numberPadRightCm = v })} />
            </div>
            <SelectField id="f-calign" label="Vị trí cụm phiếu trên trang" value={draft.print.cardAlign}
              options={(['left', 'center', 'right'] as const).map((a) => ({ value: a, label: ALIGN_LABEL[a] }))}
              onChange={(v) => setDraft((d) => { d.print.cardAlign = v })} />
            <SelectField id="f-talign" label="Căn chữ trong bảng" value={draft.print.alignText}
              options={(['center', 'left', 'right'] as const).map((a) => ({ value: a, label: ALIGN_LABEL[a] }))}
              onChange={(v) => setDraft((d) => { d.print.alignText = v })} />
            <SelectField id="f-nalign" label="Căn số kết quả" value={draft.print.alignNumber}
              options={(['right', 'center', 'left'] as const).map((a) => ({ value: a, label: ALIGN_LABEL[a] }))}
              onChange={(v) => setDraft((d) => { d.print.alignNumber = v })} />
            <SelectField id="f-nsize" label="Cỡ số kết quả" value={draft.print.numberFontPt ?? 0}
              options={fontOptions.map((pt) => ({ value: pt ?? 0, label: pt === null ? 'Tự động (lớn nhất vừa phiếu)' : `${viNumber(pt)} pt` }))}
              onChange={(v) => setDraft((d) => { d.print.numberFontPt = v || null })} />
            <SelectField id="f-font" label="Font chữ trên phiếu" value={draft.print.font}
              options={FONTS.map((f) => ({ value: f, label: f }))}
              onChange={(v) => setDraft((d) => { d.print.font = v })} />
          </div>
        </Card>

        <Card id="h-mayin" title="Máy in" desc="Lựa chọn mặc định cho nhóm In phiếu ở màn Kết quả. Chọn máy in ở màn Kết quả cũng được lưu lại. Mặc định bấm In sẽ mở bước xem trước khi in.">
          <PrinterSelect
            id="f-printer"
            label="Máy in mặc định"
            value={draft.printer.deviceName}
            onChange={(name) => setDraft((d) => {
              d.printer.deviceName = name
              if (!name) d.printer.silent = false
            })}
            printers={printers}
            loading={findingPrinters}
            onRefresh={refreshPrinters}
          />
          <div className="grid-2 wide">
            <div className="field">
              <label htmlFor="f-copies" className="field-label">Số bản in mặc định</label>
              <NumberStepper id="f-copies" label="số bản in mặc định" value={draft.printer.copies} min={1} max={99}
                onChange={(v) => setDraft((d) => { d.printer.copies = v })} />
              <span className="hint">Mỗi bản là một tờ giấy.</span>
            </div>
            <div className="field">
              <label className={`check${draft.printer.deviceName ? '' : ' disabled'}`}>
                <input
                  type="checkbox"
                  checked={draft.printer.silent && !!draft.printer.deviceName}
                  disabled={!draft.printer.deviceName}
                  onChange={(e) => setDraft((d) => { d.printer.silent = e.target.checked })}
                />
                <span>In nhanh, bỏ qua bước xem trước</span>
              </label>
              <span className="hint">
                {draft.printer.deviceName
                  ? 'Bật thì nút In ở màn Kết quả in ngay ra máy in đã chọn, đúng khổ giấy và số bản, không mở bước xem trước.'
                  : 'Chọn một máy in cụ thể để bật in nhanh.'}
              </span>
            </div>
          </div>
        </Card>

        <Card id="h-luu" title="Lưu file">
          <div className="field">
            <label htmlFor="f-dir" className="field-label">Thư mục lưu</label>
            <div className="row">
              <input id="f-dir" className="input grow" value={draft.output.dir} readOnly />
              <button type="button" className="btn" onClick={chooseDir}>Chọn…</button>
            </div>
          </div>
          <p className="set-desc">
            Tên file ví dụ: <strong>xsmn_{formatDate(todayVN())}_{draft.print.paper}{EXT[draft.print.format]}</strong>. Lưu trùng tên thì ghi đè.
          </p>
        </Card>
      </div>

      <aside className="settings-side" aria-labelledby="h-xt">
        <h2 id="h-xt">Xem trước phiếu</h2>
        <SheetPreview html={html} width={l.cardW / 15} height={l.cardH / 15} label="Xem trước một phiếu" />
        <p className="hint">
          Cỡ số kết quả hiện tại: {numberPt} pt{draft.print.numberFontPt === null ? ' (tự chỉnh để vừa phiếu)' : ''}.
          {' '}Khổ {draft.print.paper}, phiếu {viNumber(l.cardW / TWIPS_PER_CM)} × {viNumber(l.cardH / TWIPS_PER_CM)} cm.
          {' '}{lastResult ? `Số trong phiếu là kết quả ngày ${lastResult.date}.` : 'Số trong phiếu là kết quả mẫu ngày 26-10-2026.'}
        </p>
        {l.warnings.length > 0 && <ul className="warnings">{l.warnings.map((w) => <li key={w}>{w}</li>)}</ul>}
      </aside>

      <div className="settings-bar">
        <div className="bar-left">
          <button type="button" className="btn" onClick={importConf}>Nhập từ xsmn.conf…</button>
          {version && <span className="bar-msg muted">{APP_NAME} · phiên bản {version}</span>}
        </div>
        <div className="bar-right">
          {message && <span role="status" className={`bar-msg ${message.kind}`}>{message.text}</span>}
          {!message && !dirty && <span role="status" className="bar-msg muted">Đã lưu cài đặt</span>}
          {!message && dirty && <span className="bar-msg muted">Có thay đổi chưa lưu</span>}
          <button type="button" className="btn ghost" onClick={() => { replaceDraft(defaultSettings()); setMessage(null) }}>
            Khôi phục mặc định
          </button>
          <button type="button" className="btn accent save" onClick={async () => {
            setMessage(null)
            const err = await onSave()
            if (err) setMessage({ kind: 'error', text: err })
          }} disabled={!dirty || saving}>
            {saving ? 'Đang lưu…' : 'Lưu cài đặt'}
          </button>
        </div>
      </div>
    </div>
  )
}
