import { Fragment, useMemo, useState, type ReactNode } from 'react'
import { formatDate, parseDate, todayVN } from '../../../core/dates'
import { PAPER_SPECS, TWIPS_PER_CM, viNumber } from '../../../core/layout'
import type { DayResult } from '../../../core/parse'
import { renderHtml } from '../../../core/render-html'
import {
  defaultSettings, FONTS, type CellStyle, type FontName, type HeaderKey, type HeaderText, type OutputFormat, type Paper, type Settings
} from '../../../core/settings'
import { buildSheet } from '../../../core/sheet'
import { STATIONS } from '../../../core/stations'
import { APP_NAME } from '../../../shared/brand'
import { api } from '../api'
import { NumberStepper, Segmented } from '../components/controls'
import { PagePositionPicker } from '../components/PagePositionPicker'
import { PrinterSelect } from '../components/PrinterSelect'
import { SheetPreview } from '../components/SheetPreview'
import { AlignGrid, alignName } from '../components/AlignGrid'
import { CompactInput } from '../components/CompactInput'
import { StationPicker } from '../components/StationPicker'
import { useFontCss, usePrinters } from '../hooks'
import { SAMPLE_DATE, SAMPLE_DAY } from '../sample'

type FieldKind = 'text' | 'phones' | 'auto'
const AGENT_FIELDS: { key: HeaderKey; label: string; kind: FieldKind; placeholder?: string; hint?: string }[] = [
  { key: 'label', label: 'Nhãn trước tên', kind: 'text' },
  { key: 'name', label: 'Tên đại lý', kind: 'text' },
  { key: 'addr', label: 'Địa chỉ', kind: 'text', hint: 'Phiếu tự thêm “ĐC: ” ở đầu.' },
  { key: 'phones', label: 'Số điện thoại (DĐ)', kind: 'phones', hint: 'Mỗi số in thành “DĐ: …”, chung một dòng.' },
  { key: 'date', label: 'Dòng thứ, ngày', kind: 'auto' },
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
const CELL_ROWS = [
  { key: 'textCell', label: 'Chữ', sub: 'Giải, tên giải, tên đài' },
  { key: 'numberCell', label: 'Số kết quả', sub: 'Các số trúng thưởng' }
] as const

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
/** Nhập: mũi tên đi vào tờ giấy. */
const FileImport = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <path d="M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8z" />
    <path d="M14 3v5h5" />
    <path d="M12 11v6M9 14l3 3 3-3" />
  </svg>
)
/** Xuất: mũi tên đi ra khỏi tờ giấy. */
const FileExport = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <path d="M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8z" />
    <path d="M14 3v5h5" />
    <path d="M12 17v-6M9 14l3-3 3 3" />
  </svg>
)
const Close = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true">
    <path d="M6 6l12 12M18 6L6 18" />
  </svg>
)

const Chevron = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <path d="M6 9l6 6 6-6" />
  </svg>
)

/** Thẻ cài đặt thu gọn / mở rộng được: bấm tiêu đề (hoặc Tab + Enter) để đổi. */
function Card(props: {
  id: string
  title: string
  desc?: string
  badge?: string
  open: boolean
  onToggle: () => void
  children: ReactNode
}) {
  const { id, title, desc, badge, open, onToggle, children } = props
  return (
    <section className={`card set-card${open ? '' : ' collapsed'}`} aria-labelledby={id}>
      <h2 className="set-h2">
        <button type="button" className="set-toggle" aria-expanded={open} aria-controls={`${id}-body`} onClick={onToggle}>
          <Chevron />
          <span id={id}>{title}</span>
          {badge && <span className="badge">{badge}</span>}
        </button>
      </h2>
      <div id={`${id}-body`} className="set-body" hidden={!open}>
        {desc && <p className="set-desc">{desc}</p>}
        {children}
      </div>
    </section>
  )
}

const CARD_IDS = ['h-daily', 'h-dai', 'h-in', 'h-mayin', 'h-luu'] as const
const COLLAPSED_KEY = 'xsmn.settings.collapsed'

/** Thẻ nào đang thu gọn; nhớ trong máy cho lần mở sau (lỗi bộ nhớ thì coi như mở hết). */
function useCollapsed() {
  const [collapsed, setCollapsed] = useState<Set<string>>(() => {
    try {
      return new Set(JSON.parse(localStorage.getItem(COLLAPSED_KEY) ?? '[]'))
    } catch {
      return new Set()
    }
  })
  /** Cập nhật từ trạng thái mới nhất (bấm nhanh nhiều thẻ liền nhau không ghi đè nhau) rồi lưu lại. */
  const update = (fn: (prev: Set<string>) => Set<string>) =>
    setCollapsed((prev) => {
      const next = fn(prev)
      try {
        localStorage.setItem(COLLAPSED_KEY, JSON.stringify([...next]))
      } catch {
        // không lưu được thì thôi, chỉ mất trạng thái lần sau
      }
      return next
    })
  const toggle = (id: string) =>
    update((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  return {
    card: (id: (typeof CARD_IDS)[number]) => ({ id, open: !collapsed.has(id), onToggle: () => toggle(id) }),
    allCollapsed: collapsed.size === CARD_IDS.length,
    setAll: (collapse: boolean) => update(() => new Set(collapse ? CARD_IDS : []))
  }
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
  const cards = useCollapsed()
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

  const exportConf = async () => {
    setMessage(null)
    try {
      const file = await api.exportConf(draft)
      if (!file) return
      const name = file.split(/[\\/]/).pop()
      setMessage({ kind: 'ok', text: `Đã xuất cài đặt ra ${name}` + (dirty ? ' (gồm cả thay đổi chưa lưu).' : '.') })
    } catch (e) {
      setMessage({ kind: 'error', text: `Không ghi được file: ${(e as Error).message}` })
    }
  }

  const chooseDir = async () => {
    const dir = await api.chooseOutputDir(draft.output.dir)
    if (dir) setDraft((d) => { d.output.dir = dir })
  }

  /** Bề rộng phiếu lớn nhất trên khổ giấy (cm, làm tròn 0,1 như chú thích khổ giấy). */
  const maxWidthNum = (paper: Paper) => {
    const s = PAPER_SPECS[paper]
    const gap = Math.trunc(draft.print.cardGapXCm * TWIPS_PER_CM)
    return Math.round((Math.trunc((s.w - 908 - (s.ncol - 1) * gap) / s.ncol) / TWIPS_PER_CM) * 10) / 10
  }
  const maxWidthCm = (paper: Paper) => viNumber(maxWidthNum(paper))
  /** Chiều cao phiếu lớn nhất trên khổ giấy (cm, làm tròn 0,1; layout bỏ qua phần nhỉnh do làm tròn). */
  const maxHeightCm = (paper: Paper) => {
    const s = PAPER_SPECS[paper]
    const gap = Math.trunc(draft.print.cardGapYCm * TWIPS_PER_CM)
    return Math.round((Math.trunc((s.h - 908 - (s.nrow - 1) * gap) / s.nrow) / TWIPS_PER_CM) * 10) / 10
  }

  const fontOptions = [null, 12, 13, 14]
  if (draft.print.numberFontPt !== null && !fontOptions.includes(draft.print.numberFontPt)) fontOptions.push(draft.print.numberFontPt)

  return (
    <div className="settings">
      <div className="settings-main">
        <div className="settings-tools">
          <button type="button" className="btn ghost small-btn" onClick={() => cards.setAll(!cards.allCollapsed)}>
            {cards.allCollapsed ? 'Mở rộng tất cả' : 'Thu gọn tất cả'}
          </button>
        </div>
        <Card
          {...cards.card('h-daily')}
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
          {...cards.card('h-dai')}
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

        <Card {...cards.card('h-in')} title="Bản in">
          <div className="grid-2 wide">
            <Segmented id="l-kho" label="Khổ giấy mặc định" options={PAPER_OPTIONS} value={draft.print.paper}
              onChange={(v) => setDraft((d) => { d.print.paper = v })} variant="tall" />
            <Segmented id="l-dd" label="Định dạng mặc định" options={FORMAT_OPTIONS} value={draft.print.format}
              onChange={(v) => setDraft((d) => { d.print.format = v })} variant="plain" />
            <div className="field">
              <span id="l-size" className="field-label">Kích thước phiếu</span>
              <div className="row wrap" role="group" aria-labelledby="l-size">
                <CompactInput id="f-cw" kind="width" label="bề rộng phiếu" title="Bề rộng mỗi phiếu. Để trống hoặc gõ auto: rộng nhất vừa khổ giấy"
                  value={draft.print.cardWidthCm} min={4} max={10} allowAuto autoValue={maxWidthNum(draft.print.paper)}
                  onChange={(v) => setDraft((d) => { d.print.cardWidthCm = v })} />
                <CompactInput id="f-ch" kind="height" label="chiều cao phiếu" title="Chiều cao mỗi phiếu. Để trống hoặc gõ auto: cao hết chỗ trống"
                  value={draft.print.cardHeightCm} min={4} max={maxHeightCm('A4')} allowAuto autoValue={maxHeightCm(draft.print.paper)}
                  onChange={(v) => setDraft((d) => { d.print.cardHeightCm = v })} />
              </div>
              <span className="hint">
                Tối đa rộng {maxWidthCm('A4')} cm (A4, A5), {maxWidthCm('A6')} cm (A6); cao {viNumber(maxHeightCm('A4'))} cm (A4),{' '}
                {viNumber(maxHeightCm('A5'))} cm (A5, A6). Auto là lấy mức tối đa; nhấp đúp chữ “Rộng”/“Cao”, xoá số hoặc gõ “auto” để về Auto.
              </span>
            </div>
            <div className="field">
              <span id="l-gap" className="field-label">Khoảng cách giữa các phiếu</span>
              <div className="row" role="group" aria-labelledby="l-gap">
                <CompactInput id="f-gap-x" kind="gap-x" label="khoảng cách ngang giữa hai cột phiếu"
                  title="Khoảng cách ngang giữa hai cột phiếu (A4, A5)" value={draft.print.cardGapXCm}
                  onChange={(v) => setDraft((d) => { d.print.cardGapXCm = v ?? 0 })} />
                <CompactInput id="f-gap-y" kind="gap-y" label="khoảng cách dọc giữa hai hàng phiếu"
                  title="Khoảng cách dọc giữa hai hàng phiếu (A4)" value={draft.print.cardGapYCm}
                  onChange={(v) => setDraft((d) => { d.print.cardGapYCm = v ?? 0 })} />
              </div>
              <span className="hint">Ngang: giữa 2 cột (A4, A5). Dọc: giữa 2 hàng (A4). Kéo trên biểu tượng để chỉnh nhanh.</span>
            </div>
            <div className="field">
              <span id="l-calign" className="field-label">Vị trí cụm phiếu trên trang</span>
              <PagePositionPicker id="l-calign" paper={draft.print.paper} value={draft.print.cardAlign}
                onChange={(v) => setDraft((d) => { d.print.cardAlign = v })} />
              <span className="hint">
                {draft.print.paper === 'A6'
                  ? 'Khổ A6 chỉ có một phiếu: lệch trái / giữa / phải trong phần trống của trang.'
                  : 'Phần giấy còn trống dồn sang phía đối diện; chọn Giữa để chia đều hai bên.'}
              </span>
            </div>
            <div className="field">
              <span id="l-typo" className="field-label">Font chữ &amp; cỡ số</span>
              <div className="row" role="group" aria-labelledby="l-typo">
                <select
                  id="f-font"
                  className="input grow"
                  aria-label="Font chữ trên phiếu"
                  value={draft.print.font}
                  onChange={(e) => setDraft((d) => { d.print.font = e.target.value as FontName })}
                >
                  {FONTS.map((f) => <option key={f} value={f}>{f}</option>)}
                </select>
                <select
                  id="f-nsize"
                  className="input size-select"
                  aria-label="Cỡ số kết quả"
                  value={String(draft.print.numberFontPt ?? 0)}
                  onChange={(e) => setDraft((d) => { d.print.numberFontPt = Number(e.target.value) || null })}
                >
                  {fontOptions.map((pt) => (
                    <option key={pt ?? 0} value={String(pt ?? 0)}>{pt === null ? 'Tự động' : `${viNumber(pt)} pt`}</option>
                  ))}
                </select>
              </div>
              <span className="hint">
                Font dùng cho cả phiếu. Cỡ số kết quả{' '}
                {draft.print.numberFontPt === null
                  ? `tự động lấy lớn nhất vừa phiếu, hiện là ${numberPt} pt.`
                  : `chọn tay ${viNumber(draft.print.numberFontPt)} pt; to quá thì tự hạ cho vừa.`}
              </span>
            </div>
          </div>
          <div className="cell-styles" role="group" aria-labelledby="l-cells">
            <span id="l-cells" className="field-label">Chữ trong bảng</span>
            <div className="cell-styles-grid">
              <span />
              <span className="cell-col-head">Padding</span>
              <span className="cell-col-head">Align</span>
              {CELL_ROWS.map((r) => {
                const c = draft.print[r.key]
                const set = (patch: Partial<CellStyle>) => setDraft((d) => { Object.assign(d.print[r.key], patch) })
                return (
                  <Fragment key={r.key}>
                    <div className="cell-row-label">
                      <span>{r.label}</span>
                      <span className="hint">{r.sub}</span>
                    </div>
                    <div className="row">
                      <CompactInput id={`${r.key}-px`} kind="pad-x" label={`padding ngang của ${r.label.toLowerCase()}`}
                        title={`Khoảng cách ngang từ mép ô tới ${r.label.toLowerCase()}, ở phía được căn`}
                        value={c.padXCm} min={0} max={1.5} step={0.05} onChange={(v) => set({ padXCm: v ?? 0 })} />
                      <CompactInput id={`${r.key}-py`} kind="pad-y" label={`padding dọc của ${r.label.toLowerCase()}`}
                        title={`Khoảng cách dọc từ mép ô tới ${r.label.toLowerCase()}, ở phía được căn`}
                        value={c.padYCm} min={0} max={1} step={0.05} onChange={(v) => set({ padYCm: v ?? 0 })} />
                    </div>
                    <div className="cell-align">
                      <AlignGrid label={`Căn ${r.label.toLowerCase()} trong ô`} x={c.alignX} y={c.alignY}
                        onChange={(x, y) => set({ alignX: x, alignY: y })} />
                      <span className="hint">{alignName(c.alignX, c.alignY)}</span>
                    </div>
                  </Fragment>
                )
              })}
            </div>
            <span className="hint">
              Padding tính từ mép ô tới chữ, ở phía chữ được căn (căn giữa: cả hai bên). Hàng “Giải” và tên đài
              luôn nằm giữa ô theo chiều dọc.
            </span>
          </div>
        </Card>

        <Card {...cards.card('h-mayin')} title="Máy in" desc="Lựa chọn mặc định cho nhóm In phiếu ở màn Kết quả. Chọn máy in ở màn Kết quả cũng được lưu lại. Mặc định bấm In sẽ mở bước xem trước khi in.">
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

        <Card {...cards.card('h-luu')} title="Lưu file">
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
          <div className="conf-group" role="group" aria-labelledby="l-conf">
            <span id="l-conf" className="conf-label">Cấu hình</span>
            <button type="button" className="icon-btn small tip" onClick={importConf}
              aria-label="Nhập cấu hình từ file .conf" data-tip="Nhập cấu hình từ file .conf">
              <FileImport />
            </button>
            <button type="button" className="icon-btn small tip" onClick={exportConf}
              aria-label="Xuất cấu hình ra file .conf" data-tip="Xuất cấu hình ra file .conf">
              <FileExport />
            </button>
          </div>
          {version && <span className="bar-msg muted">{APP_NAME} · phiên bản {version}</span>}
        </div>
        {/* Thông báo co giãn ở giữa, không đẩy hai nút bên phải xuống dòng */}
        <div className="bar-status" role="status">
          {message && <span className={`bar-msg ${message.kind}`}>{message.text}</span>}
          {!message && !dirty && <span className="bar-msg muted">Đã lưu cài đặt</span>}
          {!message && dirty && <span className="bar-msg muted">Có thay đổi chưa lưu</span>}
        </div>
        <div className="bar-right">
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
