import type { OutputFormat } from '../../../../core/settings'
import { Segmented } from '../../components/controls'
import { Download } from '../../components/icons'
import { FILE_EXT, FORMAT_OPTIONS } from '../../labels'

const SAVE_LABEL: Record<OutputFormat, string> = { pdf: 'Lưu PDF', docx: 'Lưu Word', both: 'Lưu PDF và Word' }

/** Nhóm Lưu file ở cột trái: loại file, thư mục lưu, nút Lưu. */
export function SaveCard(props: {
  format: OutputFormat
  onFormat: (f: OutputFormat) => void
  dir: string
  onChooseDir: () => void
  onOpenDir: () => void
  /** Tên file chưa có đuôi, ví dụ "xsmn_27-10-2026_A4". */
  baseName: string
  /** Đang in hoặc đang lưu: khoá nút Lưu. */
  busy: boolean
  saving: boolean
  onSave: () => void
}) {
  const { format, onFormat, dir, onChooseDir, onOpenDir, baseName, busy, saving, onSave } = props
  return (
    <section className="card tight" aria-labelledby="h-luu-file">
      <h2 id="h-luu-file" className="card-title"><Download /> Lưu file</h2>
      <Segmented id="dd-label" label="Loại file" options={FORMAT_OPTIONS} value={format} onChange={onFormat} variant="plain" />
      <div className="field">
        <label htmlFor="noi-luu" className="field-label">Vị trí lưu</label>
        <div className="row">
          <input id="noi-luu" className="input grow" value={dir} title={dir} readOnly />
          <button type="button" className="btn" onClick={onChooseDir}>Chọn…</button>
        </div>
        <button type="button" className="btn ghost small-btn" onClick={onOpenDir}>Mở thư mục</button>
      </div>
      <p className="hint">
        Tên file: <strong>{baseName}{FILE_EXT[format]}</strong>. Lưu trùng tên thì ghi đè.
      </p>
      <button type="button" className="btn primary" onClick={onSave} disabled={busy}>
        <Download />
        {saving ? 'Đang lưu…' : SAVE_LABEL[format]}
      </button>
    </section>
  )
}
