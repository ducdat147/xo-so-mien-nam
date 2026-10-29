import { useState } from 'react'
import { defaultSettings, type Settings } from '../../../../core/settings'
import { APP_NAME } from '../../../../shared/brand'
import { api } from '../../api'
import { FileExport, FileImport } from '../../components/icons'
import { fileName } from '../../labels'

/** Thanh dưới màn Cài đặt: nhập / xuất file .conf, trạng thái lưu, khôi phục mặc định, nút Lưu. */
export function SettingsBar(props: {
  draft: Settings
  replaceDraft: (s: Settings) => void
  dirty: boolean
  saving: boolean
  /** Trả chuỗi lỗi, rỗng nếu lưu được. */
  onSave: () => Promise<string>
  version: string
}) {
  const { draft, replaceDraft, dirty, saving, onSave, version } = props
  const [message, setMessage] = useState<{ kind: 'ok' | 'error'; text: string } | null>(null)

  const importConf = async () => {
    setMessage(null)
    try {
      const r = await api.importConf(draft)
      if (!r) return
      replaceDraft(r.settings)
      setMessage({
        kind: 'ok',
        text: `Đã nhập ${r.imported} khoá từ ${fileName(r.file)}` + (r.ignored.length ? `, bỏ qua: ${r.ignored.join(', ')}` : '') + '. Bấm “Lưu cài đặt” để giữ.'
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
      setMessage({ kind: 'ok', text: `Đã xuất cài đặt ra ${fileName(file)}` + (dirty ? ' (gồm cả thay đổi chưa lưu).' : '.') })
    } catch (e) {
      setMessage({ kind: 'error', text: `Không ghi được file: ${(e as Error).message}` })
    }
  }

  const save = async () => {
    setMessage(null)
    const err = await onSave()
    if (err) setMessage({ kind: 'error', text: err })
  }

  return (
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
        <button type="button" className="btn accent save" onClick={save} disabled={!dirty || saving}>
          {saving ? 'Đang lưu…' : 'Lưu cài đặt'}
        </button>
      </div>
    </div>
  )
}
